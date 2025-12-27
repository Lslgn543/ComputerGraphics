/**
 * 场景管理类 - 用于创建和管理路径追踪器的场景对象
 */
class Scene {
    constructor() {
        // 存储场景中的所有球体
        this.spheres = [];
        // 存储场景中的所有立方体
        this.cubes = [];
        // 存储场景中的所有三角形
        this.triangles = [];
        // 最大对象数量限制(着色器中的数组大小)
        this.maxObjects = 20;
        // 存储空心立方体
        this.wireframeCubes = [];
        // 添加地面平面
        this.groundPlane = {
            position: new THREE.Vector3(0, -0.5, 0), // 平面位置
            normal: new THREE.Vector3(0, 1, 0),      // 平面法向量(朝上)
            color: new THREE.Color(1.0, 1.0, 1.0).multiplyScalar(0.7), // 灰色
            material: 1 ,// 漫反射材质
            textureScale: 1.0, // 纹理缩放因子
            texture: null, // 纹理对象将在这里存储
            size: new THREE.Vector2(20.0, 20.0) // 添加地面尺寸属性 (width, depth)
        };
        //

        
    }

    // 添加加载地面纹理的方法
    loadGroundTexture(textureUrl) {
        return new Promise((resolve, reject) => {
            const loader = new THREE.TextureLoader();
            loader.load(
                textureUrl,
                (texture) => {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    this.groundPlane.texture = texture;
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.error('地面纹理加载失败:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * 添加球体到场景
     * @param {THREE.Vector3} center 球体中心位置
     * @param {number} radius 球体半径
     * @param {THREE.Color} color 球体颜色
     * @param {number} material 球体材质类型: 0=镜面, 1=漫反射, 2=光源
     */
    addSphere(center, radius, color, material = 1) {
        if (this.spheres.length < this.maxObjects) {
            this.spheres.push({
                center: center,
                radius: radius,
                color: color,
                material: material
            });
            return true;
        }
        return false;
    }

    /**
     * 添加立方体到场景
     * @param {THREE.Vector3} center 立方体中心位置
     * @param {THREE.Vector3} size 立方体大小
     * @param {THREE.Color} color 立方体颜色
     * @param {number} material 立方体材质类型: 0=镜面, 1=漫反射, 2=光源
     */
    addCube(center, size, color, material = 1) {
        if (this.cubes.length < this.maxObjects) {
            this.cubes.push({
                center: center,
                size: size,
                color: color,
                material: material
            });
            return true;
        }
        return false;
    }

    /**
      * 添加三角形到场景
      * @param {THREE.Vector3} v0 三角形第一个顶点
      * @param {THREE.Vector3} v1 三角形第二个顶点
      * @param {THREE.Vector3} v2 三角形第三个顶点
      * @param {THREE.Color} color 三角形颜色
      * @param {number} material 三角形材质类型: 0=镜面, 1=漫反射, 2=光源
      */
     addTriangle(v0, v1, v2, color, material = 1) {
         if (this.triangles.length < this.maxObjects) {
             this.triangles.push({
                 v0: v0,
                 v1: v1,
                 v2: v2,
                 color: color,
                 material: material
             });
             return true;
         }
         return false;
     }
     
     /**
      * 添加金字塔到场景
      * @param {THREE.Vector3} position 金字塔位置
      * @param {number} size 金字塔底面边长
      * @param {number} height 金字塔高度
      * @param {THREE.Color} color 金字塔颜色
      * @param {number} material 金字塔材质类型
      */
     addPyramid(position, size, height, color, material = 1) {
         const halfSize = size / 2;
         
         // 金字塔的五个顶点
         // 底面四个顶点
         const bottomBackLeft = new THREE.Vector3(position.x - halfSize, position.y - height/2, position.z - halfSize);
         const bottomBackRight = new THREE.Vector3(position.x + halfSize, position.y - height/2, position.z - halfSize);
         const bottomFrontRight = new THREE.Vector3(position.x + halfSize, position.y - height/2, position.z + halfSize);
         const bottomFrontLeft = new THREE.Vector3(position.x - halfSize, position.y - height/2, position.z + halfSize);
         // 顶点
         const top = new THREE.Vector3(position.x, position.y - height/2 + height, position.z);
         
         // 底面（两个三角形）
         this.addTriangle(bottomBackLeft, bottomBackRight, bottomFrontRight, color, material);
         this.addTriangle(bottomBackLeft, bottomFrontRight, bottomFrontLeft, color, material);
         
         // 四个侧面
         this.addTriangle(bottomBackLeft, bottomBackRight, top, color, material);   // 后面
         this.addTriangle(bottomBackRight, bottomFrontRight, top, color, material); // 右面
         this.addTriangle(bottomFrontRight, bottomFrontLeft, top, color, material); // 前面
         this.addTriangle(bottomFrontLeft, bottomBackLeft, top, color, material);   // 左面
     }

    /**
     * 添加2D谢尔宾斯基三角形分形到场景
     * @param {THREE.Vector3} position 三角形中心位置
     * @param {number} size 三角形大小
     * @param {THREE.Color} color 三角形颜色
     * @param {number} material 三角形材质类型
     * @param {number} depth 递归深度
     */
    addSierpinskiTriangle2D(position, size, color, material = 1, depth = 5) {
        // 定义一个递归函数来生成谢尔宾斯基三角形的子三角形
        const generateSierpinskiTriangles = (v0, v1, v2, currentDepth) => {
            if (currentDepth === 0) {
                // 添加当前三角形
                this.addTriangle(v0, v1, v2, color, material);
                return;
            }
            
            // 计算三边的中点
            const mid01 = new THREE.Vector3().addVectors(v0, v1).multiplyScalar(0.5);
            const mid12 = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
            const mid20 = new THREE.Vector3().addVectors(v2, v0).multiplyScalar(0.5);
            
            // 递归生成三个子三角形
            generateSierpinskiTriangles(v0, mid01, mid20, currentDepth - 1);
            generateSierpinskiTriangles(mid01, v1, mid12, currentDepth - 1);
            generateSierpinskiTriangles(mid20, mid12, v2, currentDepth - 1);
        };
        
        // 计算等边三角形的三个顶点
        const halfSize = size * 0.5;
        const height = size * Math.sqrt(3) / 2; // 等边三角形的高度
        
        // 顶点
        const top = new THREE.Vector3(position.x, position.y + height / 3, position.z);
        // 左下角
        const bottomLeft = new THREE.Vector3(position.x - halfSize, position.y - height * 2 / 3, position.z);
        // 右下角
        const bottomRight = new THREE.Vector3(position.x + halfSize, position.y - height * 2 / 3, position.z);
        
        // 生成谢尔宾斯基三角形
        generateSierpinskiTriangles(top, bottomLeft, bottomRight, depth);
    }

    // /**
    //  * 添加一个空心（线框）立方体到场景中
    //  * @param {THREE.Vector3} position - 立方体的位置 (x, y, z)
    //  * @param {number | THREE.Vector3} size - 立方体的边长（默认 1）
    //  * @param {THREE.Color | string | number} color - 线框颜色（默认绿色 0x00ff00）
    //  */
    // addWireframeCube(center, size, color) {
    //     if (this.wireframeCubes.length < this.maxObjects) {
    //         this.wireframeCubes.push({
    //             center: center.clone(),
    //             size: size.clone ? size.clone() : new THREE.Vector3(size, size, size),
    //             color: color.clone ? color.clone() : new THREE.Color(color)
    //         });
    //         return true;
    //     }
    //     return false;
    // }



    /**
     * 清除场景中所有对象
     */
    clear() {
        this.spheres = [];
        this.cubes = [];
        this.triangles = [];
    }

    /**
     * 移除指定索引的球体
     * @param {number} index 球体在数组中的索引
     */
    removeSphere(index) {
        if (index >= 0 && index < this.spheres.length) {
            this.spheres.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * 移除指定索引的立方体
     * @param {number} index 立方体在数组中的索引
     */
    removeCube(index) {
        if (index >= 0 && index < this.cubes.length) {
            this.cubes.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * 为场景创建默认对象(地面和几个球体)
     */
    createDefaultScene() {
        this.clear();
        
        // 添加一个金字塔
        this.addPyramid(
            new THREE.Vector3(-5, 0.0, -5.0),  // 位置 (左边)
            1.2,                                // 底面边长
            1.8,                                // 高度
            new THREE.Color('gold'),     // 棕色
            1                                   // 漫反射材质
        );
        
        // 添加一个谢尔宾斯基三角形分形
        this.addSierpinskiTriangle2D(
            new THREE.Vector3(5, 1.0, -6.84),  // 位置 (右边)
            2.0,                                // 大小
            new THREE.Color(1.0, 0.84, 0.0),    // 亮金色
            1,                                  // 漫反射材质
            2                                // 递归深度
        );
        
        // // 几个球体
        // this.addSphere(
        //     new THREE.Vector3(0.0, 0.4, -1.0), 
        //     0.8, 
        //     new THREE.Color(0.5, 1.0, 1.0), 
        //     1
        // );
        
        // this.addSphere(
        //     new THREE.Vector3(1.0, 0.0, -0.5), 
        //     0.3, 
        //     new THREE.Color(1.0, 1.0, 1.0), 
        //     0
        // );
        
        // this.addSphere(
        //     new THREE.Vector3(-0.9, 0.7, -0.8), 
        //     0.15, 
        //     new THREE.Color(1.0, 1.0, 0.0), 
        //     1
        // );
        
        // // 光源
        // this.addSphere(
        //     new THREE.Vector3(1.0, 0.7, 0.0), 
        //     0.1, 
        //     new THREE.Color(1, 0.0, 0.0).multiplyScalar(30.0), 
        //     2
        // );
        
        // this.addSphere(
        //     new THREE.Vector3(-1.0, 0.4, -1.0), 
        //     0.2, 
        //     new THREE.Color(1.0, 0.5, 0.7), 
        //     1
        // );

        // this.addCube(
        //     new THREE.Vector3(0.5, 0.6, -2.5),
        //     new THREE.Vector3(6, 2, 0.05),
        //     new THREE.Color(1.0, 1.0, 1.0), // 玻璃通常用白色或浅色
        //     3  // ← 材质类型设为 3 表示玻璃
        // );


        // 房间
        // 房间 
        // this.addCube(
        //     new THREE.Vector3(0.0, 2, 7),
        //     new THREE.Vector3(14.0, 6, 0.3),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );

        // // 窗户 = 发光面（模拟天光）
        // this.addCube(
        //     new THREE.Vector3(0, 2, -7),
        //     new THREE.Vector3(5, 4, 0.01),
        //     new THREE.Color(1, 1, 1), // 冷白色天光
        //     3 
        // );
        //窗户 = 发光面（模拟天光）
        // this.addCube(
        //     new THREE.Vector3(0, 2, -7),
        //     new THREE.Vector3(5, 4, 0.05),
        //     new THREE.Color(2.0, 2.5, 3.0).multiplyScalar(5.0), // 冷白色天光
        //     2 // 表示光源
        // );

        // this.addCube(
        //     new THREE.Vector3(-5, 2, -7),
        //     new THREE.Vector3(5.0, 6, 0.3),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );
        // this.addCube(
        //     new THREE.Vector3(5, 2, -7),
        //     new THREE.Vector3(5.0, 6, 0.3),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );
        // this.addCube(
        //     new THREE.Vector3(0, 0, -7),
        //     new THREE.Vector3(5, 1.5, 0.3),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );
        // this.addCube(
        //     new THREE.Vector3(0, 4.2, -7),
        //     new THREE.Vector3(5, 1.5, 0.3),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );
        // //

        // //墙
        // this.addCube(
        //     new THREE.Vector3(7, 2, 0),
        //     new THREE.Vector3(0.3, 6, 14),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );
        
        // this.addCube(
        //     new THREE.Vector3(-7, 2, 0),
        //     new THREE.Vector3(0.3, 6, 14),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );

        // //天花板
        // this.addCube(
        //     new THREE.Vector3(0.0, 5, 0),
        //     new THREE.Vector3(14.0, 0.3, 14),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );

        // // //太阳
        // // this.addSphere(
        // //     new THREE.Vector3(0, 3.2, -9),
        // //     0.8,
        // //     new THREE.Color(40.0, 40.0, 40.0),
        // //     2
        // // );

        // //顶灯
        // this.addCube(
        //     new THREE.Vector3(0, 5, 0),
        //     new THREE.Vector3(4, 0.5, 4),
        //     new THREE.Color(1, 1, 1).multiplyScalar(3),
        //     2
        // );

        // //桌子
        // this.addCube(
        //     new THREE.Vector3(0, 0.5, -6),
        //     new THREE.Vector3(6, 0.1, 3),
        //     new THREE.Color(0.3, 0.3, 0.7),
        //     1
        // );
        // //桌腿
        // this.addCube(
        //     new THREE.Vector3(-2.5, 0, -5.0),
        //     new THREE.Vector3(0.2, 1, 0.2),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );
        // //桌腿
        // this.addCube(
        //     new THREE.Vector3(2.5, 0, -5.0),
        //     new THREE.Vector3(0.2, 1, 0.2),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );
        // //椅子
        // this.addCube(
        //     new THREE.Vector3(0, 0.05, -4),
        //     new THREE.Vector3(1.5, 0.1, 1.7),
        //     new THREE.Color(0.4, 0.3, 0.3),
        //     1
        // );
        // //椅子腿
        // this.addCube(
        //     new THREE.Vector3(-0.65, -0.25, -3.3),
        //     new THREE.Vector3(0.2, 0.55, 0.2),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );
        // this.addCube(
        //     new THREE.Vector3(-0.65, -0.25, -4.7),
        //     new THREE.Vector3(0.2, 0.55, 0.2),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );
        // //椅子腿
        // this.addCube(
        //     new THREE.Vector3(0.65, -0.25, -3.3),
        //     new THREE.Vector3(0.2, 0.55, 0.2),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );
        // this.addCube(
        //     new THREE.Vector3(0.65, -0.25, -4.7),
        //     new THREE.Vector3(0.2, 0.55, 0.2),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );
        // //椅子背
        // this.addCube(
        //     new THREE.Vector3(0, 0.7, -3.3),
        //     new THREE.Vector3(1.5, 1.3, 0.2),
        //     new THREE.Color(1, 1, 1),
        //     1
        // );

        // //小灯
        // this.addSphere(
        //     new THREE.Vector3(-2, 0.7, -6.3),
        //     0.2,
        //     new THREE.Color(1, 1, 1).multiplyScalar(3),
        //     2
        // );
        // //
        // this.addCube(
        //     new THREE.Vector3(-2, 0.6, -6.3),
        //     new THREE.Vector3(0.5, 0.1, 0.5),
        //     new THREE.Color(0.1, 0.1, 0.1),
        //     1
        // );

        // //书架
        // this.addCube(
        //     new THREE.Vector3(0, 0, 0),
        //     new THREE.Vector3(2, 2, 2),
        //     new THREE.Color(0.1, 0.1, 0.1),
        //     1
        // );



    }

    /**
     * 将场景数据转换为WebGL可以使用的格式
     * @returns {Object} 包含所有需要的uniform数据的对象
     */
    getUniforms() {
        // 创建用于存储所有球体数据的扁平数组
        const centers = [];
        const radii = [];
        const colors = [];
        const materials = [];
        
        // 填充球体数据数组
        for (let i = 0; i < this.spheres.length; i++) {
            const sphere = this.spheres[i];
            centers.push(sphere.center.x, sphere.center.y, sphere.center.z);
            radii.push(sphere.radius);
            colors.push(sphere.color.r, sphere.color.g, sphere.color.b);
            materials.push(sphere.material);
        }
        
        // 填充剩余位置(确保数组大小固定)
        while (centers.length < this.maxObjects * 3) {
            centers.push(0);
        }
        while (radii.length < this.maxObjects) {
            radii.push(0);
        }
        while (colors.length < this.maxObjects * 3) {
            colors.push(0);
        }
        while (materials.length < this.maxObjects) {
            materials.push(0);
        }
        
        // 创建用于存储所有立方体数据的扁平数组
        const cubeCenters = [];
        const cubeSizes = [];
        const cubeColors = [];
        const cubeMaterials = [];
        
        // 填充立方体数据数组
        for (let i = 0; i < this.cubes.length; i++) {
            const cube = this.cubes[i];
            cubeCenters.push(cube.center.x, cube.center.y, cube.center.z);
            
            cubeSizes.push(cube.size.x, cube.size.y, cube.size.z);
            
            cubeColors.push(cube.color.r, cube.color.g, cube.color.b);
            cubeMaterials.push(cube.material);
        }
        
        // 填充剩余位置(确保数组大小固定)
        while (cubeCenters.length < this.maxObjects * 3) {
            cubeCenters.push(0);
        }
        // 注意这里需要乘以3，因为每个立方体需要3个float值
        while (cubeSizes.length < this.maxObjects * 3) {
            cubeSizes.push(0);
        }
        while (cubeColors.length < this.maxObjects * 3) {
            cubeColors.push(0);
        }
        while (cubeMaterials.length < this.maxObjects) {
            cubeMaterials.push(0);
        }

        // // 创建用于存储所有空心立方体数据的扁平数组
        // const wireframeCubeCenters = [];
        // const wireframeCubeSizes = [];
        // const wireframeCubeColors = [];
        // const wireframeCubeMaterials = [];
        
        // // 填充空心立方体数据数组
        // for (let i = 0; i < this.wireframeCubes.length; i++) {
        //     const cube = this.wireframeCubes[i];
        //     wireframeCubeCenters.push(cube.center.x, cube.center.y, cube.center.z);
            
        //     wireframeCubeSizes.push(cube.size.x, cube.size.y, cube.size.z);
            
        //     wireframeCubeColors.push(cube.color.r, cube.color.g, cube.color.b);
        //     wireframeCubeMaterials.push(cube.material);
        // }
        
        // // 填充剩余位置(确保数组大小固定)
        // while (wireframeCubeCenters.length < this.maxObjects * 3) {
        //     wireframeCubeCenters.push(0);
        // }
        // while (wireframeCubeSizes.length < this.maxObjects * 3) {
        //     wireframeCubeSizes.push(0);
        // }
        // while (wireframeCubeColors.length < this.maxObjects * 3) {
        //     wireframeCubeColors.push(0);
        // }
        // while (wireframeCubeMaterials.length < this.maxObjects) {
        //     wireframeCubeMaterials.push(0);
        // }
        
        // 创建用于存储所有三角形数据的扁平数组
        const triangleVertices = [];
        const triangleColors = [];
        const triangleMaterials = [];
        
        // 填充三角形数据数组
        for (let i = 0; i < this.triangles.length; i++) {
            const triangle = this.triangles[i];
            // 每个三角形有3个顶点，每个顶点有3个坐标值
            triangleVertices.push(triangle.v0.x, triangle.v0.y, triangle.v0.z);
            triangleVertices.push(triangle.v1.x, triangle.v1.y, triangle.v1.z);
            triangleVertices.push(triangle.v2.x, triangle.v2.y, triangle.v2.z);
            
            triangleColors.push(triangle.color.r, triangle.color.g, triangle.color.b);
            triangleMaterials.push(triangle.material);
        }
        
        // 填充剩余位置(确保数组大小固定)
        // 三角形顶点数组需要3倍于三角形数量的3（每个三角形3个顶点，每个顶点3个坐标值）
        while (triangleVertices.length < this.maxObjects * 9) { // 20个三角形 * 3个顶点 * 3个坐标 = 180
            triangleVertices.push(0);
        }
        while (triangleColors.length < this.maxObjects * 3) {
            triangleColors.push(0);
        }
        while (triangleMaterials.length < this.maxObjects) {
            triangleMaterials.push(0);
        }

        
        // 返回uniform数据对象
        return {
            sphereCount: { value: this.spheres.length },
            sphereCenters: { value: new Float32Array(centers) },
            sphereRadii: { value: new Float32Array(radii) },
            sphereColors: { value: new Float32Array(colors) },
            sphereMaterials: { value: new Int32Array(materials) },
            cubeCount: { value: this.cubes.length },
            cubeCenters: { value: new Float32Array(cubeCenters) },
            cubeSizes: { value: new Float32Array(cubeSizes) },
            cubeColors: { value: new Float32Array(cubeColors) },
            cubeMaterials: { value: new Int32Array(cubeMaterials) },
            // wireframeCubeCount: { value: this.wireframeCubes.length },
            // wireframeCubeCenters: { value: new Float32Array(wireframeCubeCenters) },
            // wireframeCubeSizes: { value: new Float32Array(wireframeCubeSizes) },
            // wireframeCubeColors: { value: new Float32Array(wireframeCubeColors) },
            // wireframeCubeMaterials: { value: new Int32Array(wireframeCubeMaterials) },
            // 添加三角形uniform
            triangleCount: { value: this.triangles.length },
            triangleVertices: { value: new Float32Array(triangleVertices) },
            triangleColors: { value: new Float32Array(triangleColors) },
            triangleMaterials: { value: new Int32Array(triangleMaterials) },
            maxObjects: { value: this.maxObjects },
            // 添加平面uniform
            groundPlanePos: { value: this.groundPlane.position },
            groundPlaneNormal: { value: this.groundPlane.normal },
            groundPlaneColor: { value: this.groundPlane.color },
            groundPlaneMaterial: { value: this.groundPlane.material },
            groundPlaneTexture: { value: this.groundPlane.texture },
            groundPlaneTextureScale: { value: this.groundPlane.textureScale },
            groundPlaneSize: { value: this.groundPlane.size }, // 添加地面尺寸uniform

        };
    }
}

// 导出Scene类作为模块
export { Scene };