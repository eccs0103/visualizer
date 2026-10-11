struct Shape {
	inputs: u32,
	stems: u32,
	span: u32,
	padding: u32,
}

@group(0) @binding(0) var<uniform> shape: Shape;
@group(0) @binding(1) var<storage, read> source: array<f32>;
@group(0) @binding(2) var<storage, read> weights: array<f32>;
@group(0) @binding(3) var<storage, read_write> result: array<f32>;
@group(0) @binding(4) var<storage, read> presence: array<f32>; // per stem; 1 for an ungated model, which leaves the softmax exactly as it is

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
	let position = id.x;
	if (position >= shape.span) {
		return;
	}
	let stems = shape.stems;
	let base = position * stems;
	let bias = shape.inputs * stems;
	var peak = -3.0e38;
	for (var stem = 0u; stem < stems; stem++) {
		var logit = weights[bias + stem];
		for (var channel = 0u; channel < shape.inputs; channel++) {
			logit += weights[channel * stems + stem] * source[channel * shape.span + position];
		}
		result[base + stem] = logit;
		peak = max(peak, logit);
	}
	var total = 0.0;
	for (var stem = 0u; stem < stems; stem++) {
		let power = exp(result[base + stem] - peak) * presence[stem];
		result[base + stem] = power;
		total += power;
	}
	for (var stem = 0u; stem < stems; stem++) {
		result[base + stem] /= total;
	}
}
