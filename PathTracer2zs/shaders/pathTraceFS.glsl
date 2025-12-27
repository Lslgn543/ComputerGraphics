uniform vec3 lowerLeftCorner;
uniform vec3 horizontal;
uniform vec3 vertical;
uniform vec3 origin;
uniform vec3 random;
uniform vec2 screenSizeInv;
uniform float ratio;
uniform float corner;
uniform int iteration;

// 场景数据uniform
uniform int sphereCount;
uniform vec3 sphereCenters[20];
uniform float sphereRadii[20];
uniform vec3 sphereColors[20];
uniform int sphereMaterials[20];

// 立方体数据uniform
uniform int cubeCount;
uniform vec3 cubeCenters[20];
uniform vec3 cubeSizes[20];
uniform vec3 cubeColors[20];
uniform int cubeMaterials[20];

// 三角形数据uniform
uniform int triangleCount;
uniform vec3 triangleVertices[60];  // 每个三角形有3个顶点，所以60个vec3可以存储20个三角形
uniform vec3 triangleColors[20];
uniform int triangleMaterials[20];

// 添加平面uniform
uniform vec3 groundPlanePos;
uniform vec3 groundPlaneNormal;
uniform vec3 groundPlaneColor;
uniform int groundPlaneMaterial;
uniform sampler2D groundPlaneTexture;
uniform float groundPlaneTextureScale;
uniform vec2 groundPlaneSize; // 添加地面尺寸uniform

// 在uniform变量部分添加玻璃参数
uniform float glassIOR;  // 玻璃折射率，例如1.5

varying vec3 vUv;

// 光线结构体
struct Ray
{
    vec3 dir;
    vec3 origin;
};

// 球体结构体
struct Sphere
{
    vec3 center;
    float radius;
    vec3 color;
    int mat;
};

// 立方体结构体
struct Cube
{
    vec3 center;
    vec3 size;
    vec3 color;
    int mat;
};

// 三角形结构体
struct Triangle
{
    vec3 v0, v1, v2;  // 三角形的三个顶点
    vec3 color;
    int mat;
};

// 碰撞记录结构体
struct HitRecord
{
    float t;
    vec3 p;
    vec3 normal;
    vec3 albedo;
    int mat;
    vec3 emission; // ← 新增：如果物体是光源，emission > 0
};

// 检测光线与球体相交
bool hitSphere(Sphere s, Ray r, out HitRecord rec) 
{
    vec3 oc = r.origin - s.center;
    float a = dot(r.dir, r.dir);
    float b = dot(oc, r.dir);
    float c = dot(oc, oc) - s.radius*s.radius;
    float discriminant = b*b - a*c;
    if (discriminant > 0.0) {
        float temp = (-b - sqrt(discriminant))/a;
        if (temp < 0.0) 
            return false;
        rec.t = temp;
        rec.p = r.origin + r.dir * rec.t;
        rec.normal = (rec.p - s.center) / s.radius;

        if (s.mat == 2) { // 假设 mat=2 是光源
            rec.emission = s.color;   // 发光颜色（如 vec3(10, 10, 10)）
            rec.albedo = vec3(0.0);   // 光源通常不反射光（或可保留）
        } else {
            rec.emission = vec3(0.0);
            rec.albedo = s.color;
        }

        rec.mat = s.mat;
        return true;
    }
    return false;
}

