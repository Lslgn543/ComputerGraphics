varying vec3 vUv;

uniform sampler2D map;
uniform float numSamples;

void main() 
{
    vec3 textureColor = vec3(texture2D(map, vUv.xy).rgb); 
    gl_FragColor = vec4(textureColor / numSamples, 1.0);
}