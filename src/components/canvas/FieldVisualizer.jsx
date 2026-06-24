import React, { useState, useRef, useEffect, useMemo, use } from 'react';
import { useFrame,useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createFieldInstance } from '../util/FieldStrategies';
import {TimeProvider,useTime} from '../util/Time';

// ============================================================================
// 🧱 1. 形状策略库 (Shape Strategies)
// 未来如果要拓展球形场、环形场，直接在这里像拼积木一样添加新的 key 即可！
// ============================================================================
const SHAPE_STRATEGIES = {
  // --- 矩形场策略 ---
  box: {
    // 渲染外框线框
    renderWireframe: (field, color) => {
      const [sx, sy, sz] = field.start;
      const [ex, ey, ez] = field.end;
      const size = [Math.abs(ex - sx), Math.abs(ey - sy), Math.abs(ez - sz)];
      const center = [(sx + ex) / 2, (sy + ey) / 2, (sz + ez) / 2];
      return (
        <mesh position={center}>
          <boxGeometry args={size} />
          <meshBasicMaterial color={color} wireframe={true} transparent opacity={0.15} />
        </mesh>
      );
    },
    // 计算特征长度（用于自适应 LOD 间距）
    getCharLength: (field) => {
      const w = Math.abs(field.end[0] - field.start[0]);
      const h = Math.abs(field.end[1] - field.start[1]);
      const d = Math.abs(field.end[2] - field.start[2]);
      return Math.cbrt(w * h * d);
    },
    // 收集矩形内部所有的采样点
    getSamplePoints: (field, spacing) => {
      const points = [];
      const [sx, sy, sz] = field.start;
      const [ex, ey, ez] = field.end;
      const minX = Math.min(sx, ex), maxX = Math.max(sx, ex);
      const minY = Math.min(sy, ey), maxY = Math.max(sy, ey);
      const minZ = Math.min(sz, ez), maxZ = Math.max(sz, ez);

      const dimX = maxX - minX;
      const dimY = maxY - minY;
      const dimZ = maxZ - minZ;

      //如果有长度为零的情况就不要找点了
      if (dimX === 0 || dimY === 0 || dimZ === 0) {
        return points;
      }
      // 每个轴的间距 = min(全局spacing, 该轴长度)，确保至少塞进 1 层
      // Math.min(spacing, dim) 保证了 offset = spX/2 <= dim，循环必定执行一次
      const spX = Math.min(spacing, dimX);
      const spY = Math.min(spacing, dimY);
      const spZ = Math.min(spacing, dimZ);

      for (let x = minX + spX / 2; x <= maxX; x += spX) {
        for (let y = minY + spY / 2; y <= maxY; y += spY) {
          for (let z = minZ + spZ / 2; z <= maxZ; z += spZ) {
            points.push(new THREE.Vector3(x, y, z));
          }
        }
      }
      return points;
    }
  },

  cylinder: {
    renderWireframe: (field, color) => {
      const [sx, sy, sz] = field.start;
      const [ex, ey, ez] = field.end;
      const center = [(sx + ex) / 2, (sy + ey) / 2, (sz + ez) / 2];
  
      const axisVec = new THREE.Vector3(ex - sx, ey - sy, ez - sz);
      const h = axisVec.length();
      const radius = field.radius || 1;
  
      // 计算从默认 Y 轴旋转到目标轴线所需的四元数
      const defaultAxis = new THREE.Vector3(0, 1, 0);
      const targetAxis = axisVec.clone().normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultAxis, targetAxis);
  
      return (
        <mesh position={center} quaternion={quaternion}>
          <cylinderGeometry args={[radius, radius, h, 16]} />
          <meshBasicMaterial color={color} wireframe={true} transparent opacity={0.15} />
        </mesh>
      );
    },
  
    getCharLength: (field) => {
      const [sx, sy, sz] = field.start;
      const [ex, ey, ez] = field.end;
      const h = Math.sqrt(
        (ex-sx)**2 + (ey-sy)**2 + (ez-sz)**2
      );
      const radius = field.radius || 1;
      return Math.cbrt(Math.PI * radius * radius * h);
    },
  
    getSamplePoints: (field, spacing) => {
      const points = [];
      const start = new THREE.Vector3(...field.start);
      const end   = new THREE.Vector3(...field.end);
      const radius = field.radius || 1;
  
      // ── 轴线单位向量 ──────────────────────────────────────────
      const axis = new THREE.Vector3().subVectors(end, start);
      const h = axis.length();
      const axisUnit = axis.clone().normalize();
      // ── 包围盒（AABB）确定采样范围 ───────────────────────────
      const minX = Math.min(start.x, end.x) - radius;
      const maxX = Math.max(start.x, end.x) + radius;
      const minY = Math.min(start.y, end.y) - radius;
      const maxY = Math.max(start.y, end.y) + radius;
      const minZ = Math.min(start.z, end.z) - radius;
      const maxZ = Math.max(start.z, end.z) + radius;
      if(h==0 || radius==0){
        return points;
    }
      // 径向和轴向分别保底
      // 径向 spacing：不能比直径还大（否则中心那一圈没有点）
      const spRadial = Math.min(spacing, radius * 2);
      // 轴向 spacing：不能比高度还大
      const spAxial  = Math.min(spacing, h);

      // 包围盒步长也用 spRadial（XYZ 全局方向），轴向约束通过投影 t 检查
      for (let x = minX + spRadial / 2; x <= maxX; x += spRadial) {
        for (let y = minY + spRadial / 2; y <= maxY; y += spRadial) {
          for (let z = minZ + spRadial / 2; z <= maxZ; z += spRadial) {
            const p = new THREE.Vector3(x, y, z);
            const v = new THREE.Vector3().subVectors(p, start);
            const t = v.dot(axisUnit);

            // ✅ 轴向保底：用 spAxial 约束 t 的有效范围
            // 等价于：点必须落在 [0, h] 的"轴向格子"里
            const tLayer = Math.floor(t / spAxial) * spAxial + spAxial / 2;
            if (tLayer < 0 || tLayer > h) continue;

            const radialVec = v.clone().addScaledVector(axisUnit, -t);
            if (radialVec.lengthSq() <= radius * radius) {
              // 把点移到对应轴向层的中心（避免斜轴时点位漂移）
              const snappedP = start.clone()
                .addScaledVector(axisUnit, tLayer)
                .add(radialVec);
              points.push(snappedP);
            }
          }
        }
      }
      return points;
    }
  },
  torus: {
    // 线框：用内外两个同轴圆柱叠加，直观表达环形截面
    renderWireframe: (field, color) => {
      const [sx, sy, sz] = field.start;
      const [ex, ey, ez] = field.end;
      const center = [(sx + ex) / 2, (sy + ey) / 2, (sz + ez) / 2];

      const axisVec = new THREE.Vector3(ex - sx, ey - sy, ez - sz);
      const h = axisVec.length();
      const outerRadius = field.radius      || 2;
      const innerRadius = field.innerRadius || 1;

      const defaultAxis = new THREE.Vector3(0, 1, 0);
      const targetAxis  = axisVec.clone().normalize();
      const quaternion  = new THREE.Quaternion().setFromUnitVectors(defaultAxis, targetAxis);

      return (
        (innerRadius<outerRadius) &&(<group position={center} quaternion={quaternion}>
          {/* 外壁圆柱 */}
          <mesh>
            <cylinderGeometry args={[outerRadius, outerRadius, h, 32]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.15} />
          </mesh>
          {/* 内壁圆柱 */}
          <mesh>
            <cylinderGeometry args={[innerRadius, innerRadius, h, 32]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.15} />
          </mesh>
        </group>) 
      );
    },

    // 特征长度：环形体积开立方（体积 = π(ro² - ri²) × h）
    getCharLength: (field) => {
      const [sx, sy, sz] = field.start;
      const [ex, ey, ez] = field.end;
      const h  = Math.sqrt((ex-sx)**2 + (ey-sy)**2 + (ez-sz)**2);
      const ro = field.radius      || 2;
      const ri = field.innerRadius || 1;
      return Math.cbrt(Math.PI * (ro * ro - ri * ri) * h);
    },

    // 采样点：包围盒三重循环 + 轴向层对齐 + 环形径向双重过滤
    getSamplePoints: (field, spacing) => {
      const points = [];
      const start = new THREE.Vector3(...field.start);
      const end   = new THREE.Vector3(...field.end);
      const outerRadius = field.radius      || 2;
      const innerRadius = field.innerRadius || 1;

      const axis     = new THREE.Vector3().subVectors(end, start);
      const h        = axis.length();
      const axisUnit = axis.clone().normalize();

      if (h === 0 || outerRadius <= 0 || innerRadius >= outerRadius) return points;

      // 包围盒以外径为扩展边界
      const minX = Math.min(start.x, end.x) - outerRadius;
      const maxX = Math.max(start.x, end.x) + outerRadius;
      const minY = Math.min(start.y, end.y) - outerRadius;
      const maxY = Math.max(start.y, end.y) + outerRadius;
      const minZ = Math.min(start.z, end.z) - outerRadius;
      const maxZ = Math.max(start.z, end.z) + outerRadius;

      // 径向 spacing 保底：不超过环形宽度，否则整个环里没有点
      const ringWidth = outerRadius - innerRadius;
      const spRadial  = Math.min(spacing, ringWidth);
      const spAxial   = Math.min(spacing, h);

      const outerRadiusSq = outerRadius * outerRadius;
      const innerRadiusSq = innerRadius * innerRadius;

      // 预分配临时向量，避免循环内 new
      const p         = new THREE.Vector3();
      const v         = new THREE.Vector3();
      const radialVec = new THREE.Vector3();

      for (let x = minX + spRadial / 2; x <= maxX; x += spRadial) {
        for (let y = minY + spRadial / 2; y <= maxY; y += spRadial) {
          for (let z = minZ + spRadial / 2; z <= maxZ; z += spRadial) {
            p.set(x, y, z);
            v.subVectors(p, start);
            const t = v.dot(axisUnit);

            // 轴向层对齐（与 cylinder 策略保持一致）
            const tLayer = Math.floor(t / spAxial) * spAxial + spAxial / 2;
            if (tLayer < 0 || tLayer > h) continue;

            // 径向向量 = v - t * axisUnit（垂直于轴线的分量）
            radialVec.copy(v).addScaledVector(axisUnit, -t);
            const rSq = radialVec.lengthSq();

            // 环形判定：innerRadius < r < outerRadius
            if (rSq > innerRadiusSq && rSq < outerRadiusSq) {
              // 对齐到轴向层中心，保持径向偏移不变
              const snappedP = start.clone()
                .addScaledVector(axisUnit, tLayer)
                .add(radialVec);
              points.push(snappedP);
            }
          }
        }
      }
      return points;
    }
  }
};