// 检测光线与立方体相交
bool hitCube(Cube c, Ray r, out HitRecord rec) 
{
    vec3 invDir = 1.0 / r.dir;
    vec3 tMin = (c.center - 0.5*c.size - r.origin) * invDir;
    vec3 tMax = (c.center + 0.5*c.size - r.origin) * invDir;
    
    // 找出每个轴上的最小和最大交点
    vec3 t1 = min(tMin, tMax);
    vec3 t2 = max(tMin, tMax);
    
    // 找出所有交点中的最小和最大值
    float tNear = max(max(t1.x, t1.y), t1.z);
    float tFar = min(min(t2.x, t2.y), t2.z);
    
    // 判断是否有有效交点
    if (tNear > tFar || tNear < 0.0) {
        return false;
    }
    
    rec.t = tNear;
    rec.p = r.origin + r.dir * rec.t;

    //@@
    
    //计算法向量
    vec3 pLocal = rec.p - c.center;
    
    // 确定与哪个面相交 - 找出在tNear值上贡献最大的坐标轴
    vec3 normal = vec3(0.0);
    
    // 计算每个轴的t值贡献度
    bool xAxis = abs(tNear - t1.x) < 0.001;
    bool yAxis = abs(tNear - t1.y) < 0.001 && !xAxis;
    bool zAxis = abs(tNear - t1.z) < 0.001 && !xAxis && !yAxis;
    
    // 设置正确的法线方向
    if (xAxis) {
        normal.x = -sign(r.dir.x);
    } else if (yAxis) {
        normal.y = -sign(r.dir.y);
    } else if (zAxis) {
        normal.z = -sign(r.dir.z);
    }
    
    rec.normal = normal;
    
    //@@


    if (c.mat == 2) { // 假设 mat=2 是光源
        rec.emission = c.color;   // 发光颜色（如 vec3(10, 10, 10)）
        rec.albedo = vec3(0.0);   // 光源通常不反射光（或可保留）
    } else {
        rec.emission = vec3(0.0);
        rec.albedo = c.color;
    }
    rec.mat = c.mat;
    
    return true;
}

// 检测光线与三角形相交 (使用Möller-Trumbore算法)
bool hitTriangle(Triangle t, Ray r, out HitRecord rec) 
{
    vec3 edge1 = t.v1 - t.v0;
    vec3 edge2 = t.v2 - t.v0;
    
    vec3 h = cross(r.dir, edge2);
    float a = dot(edge1, h);
    
    if (a > -0.0001 && a < 0.0001) {
        return false; // 光线与三角形平行
    }
    
    float f = 1.0 / a;
    vec3 s = r.origin - t.v0;
    float u = f * dot(s, h);
    
    if (u < 0.0 || u > 1.0) {
        return false;
    }
    
    vec3 q = cross(s, edge1);
    float v = f * dot(r.dir, q);
    
    if (v < 0.0 || u + v > 1.0) {
        return false;
    }
    
    float t_param = f * dot(edge2, q);
    
    if (t_param > 0.0001) { // t_param > 0 表示交点在光线起点前方
        rec.t = t_param;
        rec.p = r.origin + r.dir * rec.t;
        
        // 计算法向量（使用重心坐标）
        vec3 normal = normalize(cross(edge1, edge2));
        // 确保法线指向光线来源方向
        if (dot(normal, r.dir) > 0.0) {
            normal = -normal; // 翻转法线方向
        }
        rec.normal = normal;
        
        if (t.mat == 2) { // 光源材质
            rec.emission = t.color;
            rec.albedo = vec3(0.0);
        } else {
            rec.emission = vec3(0.0);
            rec.albedo = t.color;
        }
        rec.mat = t.mat;
        
        return true;
    }
    
    return false;
}

// 检测光线与平面相交（更新版本）
bool hitPlane(Ray r, out HitRecord rec) {
    float denom = dot(groundPlaneNormal, r.dir);
    if (abs(denom) < 0.0001) return false; // 光线与平面平行
    
    float t = dot(groundPlanePos - r.origin, groundPlaneNormal) / denom;
    if (t < 0.0001) return false; // 平面在光线后方
    
    rec.t = t;
    rec.p = r.origin + r.dir * t;
    rec.normal = groundPlaneNormal;
    
    // 限制地面大小
    // 创建平面局部坐标系
    vec3 tangent = normalize(cross(groundPlaneNormal, vec3(0.0, 0.0, 1.0)));
    if (length(tangent) < 0.001) {
        tangent = normalize(cross(groundPlaneNormal, vec3(1.0, 0.0, 0.0)));
    }
    vec3 bitangent = cross(groundPlaneNormal, tangent);
    
    // 计算局部坐标
    vec3 localPos = rec.p - groundPlanePos;
    float x = dot(localPos, tangent);
    float z = dot(localPos, bitangent);
    
    // 检查是否在地面范围内
    if (abs(x) > groundPlaneSize.x / 2.0 || abs(z) > groundPlaneSize.y / 2.0) {
        return false; // 超出地面范围
    }
    
    // 计算平面上的纹理坐标
    vec2 texCoord = vec2(x, z) * groundPlaneTextureScale;
    
    // 采样纹理
    vec3 texColor = texture2D(groundPlaneTexture, texCoord).rgb;
    rec.albedo = texColor * groundPlaneColor; // 结合基础颜色
    rec.mat = groundPlaneMaterial;
    
    return true;
}


