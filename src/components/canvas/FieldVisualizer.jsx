import React, { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
// 固定密度的动态场强渲染器
export default function FieldVisualizer({ field, type ,renderTrigger}) {
  if (!field.visible || field.magnitude === 0) return null; // 如果隐身或场强为0，直接不画

  const color = type === 'E' ? '#4facfe' : '#ff4b4b';
  const { camera } = useThree();
  const { center, size, arrows, cylHeight, coneY } = useMemo(() => {
    const [sx, sy, sz] = field.start;
    const [ex, ey, ez] = field.end;
    
    // 计算包围盒中心和尺寸
    const cx = (sx + ex) / 2;
    const cy = (sy + ey) / 2;
    const cz = (sz + ez) / 2;
    const width = Math.abs(ex - sx);
    const height = Math.abs(ey - sy);
    const depth = Math.abs(ez - sz);

    const mag = Math.abs(field.magnitude);
    const totalLength = Math.min(Math.max(0.4, mag / 10), 5); 
    const cHeight = totalLength - 0.2; 
    const cY = cHeight / 2;

    const tempArrows = []; // 临时数组，用来存储带距离信息的对象
    
    const minX = Math.min(sx, ex), maxX = Math.max(sx, ex);
    const minY = Math.min(sy, ey), maxY = Math.max(sy, ey);
    const minZ = Math.min(sz, ez), maxZ = Math.max(sz, ez);

    const maxRenderRadius = 20;
    const cax = camera.position.x;
    const cay = camera.position.y;
    const caz = camera.position.z;

    // ==========================================
    // 🌟 核心升级：基于体积的自适应空间采样率 (Adaptive LOD)
    // ==========================================
    
    // 1. 防御性运算：如果场域被压成了一个 2D 平面(比如高度为0)，体积会变成0。
    // 强制给每个维度最低 1 个单位的厚度，防止黑洞产生。
    const safeW = Math.max(1, width);
    const safeH = Math.max(1, height);
    const safeD = Math.max(1, depth);
    const volume = safeW * safeH * safeD;

    // 2. 降维打击：将 3D 的体积开立方根，得到 1D 的“特征长度”
    const charLength = Math.cbrt(volume);

    // 3. 动态映射与截断 (Clamp)
    // 假设设定：一个 8x8x8 的常规空间 (charLength=8)，我们希望 SPACING 是 2。
    // 那么系数就是 2 / 8 = 0.25。
    // 当空间极其巨大，变成 80x80x80 时，SPACING 会平滑过渡到 20。
    // 最后用 Math.max 和 Math.min 把结果死死卡在 2 到 20 之间。
    const SPACING = Math.max(2, Math.min(20, charLength * 0.25));
    
    const MAX_RENDER_COUNT = 300;
    // 🌟 2. 暴力但极其快速地收集当前场区内所有的网格点
    for (let x = minX + SPACING / 2; x <= maxX; x += SPACING) {
        for (let y = minY + SPACING / 2; y <= maxY; y += SPACING) {
          for (let z = minZ + SPACING / 2; z <= maxZ; z += SPACING) {
            const distToCamera = Math.hypot(x - cax, y - cay, z - caz);
            tempArrows.push({ pos: [x, y, z], dist: distToCamera });
          }
        }
      }
  
      // 🌟 3. 灵魂一步：按距离由近及远精确排序
      tempArrows.sort((a, b) => a.dist - b.dist);
  
      // 🌟 4. 预算截断：无论刚才收集了五千还是五万个点，我只切取排在最前面的 300 个！
      const arrowPositions = tempArrows.slice(0, MAX_RENDER_COUNT).map(item => item.pos);
      return { 
        center: [cx, cy, cz], 
        size: [width, height, depth], 
        arrows: arrowPositions,
        cylHeight: cHeight,
        coneY: cY
      };
  }, [field.start, field.end, field.magnitude, camera, renderTrigger]);

  // 将角度转为弧度
  const rotX = THREE.MathUtils.degToRad(field.rotation[0]);
  const rotY = THREE.MathUtils.degToRad(field.rotation[1]);
  const rotZ = THREE.MathUtils.degToRad(field.rotation[2]);

  return (
    <group>
      {/* 渲染淡彩色的边界框 (线框) */}
      <mesh position={center}>
        <boxGeometry args={size} />
        <meshBasicMaterial color={color} wireframe={true} transparent opacity={0.2} />
      </mesh>

      {/* 批量渲染场内的方向箭头 */}
      {arrows.map((pos, idx) => (
        <group key={idx} position={pos} rotation={[rotX, rotY, rotZ]}>
          
          {/* 动态长度的圆柱杆，y轴永远固定在 -0.1 */}
          <mesh position={[0, -0.1, 0]}>
             <cylinderGeometry args={[0.02, 0.02, cylHeight]} />
             <meshBasicMaterial color={color} />
          </mesh>

          {/* 动态位移的圆锥头，完美盖在圆柱顶部 */}
          <mesh position={[0, coneY, 0]}>
             <coneGeometry args={[0.1, 0.2]} />
             <meshBasicMaterial color={color} />
          </mesh>

        </group>
      ))}
    </group>
  );
}