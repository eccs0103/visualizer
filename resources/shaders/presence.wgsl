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

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
	let stem = id.x;
	if (stem >= shape.stems) {
		return;
	}
	var logit = weights[shape.inputs * shape.stems + stem];
	for (var channel = 0u; channel < shape.inputs; channel++) {
		var sum = 0.0;
		for (var position = 0u; position < shape.span; position++) {
			sum += source[channel * shape.span + position];
		}
		logit += weights[channel * shape.stems + stem] * (sum / f32(shape.span));
	}
	result[stem] = 1.0 / (1.0 + exp(-logit));
}
