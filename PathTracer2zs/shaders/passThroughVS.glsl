varying vec3 vUv; 

void main() 
{
    vUv = position * .5 + .5; 

    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewPosition; 
    gl_Position = vec4(position, 1); 
}