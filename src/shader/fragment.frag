#define PI 3.1415926535897932384626433832795
varying vec2 vUv;

uniform float uTime;
uniform float uProgress;
uniform bool uRevealAnimation;
uniform float uDirection;
uniform vec4 uResolution;
uniform sampler2D uTexture1;
uniform sampler2D uTexture2;
uniform sampler2D uDataTexture;

void main() {
  vec4 offset = texture2D(uDataTexture, vUv);
  vec2 newUV = (vUv - vec2(0.5)) * uResolution.zw + vec2(0.5);

  vec2 fastOut = vec2(sin(uProgress * PI) * 0.4 * offset.r, 0.);
  vec2 slowIn = vec2(sin(uProgress * PI) * 0.1 * offset.r, 0.);

  vec4 color1 = texture2D(uTexture1, newUV + uDirection * fastOut);
  vec4 color2 = texture2D(uTexture2, newUV + -uDirection * slowIn);

  if (uRevealAnimation) {
    color1.a = 0.;
  }

  gl_FragColor = mix(color1, color2, uProgress);
}