// @@-
// ========================
// === CSG 椅子：组合立方体 ===
// ========================
bool hitChair(Ray r, vec3 basePos, float chairAngleY, out HitRecord rec)
{
    // 构建绕 Y 轴的旋转矩阵
    float c = cos(chairAngleY);
    float s = sin(chairAngleY);
    mat3 rotY = mat3(
        c, 0.0, -s,
        0.0, 1.0, 0.0,
        s, 0.0, c
    );

    bool hitAny = false;
    HitRecord tempRec;
    rec.t = 1000000.0;

    // 座垫
    {
        Cube c; c.center = basePos + rotY * vec3(0.0, 0.05, 0.0); 
        c.size = vec3(1.5, 0.1, 1.7); 
        c.color = vec3(0.4, 0.3, 0.3); 
        c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hitAny = true; }
    }

    // 靠背
    {
        Cube c; c.center = basePos + rotY * vec3(0.0, 0.7, -0.7); 
        c.size = vec3(1.5, 1.3, 0.2); 
        c.color = vec3(1.0); 
        c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hitAny = true; }
    }

    // 腿（左前）
    {
        Cube c; c.center = basePos + rotY * vec3(-0.65, -0.25, 0.7); 
        c.size = vec3(0.2, 0.55, 0.2); 
        c.color = vec3(1.0); 
        c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hitAny = true; }
    }

    // 腿（左后）
    {
        Cube c; c.center = basePos + rotY * vec3(-0.65, -0.25, -0.7); 
        c.size = vec3(0.2, 0.55, 0.2); 
        c.color = vec3(1.0); 
        c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hitAny = true; }
    }

    // 腿（右前）
    {
        Cube c; c.center = basePos + rotY * vec3(0.65, -0.25, 0.7); 
        c.size = vec3(0.2, 0.55, 0.2); 
        c.color = vec3(1.0); 
        c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hitAny = true; }
    }

    // 腿（右后）
    {
        Cube c; c.center = basePos + rotY * vec3(0.65, -0.25, -0.7); 
        c.size = vec3(0.2, 0.55, 0.2); 
        c.color = vec3(1.0); 
        c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hitAny = true; }
    }

    return hitAny;
}
// -@@

