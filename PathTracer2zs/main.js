import { Scene } from './scene.js';

// 声明全局变量，使它们可以在init函数外访问
let pathTraceMaterial;
let sceneManager;

// 加载着色器文件
async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}

async function init() {
    // 加载着色器
    const passThroughVSCode = await loadShader('./shaders/passThroughVS.glsl');
    const pathTraceFSCode = await loadShader('./shaders/pathTraceFS.glsl');
    const passThroughDivideFSCode = await loadShader('./shaders/passThroughDivideFS.glsl');

    // full screen triangle geometry
    let geometry = new THREE.Geometry();
    geometry.vertices = [new THREE.Vector3(-1,-1,0), new THREE.Vector3(3,-1,0), new THREE.Vector3(-1,3,0)]; 
    geometry.faces = [new THREE.Face3(0,1,2)];

    let screenWidth = window.innerWidth * 1;
    let screenHeight = window.innerHeight * 1;

    let scenePathTrace = new THREE.Scene();
    let bufferTexture = new THREE.WebGLRenderTarget(screenWidth, screenHeight, { 
        minFilter: THREE.LinearFilter, 
        magFilter: THREE.NearestFilter, 
        format: THREE.RGBAFormat,
        type: THREE.FloatType 
    });

    // 创建场景管理器实例
    sceneManager = new Scene();
    // 加载木质纹理
    await sceneManager.loadGroundTexture('./textures/wood.png'); // 确保有这个纹理文件
    // 创建默认场景
    sceneManager.createDefaultScene();
    
    // 获取初始场景uniform数据
    const sceneUniforms = sceneManager.getUniforms();

    // 初始uniform
    let uniformsPathTrace = {
        lowerLeftCorner: {type: 'vec3', value: new THREE.Vector3(-1, -1, -1)},
        horizontal: {type: 'vec3', value: new THREE.Vector3(2, 0, 0)},
        vertical: {type: 'vec3', value: new THREE.Vector3(0, 2, 0)},
        origin: {type: 'vec3', value: new THREE.Vector3(0, 0, 1)},
        ratio: {value: 0.5},
        corner: {value: -0.5},
        iteration: {value: 0},
        random: {type: 'vec3', value: new THREE.Vector3(0, 0, 0)},
        screenSizeInv: {type: 'vec2', value: new THREE.Vector2(1.0 / screenWidth, 1.0 / screenHeight)},
        // 添加场景数据uniform
        sphereCount: sceneUniforms.sphereCount,
        sphereCenters: sceneUniforms.sphereCenters,
        sphereRadii: sceneUniforms.sphereRadii,
        sphereColors: sceneUniforms.sphereColors,
        sphereMaterials: sceneUniforms.sphereMaterials,
        // 添加立方体相关uniform
        cubeCount: sceneUniforms.cubeCount,
        cubeCenters: sceneUniforms.cubeCenters,
        cubeSizes: sceneUniforms.cubeSizes,
        cubeColors: sceneUniforms.cubeColors,
        cubeMaterials: sceneUniforms.cubeMaterials,
        // 添加三角形相关uniform
        triangleCount: sceneUniforms.triangleCount,
        triangleVertices: sceneUniforms.triangleVertices,
        triangleColors: sceneUniforms.triangleColors,
        triangleMaterials: sceneUniforms.triangleMaterials,
        // 添加平面uniform
        groundPlanePos: { type: 'vec3', value: sceneUniforms.groundPlanePos.value },
        groundPlaneNormal: { type: 'vec3', value: sceneUniforms.groundPlaneNormal.value },
        groundPlaneColor: { type: 'vec3', value: sceneUniforms.groundPlaneColor.value },
        groundPlaneMaterial: { value: sceneUniforms.groundPlaneMaterial.value },
        groundPlaneTexture: { value: sceneUniforms.groundPlaneTexture.value },
        groundPlaneTextureScale: { value: sceneUniforms.groundPlaneTextureScale.value },
        groundPlaneSize: { type: 'vec2', value: sceneUniforms.groundPlaneSize.value }, // 添加地面尺寸uniform
        // 添加玻璃折射率uniform
        glassIOR: { value: 1.5 } // 玻璃折射率
    }

    uniformsPathTrace.ratio.value = screenWidth / screenHeight;

    pathTraceMaterial = new THREE.ShaderMaterial({
        uniforms: uniformsPathTrace,
        vertexShader: passThroughVSCode,
        fragmentShader: pathTraceFSCode,
    });
    pathTraceMaterial.blending = THREE.AdditiveBlending;

    let planePathTrace = new THREE.Mesh(geometry, pathTraceMaterial);
    scenePathTrace.add(planePathTrace);

    // **********

    let uniforms = {
        map: { value: bufferTexture.texture },
        numSamples: {value: 1.0}
    }
    
    // 创建一个新的材质使用uniforms变量
    let material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: passThroughVSCode,
        fragmentShader: passThroughDivideFSCode,
    });
    
    // 创建场景和平面网格用于最终渲染
    let scene = new THREE.Scene();
    let plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    let renderer = new THREE.WebGLRenderer({alpha: true});
    renderer.setSize(screenWidth, screenHeight);
    renderer.autoClear = false;

    // 将渲染器DOM元素添加到canvas-wrapper容器而不是body
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    canvasWrapper.appendChild(renderer.domElement);
    
    // 从body中移除canvas元素（如果存在）
    const existingCanvas = document.getElementById('canvas');
    if (existingCanvas && existingCanvas.parentNode === canvasWrapper) {
        canvasWrapper.removeChild(existingCanvas);
    }

    // 相机控制相关变量
    let mouseDown = false;
    let mousePos = 0;
    let cameraPos = 0;
    let cameraChange = 0;
    // 添加第三人称相机控制变量
    let cameraYaw = 0;       // 水平旋转角度
    let cameraPitch = 0;     // 垂直旋转角度 (-90 到 90 度之间)
    let cameraDistance = 2;  // 相机到目标的距离
    let cameraTarget = new THREE.Vector3(0, 0.3, -1);  // 相机目标点
    let numSamples = 0;
    
    // 重置路径追踪的样本计数
    function resetPathTracer() {
        // 替换已弃用的clearTarget方法
        renderer.setRenderTarget(bufferTexture);
        renderer.clear();
        renderer.setRenderTarget(null);
        numSamples = 1.0;
        planePathTrace.material.uniforms.iteration.value = numSamples;
    }
    
    // 更新场景uniform数据
    function updateSceneUniforms() {
        const sceneUniforms = sceneManager.getUniforms();
        
        // 更新球体相关uniform
        pathTraceMaterial.uniforms.sphereCount.value = sceneUniforms.sphereCount.value;
        pathTraceMaterial.uniforms.sphereCenters.value = sceneUniforms.sphereCenters.value;
        pathTraceMaterial.uniforms.sphereRadii.value = sceneUniforms.sphereRadii.value;
        pathTraceMaterial.uniforms.sphereColors.value = sceneUniforms.sphereColors.value;
        pathTraceMaterial.uniforms.sphereMaterials.value = sceneUniforms.sphereMaterials.value;
        
        // 更新立方体相关uniform
        pathTraceMaterial.uniforms.cubeCount.value = sceneUniforms.cubeCount.value;
        pathTraceMaterial.uniforms.cubeCenters.value = sceneUniforms.cubeCenters.value;
        pathTraceMaterial.uniforms.cubeSizes.value = sceneUniforms.cubeSizes.value;
        pathTraceMaterial.uniforms.cubeColors.value = sceneUniforms.cubeColors.value;
        pathTraceMaterial.uniforms.cubeMaterials.value = sceneUniforms.cubeMaterials.value;
        
        // 更新三角形相关uniform
        pathTraceMaterial.uniforms.triangleCount.value = sceneUniforms.triangleCount.value;
        pathTraceMaterial.uniforms.triangleVertices.value = sceneUniforms.triangleVertices.value;
        pathTraceMaterial.uniforms.triangleColors.value = sceneUniforms.triangleColors.value;
        pathTraceMaterial.uniforms.triangleMaterials.value = sceneUniforms.triangleMaterials.value;
        
        // 更新平面uniform
        pathTraceMaterial.uniforms.groundPlanePos.value = sceneUniforms.groundPlanePos.value;
        pathTraceMaterial.uniforms.groundPlaneNormal.value = sceneUniforms.groundPlaneNormal.value;
        pathTraceMaterial.uniforms.groundPlaneColor.value = sceneUniforms.groundPlaneColor.value;
        pathTraceMaterial.uniforms.groundPlaneMaterial.value = sceneUniforms.groundPlaneMaterial.value;
        pathTraceMaterial.uniforms.groundPlaneTexture.value = sceneUniforms.groundPlaneTexture.value;
        pathTraceMaterial.uniforms.groundPlaneTextureScale.value = sceneUniforms.groundPlaneTextureScale.value;
        pathTraceMaterial.uniforms.groundPlaneSize.value = sceneUniforms.groundPlaneSize.value;
        
        // 更新玻璃折射率uniform
        pathTraceMaterial.uniforms.glassIOR.value = sceneUniforms.glassIOR ? sceneUniforms.glassIOR.value : 1.5;
        

        // 重置路径追踪器
        resetPathTracer();
        
        // 更新物体列表UI
        updateObjectListUI();
    }
    
    // 更新物体列表UI
    function updateObjectListUI() {
        const objectListElement = document.getElementById('objectList') || document.getElementById('sphereList');
        objectListElement.innerHTML = '';
        
        // 添加球体列表
        const sphereSection = document.createElement('div');
        sphereSection.className = 'object-section';
        sphereSection.innerHTML = '<h3>球体列表</h3>';
        
        for (let i = 0; i < sceneManager.spheres.length; i++) {
            const sphere = sceneManager.spheres[i];
            const sphereElement = document.createElement('div');
            sphereElement.className = 'object-item sphere-item';
            sphereElement.innerHTML = `
                <div>
                    <span>球体 ${i + 1}: (${sphere.center.x.toFixed(2)}, ${sphere.center.y.toFixed(2)}, ${sphere.center.z.toFixed(2)})</span>
                </div>
                <div class="sphere-material-info">材质: ${getMaterialText(sphere.material)}</div>
                <button class="remove-object" data-type="sphere" data-index="${i}">删除</button>
            `;
            sphereSection.appendChild(sphereElement);
        }
        
        // 添加立方体列表
        const cubeSection = document.createElement('div');
        cubeSection.className = 'object-section';
        cubeSection.innerHTML = '<h3>立方体列表</h3>';
        
        for (let i = 0; i < sceneManager.cubes.length; i++) {
            const cube = sceneManager.cubes[i];
            const cubeElement = document.createElement('div');
            cubeElement.className = 'object-item';
            cubeElement.innerHTML = `
                <div>
                    <span>立方体 ${i + 1}: (${cube.center.x.toFixed(2)}, ${cube.center.y.toFixed(2)}, ${cube.center.z.toFixed(2)})</span>
                </div>
                <div class="sphere-material-info">材质: ${getMaterialText(cube.material)}</div>
                <button class="remove-object" data-type="cube" data-index="${i}">删除</button>
            `;
            cubeSection.appendChild(cubeElement);
        }
        
        objectListElement.appendChild(sphereSection);
        objectListElement.appendChild(cubeSection);
        
        // 为删除按钮添加事件监听
        document.querySelectorAll('.remove-object').forEach(button => {
            button.addEventListener('click', function() {
                const type = this.getAttribute('data-type');
                const index = parseInt(this.getAttribute('data-index'));
                
                if (type === 'sphere') {
                    sceneManager.removeSphere(index);
                } else if (type === 'cube') {
                    sceneManager.removeCube(index);
                }
                
                // 更新UI和场景
                updateSceneUniforms();
            });
        });
    }
    
    // 获取材质类型的文本表示
    function getMaterialText(materialType) {
        switch(materialType) {
            case 0: return '镜面';
            case 1: return '漫反射';
            case 2: return '光源';
            case 3: return '玻璃';
            default: return '未知';
        }
    }
    
    // 添加物体按钮事件监听
    document.getElementById('addObject').addEventListener('click', function() {
        // 获取物体类型选择
        const objectType = document.getElementById('objectType').value;
        
        // 获取位置和属性
        const posX = parseFloat(document.getElementById('posX').value || 0);
        const posY = parseFloat(document.getElementById('posY').value || 0);
        const posZ = parseFloat(document.getElementById('posZ').value || 0);
        
        // 获取材质类型
        const materialType = document.getElementById('material') || document.getElementById('materialType');
        const materialValue = materialType ? parseInt(materialType.value) : 1;
        
        // 获取颜色
        const colorInput = document.getElementById('color') || document.getElementById('objectColor');
        const colorHex = colorInput ? colorInput.value : '#0000ff';
        const color = new THREE.Color(colorHex);
        
        // 根据物体类型添加不同的对象
        if (objectType === '0') { // 球体
            // 获取半径
            const radius = parseFloat((document.getElementById('radius') || {}).value || 0.5);
            
            // 添加球体
            const success = sceneManager.addSphere(
                new THREE.Vector3(posX, posY, posZ),
                radius,
                color,
                materialValue
            );
            
            if (success) {
                // 更新UI和场景
                updateSceneUniforms();
            } else {
                alert('无法添加更多球体。已达到最大数量限制。');
            }
        } else if (objectType === '1') { // 立方体
            // 获取立方体大小
            const size = parseFloat((document.getElementById('size') || document.getElementById('radius')).value || 0.5);
            
            // 添加立方体
            const success = sceneManager.addCube(
                new THREE.Vector3(posX, posY, posZ),
                new THREE.Vector3(size, size, size),
                color,
                materialValue
            );
            
            if (success) {
                // 更新UI和场景
                updateSceneUniforms();
            } else {
                alert('无法添加更多立方体。已达到最大数量限制。');
            }
        }
    });
    
    document.getElementById('clearAll').addEventListener('click', () => {
        sceneManager.clear();
        // 更新UI和场景
        updateSceneUniforms();
    });
    
    // 初始更新物体列表UI
    updateObjectListUI();
    
    renderer.domElement.addEventListener('mousedown', e => {
        mouseDown = true;
        mousePos = new THREE.Vector2(e.clientX, e.clientY);
    });

    renderer.domElement.addEventListener('mousemove', e => {
        if (mouseDown == true) {
            // 第三人称相机控制 - 水平和垂直旋转
            const deltaX = mousePos.x - e.clientX;
            const deltaY = mousePos.y - e.clientY;
            
            cameraYaw += deltaX * 0.01;
            cameraPitch += deltaY * 0.01;
            
            // 限制垂直旋转角度 (-85 到 85 度)，避免视角翻转
            cameraPitch = Math.max(-1.484, Math.min(1.484, cameraPitch));
            
            mousePos = new THREE.Vector2(e.clientX, e.clientY);
            
            // 相机移动时重置路径追踪
            resetPathTracer();
        }
    });

    renderer.domElement.addEventListener('mouseup', e => {
        mouseDown = false;
    });
    
    // 添加鼠标滚轮缩放控制
    renderer.domElement.addEventListener('wheel', e => {
        e.preventDefault();
        
        // 根据滚轮方向调整相机距离
        if (e.deltaY > 0) {
            cameraDistance = Math.min(cameraDistance * 1.1, 10); // 最大距离限制
        } else {
            cameraDistance = Math.max(cameraDistance * 0.9, 0.5); // 最小距离限制
        }
        
        // 相机缩放时重置路径追踪
        resetPathTracer();
    });
    
    // 添加键盘控制，用于移动相机目标
    const keyState = {};
    window.addEventListener('keydown', e => {
        keyState[e.code] = true;
    });
    
    window.addEventListener('keyup', e => {
        keyState[e.code] = false;
    });
    
    // 更新相机目标位置的函数
    function updateCameraTarget(deltaTime) {
        const moveSpeed = 0.1 * deltaTime * 0.05; // 调整移动速度
        const moveDirection = new THREE.Vector3(0, 0, 0);
        
        // 基于相机视角的移动方向
        // W/S 键：前进/后退
        if (keyState['KeyW']) moveDirection.z -= 1;
        if (keyState['KeyS']) moveDirection.z += 1;
        
        // A/D 键：左移/右移
        if (keyState['KeyA']) moveDirection.x -= 1;
        if (keyState['KeyD']) moveDirection.x += 1;
        
        // Q/E 键：上下移动
        if (keyState['KeyQ']) moveDirection.y -= 1;
        if (keyState['KeyE']) moveDirection.y += 1;
        
        // 如果有移动输入
        if (moveDirection.lengthSq() > 0) {
            moveDirection.normalize();
            
            // 创建相机旋转矩阵
            const rotationMatrix = new THREE.Matrix4().makeRotationY(cameraYaw);
            
            // 应用旋转，使移动方向与相机视角一致
            const rotatedDirection = moveDirection.clone().applyMatrix4(rotationMatrix);
            
            // 更新目标位置
            cameraTarget.add(rotatedDirection.multiplyScalar(moveSpeed));
            
            // 重置路径追踪
            resetPathTracer();
        }
    }
    
    function updateCamera(origin, lookat, vup, vfov, aspect, shaderValues) {
        const PI = 3.1415926;
        // vfov is top to bottom in degrees
        let u, v, w;
        let theta = vfov * PI / 180;
        let half_height = Math.tan(theta / 2);
        let half_width = aspect * half_height;
        w = (origin.clone().sub(lookat)).normalize();  // unit_vector(lookfrom - lookat);
        u = (vup.clone().cross(w)).normalize(); //    unit_vector(cross(vup, w));
        v = w.clone().cross(u); //  cross(w, u);
        
        let horizontalHalf = u.clone().multiplyScalar(half_width);
        let verticalHalf = v.clone().multiplyScalar(half_height);
        
        let horizontal = horizontalHalf.clone().multiplyScalar(2.0);
        let vertical = verticalHalf.clone().multiplyScalar(2.0);

        let lower_left_corner = origin.clone().sub(horizontalHalf).sub(verticalHalf).sub(w);

        shaderValues.origin.value = origin;
        shaderValues.lowerLeftCorner.value = lower_left_corner;
        shaderValues.horizontal.value = horizontal;
        shaderValues.vertical.value = vertical;
    }

    let oldTime = 0;
    
    function animate(timestamp) {
        let delta = timestamp - oldTime;
        oldTime = timestamp;
        
        // 更新相机目标位置（键盘控制）
        updateCameraTarget(delta);
        
        numSamples = numSamples + 1.0;
        planePathTrace.material.uniforms.iteration.value = numSamples;
        planePathTrace.material.uniforms.random.value = new THREE.Vector3(Math.random(), Math.random(), Math.random());

        // 计算相机位置：基于目标点、旋转角度和距离
        const cameraX = cameraTarget.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * cameraDistance;
        const cameraY = cameraTarget.y + Math.sin(cameraPitch) * cameraDistance;
        const cameraZ = cameraTarget.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * cameraDistance;
        const cameraPosition = new THREE.Vector3(cameraX, cameraY, cameraZ);
        
        // 更新相机
        updateCamera(cameraPosition, cameraTarget, new THREE.Vector3(0, 1, 0), 75.0, screenWidth / screenHeight, planePathTrace.material.uniforms);

        renderer.setRenderTarget(bufferTexture);
        renderer.render(scenePathTrace, camera);

        // 修复未定义的material变量引用，使用正确的uniforms变量
        uniforms.numSamples.value = numSamples;
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }
    
    // 添加窗口大小调整事件处理
    window.addEventListener('resize', () => {
        const canvasWrapper = document.querySelector('.canvas-wrapper');
        const width = canvasWrapper.clientWidth;
        const height = canvasWrapper.clientHeight;
        
        // 调整渲染器大小
        renderer.setSize(width, height);
        
        // 调整uniform中的屏幕尺寸
        pathTraceMaterial.uniforms.screenSizeInv.value = new THREE.Vector2(1.0 / width, 1.0 / height);
        pathTraceMaterial.uniforms.ratio.value = width / height;
        
        // 重置路径追踪
        resetPathTracer();
    });

    requestAnimationFrame(animate);
}

// 初始化应用
init().catch(console.error);