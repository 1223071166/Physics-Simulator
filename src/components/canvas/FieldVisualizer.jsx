import React, { useState, useRef, useEffect, useMemo, use } from 'react';
import { useFrame,useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createFieldInstance } from '../utils/FieldStrategies';
import {TimeProvider,useTime} from '../utils/Time';
const SHAPE_STRATEGIES = {
  // --- 矩形场策略 ---
box: {
    renderWireframe: (field, color, cameraPosition) => {
    const [sx, sy, sz] = field.start;
    const [ex, ey, ez] = field.end;

    const isInfX = field.is_infinite?.[0] ?? false;
    const isInfY = field.is_infinite?.[1] ?? false;
    const isInfZ = field.is_infinite?.[2] ?? false;

    const HALF_EXTENT = 500;
    const camX = cameraPosition?.x ?? 0;
    const camY = cameraPosition?.y ?? 0;
    const camZ = cameraPosition?.z ?? 0;

    // 无限轴：用摄像头坐标 ±1000 替换；有限轴：保持原始 start/end
    const resolvedMinX = isInfX ? camX - HALF_EXTENT : Math.min(sx, ex);
    const resolvedMaxX = isInfX ? camX + HALF_EXTENT : Math.max(sx, ex);
    const resolvedMinY = isInfY ? camY - HALF_EXTENT : Math.min(sy, ey);
    const resolvedMaxY = isInfY ? camY + HALF_EXTENT : Math.max(sy, ey);
    const resolvedMinZ = isInfZ ? camZ - HALF_EXTENT : Math.min(sz, ez);
    const resolvedMaxZ = isInfZ ? camZ + HALF_EXTENT : Math.max(sz, ez);

    const size = [
      resolvedMaxX - resolvedMinX,
      resolvedMaxY - resolvedMinY,
      resolvedMaxZ - resolvedMinZ,
    ];
    const center = [
      (resolvedMinX + resolvedMaxX) / 2,
      (resolvedMinY + resolvedMaxY) / 2,
      (resolvedMinZ + resolvedMaxZ) / 2,
    ];

    return (
      <mesh position={center}>
        <boxGeometry args={size} />
        <meshBasicMaterial color={color} wireframe={true} transparent opacity={0.15} />
      </mesh>
    );
  },

    getCharLength: (field) => {
      if(field.is_infinite[0]||field.is_infinite[1]||field.is_infinite[2])
        return 9999;
      const w = Math.abs(field.end[0] - field.start[0]);
      const h = Math.abs(field.end[1] - field.start[1]);
      const d = Math.abs(field.end[2] - field.start[2]);
      return Math.cbrt(w * h * d);
    },

    //判断点 (x, y, z) 是否在矩形场内
    containsPoint: (field, x, y, z) => {
      const minX = Math.min(field.start[0], field.end[0]);
      const maxX = Math.max(field.start[0], field.end[0]);
      const minY = Math.min(field.start[1], field.end[1]);
      const maxY = Math.max(field.start[1], field.end[1]);
      const minZ = Math.min(field.start[2], field.end[2]);
      const maxZ = Math.max(field.start[2], field.end[2]);
      return x >= minX && x <= maxX &&
             y >= minY && y <= maxY &&
             z >= minZ && z <= maxZ;
    },

    
    getSamplePoints: (field, spacing, cameraPosition, maxRenderCount) => {
    const points = [];
    const [sx, sy, sz] = field.start;
    const [ex, ey, ez] = field.end;

    const isInfX = field.is_infinite?.[0] ?? false;
    const isInfY = field.is_infinite?.[1] ?? false;
    const isInfZ = field.is_infinite?.[2] ?? false;

    // ── 有限轴：沿用原有逻辑 ──────────────────────────────────────
    const minX = Math.min(sx, ex), maxX = Math.max(sx, ex);
    const minY = Math.min(sy, ey), maxY = Math.max(sy, ey);
    const minZ = Math.min(sz, ez), maxZ = Math.max(sz, ez);

    const dimX = maxX - minX;
    const dimY = maxY - minY;
    const dimZ = maxZ - minZ;

    // 有限轴维度为 0 时跳过（无限轴不受此限制）
    if ((!isInfX && dimX === 0) ||
        (!isInfY && dimY === 0) ||
        (!isInfZ && dimZ === 0)) return points;

    const spX = isInfX ? spacing : Math.min(spacing, dimX);
    const spY = isInfY ? spacing : Math.min(spacing, dimY);
    const spZ = isInfZ ? spacing : Math.min(spacing, dimZ);

    // ── 无限轴：以摄像头投影坐标为中心，向两侧扩展 ───────────────
    //
    // 策略：从 maxRenderCount 反推"需要多少层半径"。
    //
    // 设三轴层数分别为 nX, nY, nZ，则总候选点数 ≈ nX * nY * nZ。
    // 为了让排序后能稳定取到 maxRenderCount 个，候选池至少是目标的 ~2 倍。
    // 这里用 cbrt(maxRenderCount * 2) 作为每轴的"半扩展层数"，
    // 有限轴的层数由其真实维度决定，无限轴才用这个估算值。
    const count = maxRenderCount ?? 512;
    const halfLayers = Math.ceil(Math.cbrt(count * 2));

    // 有限轴：直接用 [min, max]
    // 无限轴：以摄像头在该轴上的坐标为中心，向两侧各扩展 halfLayers 个间距
    const camX = cameraPosition?.x ?? 0;
    const camY = cameraPosition?.y ?? 0;
    const camZ = cameraPosition?.z ?? 0;

    // 将摄像头坐标对齐到最近的 spacing 格点，再向两侧扩展
    const snapToGrid = (camCoord, sp) =>
      Math.round(camCoord / sp) * sp;

    const centerX = snapToGrid(camX, spX);
    const centerY = snapToGrid(camY, spY);
    const centerZ = snapToGrid(camZ, spZ);

    const loX = isInfX ? centerX - halfLayers * spX : minX + spX / 2;
    const hiX = isInfX ? centerX + halfLayers * spX : maxX;
    const loY = isInfY ? centerY - halfLayers * spY : minY + spY / 2;
    const hiY = isInfY ? centerY + halfLayers * spY : maxY;
    const loZ = isInfZ ? centerZ - halfLayers * spZ : minZ + spZ / 2;
    const hiZ = isInfZ ? centerZ + halfLayers * spZ : maxZ;

    // 有限轴起点已内嵌 +sp/2 偏移（原逻辑），无限轴格点本身就是采样中心
    const stepX = (x) => isInfX ? x : x; // 起点已处理，循环写法统一
    
    for (let x = loX; x <= hiX; x += spX) {
      // 有限轴额外检查边界（防止浮点误差越界）
      if (!isInfX && (x < minX || x > maxX)) continue;

      for (let y = loY; y <= hiY; y += spY) {
        if (!isInfY && (y < minY || y > maxY)) continue;

        for (let z = loZ; z <= hiZ; z += spZ) {
          if (!isInfZ && (z < minZ || z > maxZ)) continue;

          points.push(new THREE.Vector3(x, y, z));
        }
      }
    }

    // 按距摄像头由近及远排序，返回前 maxRenderCount 个
    return sortAndSlice(points, cameraPosition, maxRenderCount);
  }
},
cylinder: {
  renderWireframe: (field, color, cameraPosition) => {
    const [sx, sy, sz] = field.start;
    const [ex, ey, ez] = field.end;
    const radius = field.radius || 1;

    const isInfAxis   = field.is_infinite?.[0] ?? false;
    const isInfRadius = field.is_infinite?.[1] ?? false;

    const HALF_EXTENT = 500;

    const axisVec = new THREE.Vector3(ex - sx, ey - sy, ez - sz);
    const axisUnit = axisVec.clone().normalize();

    // ── 轴向无限：将 start/end 沿轴线方向各延伸 HALF_EXTENT ──
    // 以原始中点为基准，沿轴单位向量两侧各推 HALF_EXTENT
    const origCenter = new THREE.Vector3(
      (sx + ex) / 2, (sy + ey) / 2, (sz + ez) / 2
    );
    const resolvedH = isInfAxis
      ? HALF_EXTENT * 2
      : axisVec.length();

    // 轴向无限时中心跟随摄像头在轴线上的投影，让线框始终套住视角
    let center;
    if (isInfAxis && cameraPosition) {
      const cam = new THREE.Vector3(
        cameraPosition.x, cameraPosition.y, cameraPosition.z
      );
      // 摄像头投影到轴线上的标量 t，以原始 start 为原点
      const startVec = new THREE.Vector3(sx, sy, sz);
      const t = cam.clone().sub(startVec).dot(axisUnit);
      // 中心 = start + t * axisUnit（沿轴跟随摄像头）
      center = startVec.clone().addScaledVector(axisUnit, t).toArray();
    } else {
      center = origCenter.toArray();
    }

    // ── 径向无限：渲染半径改用一个足够大的值 ──
    const resolvedRadius = isInfRadius ? HALF_EXTENT : radius;

    const defaultAxis = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion()
      .setFromUnitVectors(defaultAxis, axisUnit);

    return (
      <mesh position={center} quaternion={quaternion}>
        <cylinderGeometry args={[resolvedRadius, resolvedRadius, resolvedH, 16]} />
        <meshBasicMaterial color={color} wireframe={true} transparent opacity={0.15} />
      </mesh>
    );
  },

  getCharLength: (field) => {
    if (field.is_infinite?.[0] || field.is_infinite?.[1]) return 9999;
    const [sx, sy, sz] = field.start;
    const [ex, ey, ez] = field.end;
    const h = Math.sqrt((ex-sx)**2 + (ey-sy)**2 + (ez-sz)**2);
    const radius = field.radius || 1;
    return Math.cbrt(Math.PI * radius * radius * h);
  },

  containsPoint: (field, x, y, z) => {
    const start = new THREE.Vector3(...field.start);
    const end   = new THREE.Vector3(...field.end);
    const radius = field.radius || 1;
    const isInfAxis   = field.is_infinite?.[0] ?? false;
    const isInfRadius = field.is_infinite?.[1] ?? false;

    const axis = new THREE.Vector3().subVectors(end, start);
    const h = axis.length();
    if (h === 0 || radius === 0) return false;
    const axisUnit = axis.clone().normalize();
    const v = new THREE.Vector3(x, y, z).sub(start);
    const t = v.dot(axisUnit);

    // 轴向无限：不检查 t 范围
    if (!isInfAxis && (t < 0 || t > h)) return false;

    const radialVec = v.clone().addScaledVector(axisUnit, -t);

    // 径向无限：不检查半径
    if (isInfRadius) return true;
    return radialVec.lengthSq() <= radius * radius;
  },

  getSamplePoints: (field, spacing, cameraPosition, maxRenderCount) => {
    const points = [];
    const start = new THREE.Vector3(...field.start);
    const end   = new THREE.Vector3(...field.end);
    const radius = field.radius || 1;

    const isInfAxis   = field.is_infinite?.[0] ?? false;
    const isInfRadius = field.is_infinite?.[1] ?? false;

    const axis = new THREE.Vector3().subVectors(end, start);
    const h = axis.length();
    const axisUnit = axis.clone().normalize();

    if (h === 0 || radius === 0) return points;

    const count = maxRenderCount ?? 512;
    const halfLayers = Math.ceil(Math.cbrt(count * 2));

    const camX = cameraPosition?.x ?? 0;
    const camY = cameraPosition?.y ?? 0;
    const camZ = cameraPosition?.z ?? 0;
    const cam = new THREE.Vector3(camX, camY, camZ);

    const spRadial = Math.min(spacing, isInfRadius ? spacing : radius * 2);
    const spAxial  = Math.min(spacing, h);

    // ── 径向采样范围 ──
    // 径向无限：以摄像头投影到截面上的点为中心扩展
    // 径向有限：沿用原包围盒逻辑
    const resolvedRadius = isInfRadius ? halfLayers * spRadial : radius;

    const minX = Math.min(start.x, end.x) - resolvedRadius;
    const maxX = Math.max(start.x, end.x) + resolvedRadius;
    const minY = Math.min(start.y, end.y) - resolvedRadius;
    const maxY = Math.max(start.y, end.y) + resolvedRadius;
    const minZ = Math.min(start.z, end.z) - resolvedRadius;
    const maxZ = Math.max(start.z, end.z) + resolvedRadius;

    // ── 轴向采样范围 ──
    // 轴向无限：以摄像头在轴线的投影为中心，向两侧扩展 halfLayers 层
    const snapToGrid = (v, sp) => Math.round(v / sp) * sp;

    let axialLo, axialHi, axialCenter;
    if (isInfAxis) {
      // 摄像头在轴线上的投影 t 值
      const tCam = cam.clone().sub(start).dot(axisUnit);
      const tSnapped = snapToGrid(tCam, spAxial);
      axialLo = tSnapped - halfLayers * spAxial;
      axialHi = tSnapped + halfLayers * spAxial;
    }

    for (let x = minX + spRadial / 2; x <= maxX; x += spRadial) {
      for (let y = minY + spRadial / 2; y <= maxY; y += spRadial) {
        for (let z = minZ + spRadial / 2; z <= maxZ; z += spRadial) {
          const p = new THREE.Vector3(x, y, z);
          const v = new THREE.Vector3().subVectors(p, start);
          const t = v.dot(axisUnit);

          // ── 轴向判定 ──
          if (isInfAxis) {
            // 轴向层对齐（同有限情形）
            const tLayer = Math.floor((t - axialLo) / spAxial) * spAxial + axialLo + spAxial / 2;
            if (tLayer < axialLo || tLayer > axialHi) continue;

            const radialVec = v.clone().addScaledVector(axisUnit, -t);
            const inRadius = isInfRadius
              ? true
              : radialVec.lengthSq() <= radius * radius;

            if (inRadius) {
              const snappedP = start.clone()
                .addScaledVector(axisUnit, tLayer)
                .add(radialVec);
              points.push(snappedP);
            }
          } else {
            const tLayer = Math.floor(t / spAxial) * spAxial + spAxial / 2;
            if (tLayer < 0 || tLayer > h) continue;

            const radialVec = v.clone().addScaledVector(axisUnit, -t);
            const inRadius = isInfRadius
              ? true
              : radialVec.lengthSq() <= radius * radius;

            if (inRadius) {
              const snappedP = start.clone()
                .addScaledVector(axisUnit, tLayer)
                .add(radialVec);
              points.push(snappedP);
            }
          }
        }
      }
    }

    return sortAndSlice(points, cameraPosition, maxRenderCount);
  }
},

torus: {
  renderWireframe: (field, color, cameraPosition) => {
    const [sx, sy, sz] = field.start;
    const [ex, ey, ez] = field.end;
    const outerRadius = field.radius      || 2;
    const innerRadius = field.innerRadius || 1;
    if (innerRadius >= outerRadius) return null;

    const isInfAxis = field.is_infinite?.[0] ?? false;
    const HALF_EXTENT = 500;

    const axisVec  = new THREE.Vector3(ex - sx, ey - sy, ez - sz);
    const axisUnit = axisVec.clone().normalize();

    const resolvedH = isInfAxis ? HALF_EXTENT * 2 : axisVec.length();

    // 轴向无限时中心沿轴跟随摄像头，与 cylinder 处理方式一致
    let center;
    if (isInfAxis && cameraPosition) {
      const startVec = new THREE.Vector3(sx, sy, sz);
      const cam = new THREE.Vector3(
        cameraPosition.x, cameraPosition.y, cameraPosition.z
      );
      const t = cam.clone().sub(startVec).dot(axisUnit);
      center = startVec.clone().addScaledVector(axisUnit, t).toArray();
    } else {
      center = [(sx + ex) / 2, (sy + ey) / 2, (sz + ez) / 2];
    }

    const defaultAxis = new THREE.Vector3(0, 1, 0);
    const quaternion  = new THREE.Quaternion()
      .setFromUnitVectors(defaultAxis, axisUnit);

    return (
      <group position={center} quaternion={quaternion}>
        <mesh>
          <cylinderGeometry args={[outerRadius, outerRadius, resolvedH, 32]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.15} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[innerRadius, innerRadius, resolvedH, 32]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.15} />
        </mesh>
      </group>
    );
  },

  getCharLength: (field) => {
    if (field.is_infinite?.[0]) return 9999;
    const [sx, sy, sz] = field.start;
    const [ex, ey, ez] = field.end;
    const h  = Math.sqrt((ex-sx)**2 + (ey-sy)**2 + (ez-sz)**2);
    const ro = field.radius      || 2;
    const ri = field.innerRadius || 1;
    return Math.cbrt(Math.PI * (ro * ro - ri * ri) * h);
  },

  containsPoint: (field, x, y, z) => {
    const start = new THREE.Vector3(...field.start);
    const end   = new THREE.Vector3(...field.end);
    const outerRadius = field.radius      || 2;
    const innerRadius = field.innerRadius || 1;
    const isInfAxis = field.is_infinite?.[0] ?? false;

    const axis = new THREE.Vector3().subVectors(end, start);
    const h = axis.length();
    if (h === 0 || outerRadius <= 0 || innerRadius >= outerRadius) return false;
    const axisUnit = axis.clone().normalize();
    const v = new THREE.Vector3(x, y, z).sub(start);
    const t = v.dot(axisUnit);

    // 轴向无限：跳过 t 范围检查
    if (!isInfAxis && (t < 0 || t > h)) return false;

    const radialVec = v.clone().addScaledVector(axisUnit, -t);
    const rSq = radialVec.lengthSq();
    return rSq > innerRadius * innerRadius && rSq < outerRadius * outerRadius;
  },

  getSamplePoints: (field, spacing, cameraPosition, maxRenderCount) => {
    const points  = [];
    const start   = new THREE.Vector3(...field.start);
    const end     = new THREE.Vector3(...field.end);
    const outerRadius = field.radius      || 2;
    const innerRadius = field.innerRadius || 1;
    const isInfAxis = field.is_infinite?.[0] ?? false;

    const axis     = new THREE.Vector3().subVectors(end, start);
    const h        = axis.length();
    const axisUnit = axis.clone().normalize();

    if (h === 0 || outerRadius <= 0 || innerRadius >= outerRadius) return points;

    const count      = maxRenderCount ?? 512;
    const halfLayers = Math.ceil(Math.cbrt(count * 2));

    const cam = new THREE.Vector3(
      cameraPosition?.x ?? 0,
      cameraPosition?.y ?? 0,
      cameraPosition?.z ?? 0
    );

    const ringWidth = outerRadius - innerRadius;
    const spRadial  = Math.min(spacing, ringWidth);
    const spAxial   = Math.min(spacing, h);

    const outerRadiusSq = outerRadius * outerRadius;
    const innerRadiusSq = innerRadius * innerRadius;

    const minX = Math.min(start.x, end.x) - outerRadius;
    const maxX = Math.max(start.x, end.x) + outerRadius;
    const minY = Math.min(start.y, end.y) - outerRadius;
    const maxY = Math.max(start.y, end.y) + outerRadius;
    const minZ = Math.min(start.z, end.z) - outerRadius;
    const maxZ = Math.max(start.z, end.z) + outerRadius;

    // ── 轴向范围（仅轴向无限时使用） ──
    const snapToGrid = (v, sp) => Math.round(v / sp) * sp;
    let axialLo, axialHi;
    if (isInfAxis) {
      const tCam     = cam.clone().sub(start).dot(axisUnit);
      const tSnapped = snapToGrid(tCam, spAxial);
      axialLo = tSnapped - halfLayers * spAxial;
      axialHi = tSnapped + halfLayers * spAxial;
    }

    const p         = new THREE.Vector3();
    const v         = new THREE.Vector3();
    const radialVec = new THREE.Vector3();

    for (let x = minX + spRadial / 2; x <= maxX; x += spRadial) {
      for (let y = minY + spRadial / 2; y <= maxY; y += spRadial) {
        for (let z = minZ + spRadial / 2; z <= maxZ; z += spRadial) {
          p.set(x, y, z);
          v.subVectors(p, start);
          const t = v.dot(axisUnit);

          // ── 轴向层对齐 ──
          let tLayer;
          if (isInfAxis) {
            tLayer = Math.floor((t - axialLo) / spAxial) * spAxial + axialLo + spAxial / 2;
            if (tLayer < axialLo || tLayer > axialHi) continue;
          } else {
            tLayer = Math.floor(t / spAxial) * spAxial + spAxial / 2;
            if (tLayer < 0 || tLayer > h) continue;
          }

          radialVec.copy(v).addScaledVector(axisUnit, -t);
          const rSq = radialVec.lengthSq();

          if (rSq > innerRadiusSq && rSq < outerRadiusSq) {
            const snappedP = start.clone()
              .addScaledVector(axisUnit, tLayer)
              .add(radialVec);
            points.push(snappedP);
          }
        }
      }
    }

    return sortAndSlice(points, cameraPosition, maxRenderCount);
  }
}
}
/**
 * 将点数组按到摄像头的距离升序排序，返回前 maxRenderCount 个。
 * @param {THREE.Vector3[]} points        - 候选点数组
 * @param {THREE.Vector3}   cameraPosition - 摄像头世界坐标
 * @param {number}          maxRenderCount - 最多返回多少个点（undefined 则全部返回）
 * @returns {THREE.Vector3[]}
 */