// 检测光线与场景中任何物体相交
bool hitWorld(Ray r, out HitRecord rec)
{
    bool hit = false;
    rec.t = 1000000.0;

    // ==============================
    // === 静态默认场景（硬编码）===
    // ==============================
    // 定义临时记录用于比较最近命中点
    HitRecord tempRec;

    // 后墙
    {
        Cube c; c.center = vec3(0.0, 2.0, 7.0); c.size = vec3(14.0, 6.0, 0.3); c.color = vec3(1.0); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 左侧窗墙（左半）
    {
        Cube c; c.center = vec3(-5.0, 2.0, -7.0); c.size = vec3(5.0, 6.0, 0.3); c.color = vec3(1.0); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 右侧窗墙（右半）
    {
        Cube c; c.center = vec3(5.0, 2.0, -7.0); c.size = vec3(5.0, 6.0, 0.3); c.color = vec3(1.0); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 窗户下方墙
    {
        Cube c; c.center = vec3(0.0, 0.0, -7.0); c.size = vec3(5.0, 1.5, 0.3); c.color = vec3(1.0); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 窗户上方墙
    {
        Cube c; c.center = vec3(0.0, 4.2, -7.0); c.size = vec3(5.0, 1.5, 0.3); c.color = vec3(1.0); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 右墙
    {
        Cube c; c.center = vec3(7.0, 2.0, 0.0); c.size = vec3(0.3, 6.0, 14.0); c.color = vec3(1.0); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 左墙
    {
        Cube c; c.center = vec3(-7.0, 2.0, 0.0); c.size = vec3(0.3, 6.0, 14.0); c.color = vec3(1.0); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 天花板
    {
        Cube c; c.center = vec3(0.0, 5.0, 0.0); c.size = vec3(14.0, 0.3, 14.0); c.color = vec3(1.0); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 顶灯（光源）
    {
        Cube c; c.center = vec3(0.0, 5.0, 0.0); c.size = vec3(4.0, 0.5, 4.0); c.color = vec3(1.0, 1.0, 1.0) * 4.0; c.mat = 2;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 桌子面板
    {
        Cube c; c.center = vec3(0.0, 0.5, -6.0); c.size = vec3(6.0, 0.1, 3.0); c.color = vec3(0.3, 0.3, 0.7); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 桌腿（左前）
    {
        Cube c; c.center = vec3(-2.5, 0.0, -5.0); c.size = vec3(0.2, 1.0, 0.2); c.color = vec3(1.0); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 桌腿（右前）
    {
        Cube c; c.center = vec3(2.5, 0.0, -5.0); c.size = vec3(0.2, 1.0, 0.2); c.color = vec3(1.0); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }


    // 小台灯立方体（光源）
    {
        Cube c; c.center = vec3(-2.0, 0.7, -6.3); c.size = vec3(0.2, 0.2, 0.2); c.color = vec3(3.0, 3.0, 3.0); c.mat = 2;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 小台灯底座
    {
        Cube c; c.center = vec3(-2.0, 0.6, -6.3); c.size = vec3(0.5, 0.1, 0.5); c.color = vec3(0.7, 0.1, 0.1); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 桌子上的玻璃球
    {
        Sphere s; s.center = vec3(0.0, 0.7, -5.0); s.radius = 0.2; s.color = vec3(1.0); s.mat = 3; // 玻璃
        if (hitSphere(s, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }
    {
        Sphere s; s.center = vec3(0.3, 0.65, -6); s.radius = 0.1; s.color = vec3(0.4,0.8,0.3); s.mat = 3; // 玻璃
        if (hitSphere(s, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }
    // 桌子上的反光球
    {
        Sphere s; s.center = vec3(0.1, 0.65, -5.3); s.radius = 0.1; s.color = vec3(1.0); s.mat = 0; // 
        if (hitSphere(s, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }
    // 地板上的篮球
    {
        Sphere s; s.center = vec3(2.5, -0.10, -2.5); s.radius = 0.4; s.color = vec3(0.8, 0.5, 0.0); s.mat = 1; 
        if (hitSphere(s, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 书架
    {
        Cube c; c.center = vec3(-5.7, 1.4, 4); c.size = vec3(2.6, 3.8, 6); c.color = vec3(0.545, 0.271, 0.075); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 窗户（玻璃）
    {
        Cube c; c.center = vec3(0.0, 2.0, -7.0); c.size = vec3(5.0, 4.0, 0.01); c.color = vec3(1.0); c.mat = 3; // 玻璃
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 床
    {
        Cube c; c.center = vec3(2.0, 0.1, 4.0); c.size = vec3(6.0, 0.5, 6.0); c.color = vec3(0.8, 0.3, 0.3); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }
    // 床头
    {
        Cube c; c.center = vec3(6.0, 0.1, 4.0); c.size = vec3(2, 0.5, 6.0); c.color = vec3(1, 1, 1); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }
    // 枕头
    {
        Cube c; c.center = vec3(6.25, 0.4, 4.0); c.size = vec3(1, 0.15, 3.0); c.color = vec3(0.8, 0.8, 0.8); c.mat = 1;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }

    // 床脚
    {
        Cube c; c.center = vec3(-0.5, -0.3, 1.5); c.size = vec3(0.3, 0.5, 0.3); c.color = vec3(1, 1, 1); c.mat = 0;
        if (hitCube(c, r, tempRec) && tempRec.t < rec.t) { rec = tempRec; hit = true; }
    }



    // 检测椅子（传入旋转角度）
    HitRecord chairHit;
    if (hitChair(r, vec3(0.0, 0.0, -4.0), radians(180.0), chairHit) && chairHit.t < rec.t) {
        rec = chairHit;
        hit = true;
    }
    
    // 先检测平面
    HitRecord planeHit;
    if (hitPlane(r, planeHit) && planeHit.t < rec.t) {
        hit = true;
        rec = planeHit;
    }

    // 检测场景中的球体
    for (int i = 0; i < 20; ++i)
    {
        // 如果已经遍历完所有实际球体，跳出循环
        if (i >= sphereCount) break;
        
        // 从uniform数组中创建球体对象
        Sphere sphere;
        sphere.center = sphereCenters[i];
        sphere.radius = sphereRadii[i];
        sphere.color = sphereColors[i];
        sphere.mat = sphereMaterials[i];
        
        HitRecord thisHit;
        bool wasHit = hitSphere(sphere, r, thisHit);
        if (wasHit && thisHit.t < rec.t)
        {
            hit = true;
            rec = thisHit;
        }
    }
    
    // 检测场景中的立方体
    for (int i = 0; i < 20; ++i)
    {
        if (i >= cubeCount) break;
        
        Cube cube;
        cube.center = cubeCenters[i];
        cube.size = cubeSizes[i];
        cube.color = cubeColors[i];
        cube.mat = cubeMaterials[i];
        
        HitRecord thisHit;
        bool wasHit = hitCube(cube, r, thisHit);
        if (wasHit && thisHit.t < rec.t)
        {
            hit = true;
            rec = thisHit;
        }
    }
    
    // 检测场景中的三角形
    for (int i = 0; i < 20; ++i)
    {
        if (i >= triangleCount) break;
        
        Triangle triangle;
        triangle.v0 = triangleVertices[i * 3 + 0];     // 第一个顶点
        triangle.v1 = triangleVertices[i * 3 + 1];     // 第二个顶点
        triangle.v2 = triangleVertices[i * 3 + 2];     // 第三个顶点
        triangle.color = triangleColors[i];
        triangle.mat = triangleMaterials[i];
        
        HitRecord thisHit;
        bool wasHit = hitTriangle(triangle, r, thisHit);
        if (wasHit && thisHit.t < rec.t)
        {
            hit = true;
            rec = thisHit;
        }
    }

    return hit;
}

// 一维随机数生成器
float rand(float n){return fract(sin(n) * 43758.5453123);}

// 二维哈希函数
vec2 hash2(vec2 p)
{
    return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
}

// 在单位球面上生成随机点
vec3 randomPointOnSphere(int it)
{
    vec2 hash = hash2(vUv.xy * random.xy);
    
    float theta = hash.x * 3.14 * 2.0;
    float phi = acos(2.0 * hash.y - 1.0);
    float sinTheta = sin(theta);
    float cosTheta = cos(theta);
    float sinPhi = sin(phi);
    float cosPhi = cos(phi);

    vec3 p = vec3(sinPhi * cosTheta, cosPhi, sinPhi * sinTheta);

    return p;
}

// 在立方体表面上随机采样一个点
vec3 randomPointOnCube(Cube c, int it)
{
    vec2 hash = hash2(vUv.xy * random.xy + float(it) * 0.1);
    
    // 计算立方体各个面的面积
    float areaXY = c.size.x * c.size.y;  // 上下两个面
    float areaXZ = c.size.x * c.size.z;  // 前后两个面
    float areaYZ = c.size.y * c.size.z;  // 左右两个面
    
    // 总表面积（六个面）
    float totalArea = 2.0 * (areaXY + areaXZ + areaYZ);
    
    // 随机选择一个面，基于面积权重
    float randFace = hash.x * totalArea;
    
    vec3 point;
    
    if (randFace < areaXY) {
        // 底面 (z = -size.z/2)
        point = vec3(
            c.center.x + (hash.y - 0.5) * c.size.x,
            c.center.y + (fract(randFace / areaXY) - 0.5) * c.size.y,
            c.center.z - c.size.z * 0.5
        );
    } else if (randFace < 2.0 * areaXY) {
        // 顶面 (z = +size.z/2)
        float localRand = randFace - areaXY;
        point = vec3(
            c.center.x + (hash.y - 0.5) * c.size.x,
            c.center.y + (fract(localRand / areaXY) - 0.5) * c.size.y,
            c.center.z + c.size.z * 0.5
        );
    } else if (randFace < 2.0 * areaXY + areaXZ) {
        // 前面 (y = -size.y/2)
        float localRand = randFace - 2.0 * areaXY;
        point = vec3(
            c.center.x + (hash.y - 0.5) * c.size.x,
            c.center.y - c.size.y * 0.5,
            c.center.z + (fract(localRand / areaXZ) - 0.5) * c.size.z
        );
    } else if (randFace < 2.0 * areaXY + 2.0 * areaXZ) {
        // 后面 (y = +size.y/2)
        float localRand = randFace - 2.0 * areaXY - areaXZ;
        point = vec3(
            c.center.x + (hash.y - 0.5) * c.size.x,
            c.center.y + c.size.y * 0.5,
            c.center.z + (fract(localRand / areaXZ) - 0.5) * c.size.z
        );
    } else if (randFace < 2.0 * areaXY + 2.0 * areaXZ + areaYZ) {
        // 左面 (x = -size.x/2)
        float localRand = randFace - 2.0 * areaXY - 2.0 * areaXZ;
        point = vec3(
            c.center.x - c.size.x * 0.5,
            c.center.y + (hash.y - 0.5) * c.size.y,
            c.center.z + (fract(localRand / areaYZ) - 0.5) * c.size.z
        );
    } else {
        // 右面 (x = +size.x/2)
        float localRand = randFace - 2.0 * areaXY - 2.0 * areaXZ - areaYZ;
        point = vec3(
            c.center.x + c.size.x * 0.5,
            c.center.y + (hash.y - 0.5) * c.size.y,
            c.center.z + (fract(localRand / areaYZ) - 0.5) * c.size.z
        );
    }
    
    return point;
}

// 根据材质类型处理光线反射/散射
Ray material(int mat, Ray r, HitRecord rec, int it, out bool stopTrace)
{
    stopTrace = false;
    Ray rOut;
    rOut.origin = rec.p;
    if (mat == 0) // 镜面反射
    {
        rOut.dir = r.dir - 2.0 * dot(r.dir, rec.normal) * rec.normal;
    }
    else if(mat == 1) // 漫反射
    {
        vec3 target = rec.p + normalize(rec.normal) + randomPointOnSphere(it);
        rOut.dir = normalize(target - rec.p);
    }
    else // 光源
    {
        stopTrace = true;
    }
    
    rOut.origin += rOut.dir * 0.0001;
    return rOut;
}

// 光线追踪主函数，计算光线的最终颜色
vec3 color(Ray r, int it) {
    vec3 L = vec3(0.0);          // 累积辐射度
    vec3 throughput = vec3(1.0); // 路径权重（BRDF * cos / pdf 的累积）

    for (int bounce = 0; bounce < 8; bounce++) {
        HitRecord rec;
        if (!hitWorld(r, rec)) {
            // 射向天空
            vec3 unit_dir = normalize(r.dir);
            float t = 0.5 * (unit_dir.y + 1.0);
            vec3 sky_color = mix(vec3(1.0), vec3(0.5, 0.7, 1.0), t);
            L += throughput * sky_color ;
            break;
        }

        // 1. 如果击中自发光物体，累加其发光
        if (length(rec.emission) > 0.001) {
            L += throughput * rec.emission;
            // 注意：不要 break！继续追踪（支持多光源/焦散等）
        }

        // 2. 【关键】显式采样光源 - 重要性采样
        // 遍历所有球体光源进行采样
        for (int lightIdx = 0; lightIdx < 20; lightIdx++) {
            if (lightIdx >= sphereCount) break;
            
            if (sphereMaterials[lightIdx] != 2) continue; // 不是光源
            
            Sphere lightSphere;
            lightSphere.center = sphereCenters[lightIdx];
            lightSphere.radius = sphereRadii[lightIdx];
            vec3 lightEmission = sphereColors[lightIdx];

            // 在光源球面上随机采样一点 - 重要性采样
            vec3 randDir = randomPointOnSphere(it + bounce + lightIdx * 100);
            vec3 lightPos = lightSphere.center + lightSphere.radius * randDir;

            vec3 wi = lightPos - rec.p;
            float dist2 = dot(wi, wi);
            float dist = sqrt(dist2);
            wi = wi / dist;

            // 阴影测试
            Ray shadowRay;
            shadowRay.origin = rec.p + rec.normal * 0.001;
            shadowRay.dir = wi;
            
            HitRecord shadowRec;
            bool inShadow = false;
            if (hitWorld(shadowRay, shadowRec)) {
                if (shadowRec.t < dist - 0.001) {
                    inShadow = true;
                }
            }

            if (!inShadow) {
                float cosTheta = max(dot(rec.normal, wi), 0.0);
                if (cosTheta > 0.0) {
                    // Lambertian BRDF = albedo / π
                    vec3 brdf = rec.albedo / 3.14159265;
                    // 光源采样的 PDF：立体角 -> 面积转换
                    float lightArea = 4.0 * 3.14159265 * lightSphere.radius * lightSphere.radius;
                    float pdf = dist2 / (lightArea * max(dot(-wi, normalize(lightPos - lightSphere.center)), 0.001));
                    
                    // 为稳定，若 pdf 太小则跳过
                    if (pdf > 0.001) {
                        L += throughput * brdf * lightEmission * cosTheta / pdf;
                    }
                }
            }
        }
        
        // 遍历所有立方体光源进行采样
        for (int lightIdx = 0; lightIdx < 20; lightIdx++) {
            if (lightIdx >= cubeCount) break;
            
            if (cubeMaterials[lightIdx] != 2) continue; // 不是光源
            
            Cube lightCube;
            lightCube.center = cubeCenters[lightIdx];
            lightCube.size = cubeSizes[lightIdx];
            vec3 lightEmission = cubeColors[lightIdx];

            // 在光源立方体表面上随机采样一点 - 重要性采样
            vec3 lightPos = randomPointOnCube(lightCube, it + bounce + lightIdx * 100 + 1000); // 使用不同的种子

            vec3 wi = lightPos - rec.p;
            float dist2 = dot(wi, wi);
            float dist = sqrt(dist2);
            wi = wi / dist;

            // 阴影测试
            Ray shadowRay;
            shadowRay.origin = rec.p + rec.normal * 0.001;
            shadowRay.dir = wi;
            
            HitRecord shadowRec;
            bool inShadow = false;
            if (hitWorld(shadowRay, shadowRec)) {
                if (shadowRec.t < dist - 0.001) {
                    inShadow = true;
                }
            }

            if (!inShadow) {
                float cosTheta = max(dot(rec.normal, wi), 0.0);
                if (cosTheta > 0.0) {
                    // Lambertian BRDF = albedo / π
                    vec3 brdf = rec.albedo / 3.14159265;
                    // 光源采样的 PDF：立体角 -> 面积转换
                    float lightArea = 2.0 * (lightCube.size.x * lightCube.size.y + 
                                             lightCube.size.x * lightCube.size.z + 
                                             lightCube.size.y * lightCube.size.z); // 立方体表面积
                    float pdf = dist2 / (lightArea * max(dot(-wi, normalize(lightPos - lightCube.center)), 0.001));
                    
                    // 为稳定，若 pdf 太小则跳过
                    if (pdf > 0.001) {
                        L += throughput * brdf * lightEmission * cosTheta / pdf;
                    }
                }
            }
        }
        

        // 3. 继续路径：根据材质类型决定如何散射光线
        Ray newRay;
        newRay.origin = rec.p + rec.normal * 0.001;

        if (rec.mat == 0) {
            // === 镜面反射 ===
            newRay.dir = reflect(r.dir, rec.normal);
            throughput *= rec.albedo;

        } else if (rec.mat == 1) {
            // === 漫反射重要性采样 ===
            // 使用余弦加权重要性采样，更符合Lambertian BRDF
            vec3 w = normalize(rec.normal); // 法线方向
            vec3 u = normalize(cross(abs(w.x) < 0.9 ? vec3(1, 0, 0) : vec3(0, 1, 0), w)); // 构建坐标系
            vec3 v = cross(w, u);
            
            // 生成在半球上的随机方向（余弦加权）
            vec2 xi = hash2(vUv.xy + vec2(float(bounce), float(it)));
            float cosTheta = sqrt(xi.x); // cos(θ) = sqrt(ξ1)
            float sinTheta = sqrt(1.0 - xi.x);
            float phi = 2.0 * 3.14159265 * xi.y;
            
            vec3 scatterDir = normalize(u * cos(phi) * sinTheta + 
                                      v * sin(phi) * sinTheta + 
                                      w * cosTheta);
            
            newRay.dir = scatterDir;
            throughput *= rec.albedo; // 余弦加权已内置到采样中，不需要额外乘以cosθ

        } else if (rec.mat == 3) {
            // 折射材质 - 使用菲涅尔反射和折射
            vec3 wo = normalize(r.dir);             // 入射光线方向
            vec3 n = normalize(rec.normal);         // 表面法线

            // 判断光线是从物体外部还是内部射入
            bool outside = dot(wo, n) < 0.0;
            vec3 normal = outside ? n : -n;         // 法线始终指向物体外部
            float etaRatio = outside ? 1.0 / glassIOR : glassIOR;  // 折射率比值

            // 计算反射方向
            vec3 reflected = reflect(wo, normal);
            
            // 计算折射方向
            vec3 refracted = refract(wo, normal, etaRatio);

            // 计算菲涅尔反射系数 (Schlick's approximation)
            float cos_theta = dot(-wo, normal);
            float r0 = (1.0 - glassIOR) / (1.0 + glassIOR);
            r0 = r0 * r0;
            float fresnel = r0 + (1.0 - r0) * pow(1.0 - cos_theta, 5.0);

            // 检查是否能折射（避免全内反射）
            bool canRefract = length(refracted) > 0.001;

            if (canRefract) {
                // 使用菲涅尔系数决定反射或折射的概率
                if (rand(float(it + bounce)) < fresnel) {
                    // 选择反射
                    newRay.dir = reflected;
                } else {
                    // 选择折射
                    newRay.dir = refracted;
                    throughput *= rec.albedo;  // 折射光线穿过物体时保留颜色
                }
            } else {
                // 全内反射 - 只能反射
                newRay.dir = reflected;
            }

            // 偏移起点防止自交
            newRay.origin = rec.p + newRay.dir * 0.001;
            
        } else {
            // 光源或其他终止材质
            break;
        }

        r = newRay;

        // 4. 俄罗斯轮盘赌（避免无限循环）
        float p = max(max(throughput.r, throughput.g), throughput.b);
        if (p < 0.1) {
            // 强制终止
            break;
        }
        if (rand(float(it + bounce)) > p) {
            break;
        }
        throughput /= p;
    }

    return L;
}

// 着色器主入口函数
void main() {
    vec3 col = vec3(0.0);
    const int NUM_SAMPLES = 1;

    for (int i = 0; i < NUM_SAMPLES; ++i) {
        // 生成 [-0.5, 0.5] 的随机偏移
        vec2 jitter = hash2(vUv.xy + vec2(i, iteration)) - 0.5;
        
        // 将偏移转换为 UV 空间的子像素偏移
        vec2 pixelJitter = jitter * screenSizeInv; // 关键：先缩放偏移
        
        // 应用到当前 UV
        vec2 aaUVs = vUv.xy + pixelJitter;

        // 构造光线方向
        vec3 dir = lowerLeftCorner + aaUVs.x * horizontal + aaUVs.y * vertical - origin;
        Ray r;
        r.origin = origin;
        r.dir = normalize(dir);

        col += color(r, i + iteration * NUM_SAMPLES);
    }

    col /= float(NUM_SAMPLES);
    gl_FragColor = vec4(col, 1.0);
}