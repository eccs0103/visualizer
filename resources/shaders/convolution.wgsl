struct Shape {
	inputs: u32,
	skipped: u32,
	filters: u32,
	span: u32,
	kernel: u32,
	mode: u32,
	taps: u32,
	dilation: u32,
	depth: u32,
	sources: u32,
	skips: u32,
	padding: u32,
}

struct Clock {
	step: u32,
	frames: u32,
}

@group(0) @binding(0) var<uniform> shape: Shape;
@group(0) @binding(1) var<storage, read> source: array<f32>;
@group(0) @binding(2) var<storage, read> skip: array<f32>;
@group(0) @binding(3) var<storage, read> weights: array<f32>;
@group(0) @binding(4) var<storage, read_write> result: array<f32>;
@group(0) @binding(5) var<uniform> clock: Clock;

fn gather(channel: u32, position: u32, time: u32) -> f32 {
	const pooled = 1u;
	const joined = 2u;
	let span = shape.span;
	let slot = time % shape.sources;
	if (shape.mode == pooled) {
		let base = (slot * shape.inputs + channel) * span * 2u + position * 2u;
		return max(source[base], source[base + 1u]);
	}
	if (shape.mode == joined) {
		if (channel < shape.inputs) {
			return source[(slot * shape.inputs + channel) * (span / 2u) + position / 2u];
		}
		return skip[((time % shape.skips) * shape.skipped + channel - shape.inputs) * span + position];
	}
	return source[(slot * shape.inputs + channel) * span + position];
}

override rows: u32 = 4u;
override columns: u32 = 4u;
override reach: u32 = 5u;
override height: u32 = 8u * rows;
override width: u32 = 8u * columns;
override strip_size: u32 = 8u * (width + reach - 1u);
override slab_size: u32 = reach * 8u * height;

var<workgroup> strip: array<f32, strip_size>;
var<workgroup> slab: array<f32, slab_size>;

@compute @workgroup_size(8, 8)
fn main(@builtin(workgroup_id) group: vec3<u32>, @builtin(local_invocation_id) lane: vec3<u32>, @builtin(local_invocation_index) local: u32) {
	if (group.z >= clock.frames) {
		return;
	}
	const chunk = 8u;
	let now = clock.step + 1u + group.z - clock.frames;
	let channels = shape.inputs + shape.skipped;
	let first = group.x * height;
	let start = group.y * width;
	let half = i32(shape.kernel / 2u);
	let window = width + shape.kernel - 1u;
	let span = i32(shape.span);
	var sums: array<f32, 16>;

	for (var delay = 0u; delay < shape.taps; delay++) {
		let lag = delay * shape.dilation;
		if (lag > now) {
			continue;
		}
		let time = now - lag;
		for (var base = 0u; base < channels; base += chunk) {
			for (var index = local; index < chunk * window; index += 64u) {
				let channel = base + index / window;
				let at = i32(start + index % window) - half;
				var value = 0.0;
				if (channel < channels && at >= 0 && at < span) {
					value = gather(channel, u32(at), time);
				}
				strip[index] = value;
			}
			for (var index = local; index < shape.kernel * chunk * height; index += 64u) {
				let tap = index / (chunk * height);
				let channel = base + (index / height) % chunk;
				let unit = first + index % height;
				var value = 0.0;
				if (channel < channels && unit < shape.filters) {
					value = weights[((delay * shape.kernel + tap) * channels + channel) * shape.filters + unit];
				}
				slab[index] = value;
			}
			workgroupBarrier();

			for (var tap = 0u; tap < shape.kernel; tap++) {
				for (var offset = 0u; offset < chunk; offset++) {
					var row: array<f32, 4>;
					var column: array<f32, 4>;
					for (var step = 0u; step < rows; step++) {
						row[step] = slab[(tap * chunk + offset) * height + lane.x * rows + step];
					}
					for (var step = 0u; step < columns; step++) {
						column[step] = strip[offset * window + lane.y * columns + step + tap];
					}
					for (var filter_index = 0u; filter_index < rows; filter_index++) {
						for (var position_index = 0u; position_index < columns; position_index++) {
							sums[filter_index * columns + position_index] += row[filter_index] * column[position_index];
						}
					}
				}
			}
			workgroupBarrier();
		}
	}

	let count = shape.taps * shape.kernel * channels * shape.filters;
	let slot = (now % shape.depth) * shape.filters;
	for (var filter_index = 0u; filter_index < rows; filter_index++) {
		let unit = first + lane.x * rows + filter_index;
		if (unit >= shape.filters) {
			continue;
		}
		let bias = weights[count + unit];
		let scale = weights[count + shape.filters + unit];
		let shift = weights[count + 2u * shape.filters + unit];
		for (var position_index = 0u; position_index < columns; position_index++) {
			let position = start + lane.y * columns + position_index;
			if (position < shape.span) {
				result[(slot + unit) * shape.span + position] = max(sums[filter_index * columns + position_index] + bias, 0.0) * scale + shift;
			}
		}
	}
}