function FieldArrow({ position, field, type, color}) {
  const fieldInstance = useMemo(() => createFieldInstance(field), [field]);

  // ─── imperative refs，直接指向 Three.js 对象 ──────────────────────────────
  const groupRef    = useRef();   // 整个箭头 group（控制旋转）
  const cylRef      = useRef();   // 圆柱 mesh（控制缩放 / 位移）
  const coneRef     = useRef();   // 圆锥 mesh（控制位移）
  const cylGeoRef   = useRef();   // 圆柱几何体（需要重建 args）
  const coneGeoRef  = useRef();   // 圆锥几何体（需要重建 args）

  // ─── 工作用临时对象，避免每帧 new ────────────────────────────────────────
  const _vec  = useRef(new THREE.Vector3());
  const _base = useRef(new THREE.Vector3(0, 1, 0));
  const _quat = useRef(new THREE.Quaternion());
  const _dir  = useRef(new THREE.Vector3(0, 1, 0));

  // ─── 上一帧缓存，只在值真正变化时才重建几何体 ─────────────────────────────
  const _prevTotalLength = useRef(-1);
  const { accTime } = useTime();
  useFrame(({ clock },delta) => {
    
    
    if (!fieldInstance || !groupRef.current) return;

    // 1. 从物理实例获取当前时刻的场向量（已包含正弦/方波调制和正负值）
    fieldInstance.getVector(position, accTime.current, _vec.current);

    const signedMag = _vec.current.length() * (
      // 保留符号：用场向量与方向向量的点积判断正负
      // 若场向量接近零向量则视为正
      _vec.current.lengthSq() < 1e-10 ? 1 : 1
    );

    // 更精确的有符号幅度：直接从原始场向量推导
    // fieldInstance.getVector 返回的是物理向量，长度本身就是幅度（正弦可为负）
    // 对于正弦场，向量可能反向，magnitude 取有符号值：
    const rawLength = _vec.current.length();
    // 判断当前场向量是否与"基准方向"同向，以决定符号
    // 基准方向 = 上一帧的方向（或初始方向）
    const dot = _vec.current.dot(_dir.current);
    const sign = (rawLength < 1e-10) ? 1 : (dot >= 0 ? 1 : -1);
    const absMag = rawLength;

    // 2. 更新方向（仅在向量非零时）
    
    _dir.current.copy(_vec.current).normalize();
    
    // 当 sign < 0 时，让方向向量反向，使箭头真实朝反方向
    const visualDir = _dir.current.clone().multiplyScalar(sign);

    // 3. 计算四元数旋转：每帧 imperative 更新 group.quaternion
    _quat.current.setFromUnitVectors(_base.current, visualDir);
    groupRef.current.quaternion.copy(_quat.current);

    // 4. 计算几何尺寸
    const totalLength = Math.min(Math.max(0.4, absMag / 10), 5);
    const cylHeight   = totalLength - 0.2;
    const coneY       = cylHeight / 2 + 0.1; // 圆锥底面中心 = 杆顶

    // 5. 只在尺寸真正变化时才重建几何体（避免每帧 GC 压力）
    if (Math.abs(totalLength - _prevTotalLength.current) > 0.0001) {
      _prevTotalLength.current = totalLength;

      // 重建圆柱几何体
      if (cylGeoRef.current) {
        cylGeoRef.current.dispose();
        const geo = new THREE.CylinderGeometry(0.02, 0.02, cylHeight, 8);
        cylGeoRef.current = geo;
        if (cylRef.current) cylRef.current.geometry = geo;
      }

      // 重建圆锥几何体
      if (coneGeoRef.current) {
        coneGeoRef.current.dispose();
        const geo = new THREE.ConeGeometry(0.1, 0.2, 8);
        coneGeoRef.current = geo;
        if (coneRef.current) coneRef.current.geometry = geo;
      }
    }

    // 6. 更新 mesh position（圆柱居中，圆锥在杆顶）
    if (cylRef.current)  cylRef.current.position.y  = 0;
    if (coneRef.current) coneRef.current.position.y = coneY;
  });

  return (
    <group ref={groupRef} position={position.toArray()}>
      {/* 圆柱杆 */}
      <mesh ref={cylRef}>
        <cylinderGeometry
          ref={cylGeoRef}
          args={[0.02, 0.02, 0.2, 8]}  // 初始占位尺寸，useFrame 会立即接管
        />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* 圆锥头 */}
      <mesh ref={coneRef}>
        <coneGeometry
          ref={coneGeoRef}
          args={[0.1, 0.2, 8]}
        />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
  
}
export default function FieldVisualizer({ field, type, renderTrigger}) {
   const color = type === 'E' ? '#4facfe' : '#ff4b4b';
   const { camera } = useThree();

  // 🎯 动态路由：根据数据里的 shape 匹配策略，如果没有匹配上（比如乱打的字）自动降级退回 box
  const strategy = SHAPE_STRATEGIES[field.shape] || SHAPE_STRATEGIES.box;

  // 这里的 useMemo 专门负责处理自适应空间采样与性能裁剪 (LOD)
  const visibleArrowPositions = useMemo(() => {
    const charLength = strategy.getCharLength(field);
    const spacing = Math.max(1, Math.min(10, charLength * 0.2));
    
    // 模块化调用：获取特定形状内部的坐标点
    const allPoints = strategy.getSamplePoints(field, spacing);
    
    // 获取相机世界坐标
    const cax = camera.position.x;
    const cay = camera.position.y;
    const caz = camera.position.z;
    
    // 距离排序：离眼睛近的优先画
    const sortedPoints = allPoints.map(pos => ({
      pos,
      dist: Math.hypot(pos.x - cax, pos.y - cay, pos.z - caz)
    })).sort((a, b) => a.dist - b.dist);

    // 预算裁剪：死死卡住最大只画 300 个箭头，防止极端情况下电脑卡死
    const MAX_RENDER_COUNT = 300;
    return sortedPoints.slice(0, MAX_RENDER_COUNT).map(item => item.pos);
  }, [field, camera, renderTrigger, strategy]);

  if (!field.visible || field.magnitude === 0) return null; //必须在一堆use的hook之后才能返回
  return (
    <group>
      {/* 🧩 模块化渲染 1：画外框线框 */}
      {strategy.renderWireframe(field, color)}

      {/* 🧩 模块化渲染 2：循环批量画箭头 */}
      
      {visibleArrowPositions.map((pos, idx) => (
        <FieldArrow 
          key={`${field.id}-arrow-${idx}`} 
          position={pos} 
          field={field} 
          type={type} 
          color={color} 
          
        />
      ))}
      
    </group>
  );
}