varying vec3 vUv;

uniform sampler2D map;
uniform float numSamples;

void main() 
{
    vec3 textureColor = vec3(texture2D(map, vUv.xy).rgb); 
    
    // 为了改善第一帧的亮度，我们对样本数进行调整
    // 在第一帧时，我们使用较小的除数来增加亮度
    float adjustedNumSamples = numSamples;
    if (numSamples < 5.0) {  // 前几帧增加亮度
        adjustedNumSamples = max(numSamples * 0.5, 1.0);  // 使用较小的除数来增加亮度
    }
    
    gl_FragColor = vec4(textureColor / adjustedNumSamples, 1.0);
}