function sortAndSlice(points, cameraPosition, maxRenderCount) {
  // 没有传摄像头位置或没有点数限制时，直接原样返回
  if (!cameraPosition || maxRenderCount == null) return points;

  // 预计算每个点到摄像头的距离平方（避免开方，性能更好）
  const withDist = points.map(p => ({
    point: p,
    distSq: p.distanceToSquared(cameraPosition)
  }));

  withDist.sort((a, b) => a.distSq - b.distSq);

  return withDist.slice(0, maxRenderCount).map(item => item.point);
}

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
  const MAX_RENDER_COUNT = 300;
  const color = type === 'E' ? '#4facfe' : '#ff4b4b';
  const { camera } = useThree();
  const strategy = SHAPE_STRATEGIES[field.shape] || SHAPE_STRATEGIES.box;

  const visibleArrowPositions = useMemo(() => {
    const charLength = strategy.getCharLength(field);
    const spacing = Math.max(1, Math.min(20, charLength * 0.2));
    const allPoints = strategy.getSamplePoints(field, spacing,camera.position,MAX_RENDER_COUNT);
    return allPoints;
  }, [field, camera, renderTrigger, strategy]);

  if (!field.visible || field.magnitude === 0) return null; //必须在一堆use的hook之后才能返回
  return (
    <group>
      {/* 🧩 模块化渲染 1：画外框线框 */}
      {strategy.renderWireframe(field, color,camera.position)}

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