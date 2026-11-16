#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec4 u_pointer;
uniform float u_strength;

uniform float u_pixel_scale;
uniform sampler2D u_glyphs;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 s = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), s.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), s.x),
    s.y
  );
}

float terrainNoise(vec2 p) {
  mat2 turn = mat2(0.8, -0.6, 0.6, 0.8);
  float n = 0.57 * noise(p);
  p = turn * p * 2.03 + 8.4;
  n += 0.28 * noise(p);
  p = turn * p * 2.01 + 5.7;
  return n + 0.15 * noise(p);
}

float hill(vec2 p, vec2 center, vec2 radius) {
  vec2 d = (p - center) / radius;
  return exp(-dot(d, d));
}

void main() {
  float size = min(u_resolution.x, u_resolution.y);
  vec2 extent = u_resolution / size;
  vec2 cell = vec2(8.0, 12.0) * u_pixel_scale;
  vec2 p = (floor(gl_FragCoord.xy / cell) + 0.5) * cell / size;
  float t = u_time * 0.025;
  vec2 warp = vec2(
    terrainNoise(p * 1.6 + vec2(t, -t * 0.6)),
    terrainNoise(p * 1.6 + vec2(7.3 - t * 0.7, 2.8 + t))
  );
  vec2 q = p + (warp - 0.5) * 0.42;
  q += 0.055 * vec2(sin(p.y * 5.0 + t), sin(p.x * 4.3 - t));

  // Overlapping hills share one surface, so their ribbons can join and split.
  // Screen-relative centers keep the terrain to the right on portrait screens too.
  float field = hill(q, extent * vec2(0.60, 0.23) + 0.045 * vec2(sin(t), cos(t)), vec2(0.23, 0.25));
  field += 0.9 * hill(q, extent * vec2(0.92, 0.53) + 0.06 * vec2(cos(t * 0.8), sin(t)), vec2(0.25, 0.24));
  field += 0.85 * hill(q, extent * vec2(0.69, 0.85) + 0.04 * vec2(sin(t * 0.7), -cos(t)), vec2(0.19, 0.22));
  field += 0.8 * hill(q, extent * vec2(1.12, 0.12), vec2(0.34, 0.30));

  // The cursor is an attractive hill, not a displacement that vanishes at rest.
  // Its moving footprint stretches along its spring velocity like a liquid neck.
  float speed = min(length(u_pointer.zw), 2.0);
  vec2 axis = normalize(u_pointer.zw + vec2(0.0001, 0.0));
  vec2 delta = p - u_pointer.xy;
  vec2 pull = vec2(dot(delta, axis), dot(delta, vec2(-axis.y, axis.x)));
  pull /= vec2(0.075 + speed * 0.065, 0.065 + speed * 0.012);
  field += u_strength * 0.32 * exp(-dot(pull, pull));

  // Height increases away from each crest: subtracting time sends bands outward.
  float height = -log(max(field, 0.00001));
  float elevation = height * 1.4 - u_time * 0.105;
  float band = floor(elevation + 0.5);
  float distanceToBand = abs(elevation - band);
  float travelling = 0.5 + 0.5 * sin(q.x * 3.0 - q.y * 2.8 + band * 1.7 + u_time * 0.12);
  float envelope = 1.0 - smoothstep(3.1, 3.9, height);
  float halfWidth = (0.125 + travelling * 0.075) * envelope;
  float aa = 0.03;
  float ribbon = 1.0 - smoothstep(max(0.0, halfWidth - aa), halfWidth + aa, distanceToBand);
  ribbon *= smoothstep(0.0, 0.08, envelope);
  float glyph = floor(ribbon * 9.0 + 0.5);
  vec2 uv = fract(gl_FragCoord.xy / cell);
  float ink = texture2D(u_glyphs, vec2((glyph + uv.x) / 10.0, 1.0 - uv.y)).r;
  vec3 ivory = vec3(234.0, 232.0, 220.0) / 255.0;
  // Ivory cell backgrounds preserve character shapes beneath the blended title.
  gl_FragColor = vec4(ivory * (1.0 - ink), step(0.01, ribbon));
}
