#version 300 es
precision mediump float;

out vec4 FragColor;

uniform float ambientStrength, specularStrength, diffuseStrength,shininess;

in vec3 Normal;//法向量
in vec3 FragPos;//相机观察的片元位置
in vec2 TexCoord;//纹理坐标
in vec4 FragPosLightSpace;//光源观察的片元位置

uniform vec3 viewPos;//相机位置
uniform vec4 u_lightPosition; //光源位置	
uniform vec3 lightColor;//入射光颜色

uniform sampler2D diffuseTexture;
uniform sampler2D depthTexture;
uniform samplerCube cubeSampler;//盒子纹理采样器


float shadowCalculation(vec4 fragPosLightSpace, vec3 normal, vec3 lightDir)
{
    float shadow=0.0;  //非阴影
    /*TODO3: 添加阴影计算，返回1表示是阴影，返回0表示非阴影*/
    //
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    projCoords = projCoords * 0.5 + 0.5;

    if (projCoords.x < 0.0 || projCoords.x > 1.0 ||
        projCoords.y < 0.0 || projCoords.y > 1.0 ||
        projCoords.z < 0.0 || projCoords.z > 1.0) {
        return 0.0;
    }

    float currentDepth = projCoords.z;
    float bias = max(0.005 * (1.0 - dot(normal, lightDir)), 0.001);

    // 计算遮挡物平均深度
    ivec2 texSize = textureSize(depthTexture, 0);
    vec2 texelSize = 1.0 / vec2(texSize);
    float blockerDepthSum = 0.0;
    int blockerCount = 0;
    int searchSize = 4; // 遮挡物搜索范围
    for(int x = -searchSize; x <= searchSize; ++x) {
        for(int y = -searchSize; y <= searchSize; ++y) {
            vec2 offset = vec2(x, y) * texelSize;
            float depth = texture(depthTexture, projCoords.xy + offset).r;
            if (depth < currentDepth - bias) { 
                blockerDepthSum += depth;
                blockerCount++;
            }
        }
    }
    if (blockerCount == 0) return 0.0; // 无遮挡物，无阴影

    // 计算平均遮挡物深度
    float avgBlockerDepth = blockerDepthSum / float(blockerCount);

    // 基于遮挡物距离,计算PCF采样范围
    float penumbraSize = (currentDepth - avgBlockerDepth) * 0.05 / avgBlockerDepth;
    int filterSize = int(penumbraSize * float(texSize.x));
    filterSize = clamp(filterSize, 1, 8); // 限制采样范围

    // 动态范围PCF采样
    int sampleCount = 0;
    for(int x = -filterSize; x <= filterSize; ++x) {
        for(int y = -filterSize; y <= filterSize; ++y) {
            vec2 offset = vec2(x, y) * texelSize;
            float pcfDepth = texture(depthTexture, projCoords.xy + offset).r;
            shadow += (currentDepth - bias > pcfDepth) ? 1.0 : 0.0;
            sampleCount++;
        }
    }
    shadow /= float(sampleCount);
    //

    return shadow;
   
}       

void main()
{
    //采样纹理颜色
    vec3 TextureColor = texture(diffuseTexture, TexCoord).xyz;

    //计算光照颜色
 	vec3 norm = normalize(Normal);
	vec3 lightDir;
	if(u_lightPosition.w==1.0) 
        lightDir = normalize(u_lightPosition.xyz - FragPos);
	else lightDir = normalize(u_lightPosition.xyz);
	vec3 viewDir = normalize(viewPos - FragPos);
	vec3 halfDir = normalize(viewDir + lightDir);


    /*TODO2:根据phong shading方法计算ambient,diffuse,specular*/
    vec3  ambient,diffuse,specular;

    //
    // 环境光计算
    ambient = ambientStrength * lightColor;

    // 漫反射计算
    float diff = max(dot(norm, lightDir), 0.0);
    diffuse = diffuseStrength * diff * lightColor;

    // 高光（Phong 模型）
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
    specular = specularStrength * spec * lightColor;
    //
  
  	vec3 lightReflectColor=(ambient +diffuse + specular);

    //判定是否阴影，并对各种颜色进行混合
    float shadow = shadowCalculation(FragPosLightSpace, norm, lightDir);
	
    //vec3 resultColor =(ambient + (1.0-shadow) * (diffuse + specular))* TextureColor;
    vec3 resultColor=(1.0-shadow/2.0)* lightReflectColor * TextureColor;
    
    FragColor = vec4(resultColor, 1.f);
}


