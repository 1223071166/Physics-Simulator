import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Text,Trail } from '@react-three/drei';
import * as THREE from 'three';
import { createFieldInstance } from '../util/FieldStrategies';
import {TimeProvider,useTime} from '../util/Time';
// Boris 算法 + AABB 碰撞
export default function ChargedParticle({ particle, electricFields, magneticFields, isRunning, resetTrigger, renderTrigger, onSync,trailInfo,onRefReady}) {
  const meshRef = useRef();

  const posRef = useRef(new THREE.Vector3(...particle.position));
  const velRef = useRef(new THREE.Vector3(...particle.velocity));
  const { accTime, deltaScaled } = useTime();
  useEffect(() => { 
    posRef.current.set(...particle.position); 
    if (meshRef.current) {
      meshRef.current.position.copy(posRef.current);
    }
  }, [particle.position, resetTrigger]);
  
  useEffect(() => { 
    velRef.current.set(...particle.velocity); 
  }, [particle.velocity, resetTrigger]);

  useEffect(() => {
    if (renderTrigger > 0) {
      onSync(particle.id, posRef.current.toArray(), velRef.current.toArray());
    }
  }, [renderTrigger, particle.id, onSync]);

  useEffect(() => {
    onRefReady?.(particle.id, posRef.current);
    return () => onRefReady?.(particle.id, null);
  }, [particle.id, onRefReady]);
  
  // 🌟 将纯数据对象转化为具有多态 getVector 方法的类实例
  // 仅在场数据发生变化时重新实例化，保护引擎性能
  const eFieldInstances = useMemo(() => 
    electricFields.map(f => createFieldInstance(f, 'E')), 
  [electricFields]);

  const bFieldInstances = useMemo(() => 
    magneticFields.map(f => createFieldInstance(f, 'B')), 
  [magneticFields]);

  // ==========================================
  // 🛡️ 子步长安全系数：每步移动距离不超过最小场尺寸的这个比例
  const SAFETY_RATIO = 0.1;

  // 预计算所有场的最小特征尺寸，用于动态决定子步数
  const minFieldScale = useMemo(() => {
    const allFields = [...electricFields, ...magneticFields];
    if (allFields.length === 0) return Infinity;
    let minScale = Infinity;
    for (const f of allFields) {
      if (f.shape === 'box') {
        const w = Math.abs(f.end[0] - f.start[0]);
        const h = Math.abs(f.end[1] - f.start[1]);
        const d = Math.abs(f.end[2] - f.start[2]);
        const dims = [w, h, d].filter(v => v > 0);
        if (dims.length > 0) minScale = Math.min(minScale, Math.min(...dims));
      } else if (f.shape === 'cylinder') {
        minScale = Math.min(minScale, (f.radius || 1) * 2);
      } else if (f.shape === 'torus') {
        // 环形最危险的尺寸是环形宽度（内外径差），穿越它最容易 tunnel
        const ringWidth = (f.radius || 2) - (f.innerRadius || 1);
        minScale = Math.min(minScale, ringWidth * 2);
      }
    }
    return minScale === Infinity ? 10 : minScale;
  }, [electricFields, magneticFields]);

  // 物理引擎内存池：提前声明所有计算过程中的临时向量，防止 GC (垃圾回收) 掉帧
  const euler = useMemo(() => new THREE.Euler(), []);
  const netE = useMemo(() => new THREE.Vector3(), []);
  const netB = useMemo(() => new THREE.Vector3(), []);
  const tempFieldVec = useMemo(() => new THREE.Vector3(), []);
  // Boris 算法专用中间变量
  const vMinus = useMemo(() => new THREE.Vector3(), []);
  const tVec = useMemo(() => new THREE.Vector3(), []);
  const sVec = useMemo(() => new THREE.Vector3(), []);
  const vPrime = useMemo(() => new THREE.Vector3(), []);
  const crossTemp1 = useMemo(() => new THREE.Vector3(), []);
  const crossTemp2 = useMemo(() => new THREE.Vector3(), []);
  const qmE = useMemo(() => new THREE.Vector3(), []);

  // 辅助函数：计算场强叠加
  const accumulateFields = (fieldInstances, netVector, currentPos,time) => {
    netVector.set(0, 0, 0); // 每帧清零
    for (let i = 0; i < fieldInstances.length; i++) {
      // 把临时向量丢进去让场去修改
      fieldInstances[i].getVector(currentPos, time, tempFieldVec);
      netVector.add(tempFieldVec);
    }
  };

 
  useFrame(({clock}, delta) => {
    
    if (!meshRef.current || !isRunning) return;
    
    const frameDt = deltaScaled.current;                    
    const frameStartTime = accTime.current - frameDt;
    const safeMass = particle.mass === 0 ? 0.0001 : particle.mass;
    const qm = particle.charge / safeMass;
    ;

    // ==========================================
    // 🛡️ 动态子步长：根据当前速度和最小场尺寸，决定把 frameDt 拆成几步
    // maxStepDist = 安全系数 × 最小场特征尺寸
    // N = ceil(本帧总位移 / maxStepDist)，至少 1 步，最多 64 步（防止极端情况卡顿）
    // ==========================================
    const speed = velRef.current.length();
    const maxStepDist = SAFETY_RATIO * minFieldScale;
    const estimatedDist = speed * frameDt;
    //const N = Math.min(256, Math.max(1, Math.ceil(estimatedDist / maxStepDist)));
    const N = 10;
    const dt = frameDt / N;
    const dt2 = dt / 2.0;
    
    for (let step = 0; step < N; step++) {
      // 子步对应的物理时刻（用于时变场采样，保证正弦/方波相位连续）
      const stepTime = frameStartTime + (step + 0.5) * dt;
      const p = posRef.current;

      // 1. 在当前子步位置采样电场和磁场
      accumulateFields(eFieldInstances, netE, p, stepTime);
      accumulateFields(bFieldInstances, netB, p, stepTime);

      // ==========================================
      // 🌟 核心：Boris Integration Algorithm
      // ==========================================

      // 准备电场加速度项: (q/m) * E * (dt/2)
      qmE.copy(netE).multiplyScalar(qm * dt2);

      // 第一步：前半步加速 -> vMinus = v + qmE

      vMinus.copy(velRef.current).add(qmE);
      if (particle.enableGravity) {
        vMinus.add(new THREE.Vector3(0,0,-particle.gravityConstant * dt2)); // 加入重力加速度
      }
      // 第二步：磁场纯旋转 (Boris Push)
      tVec.copy(netB).multiplyScalar(qm * dt2);
      const tMagSq = tVec.lengthSq();

      // vPrime = vMinus + (vMinus × t)
      crossTemp1.crossVectors(vMinus, tVec);
      vPrime.copy(vMinus).add(crossTemp1);

      // s = 2t / (1 + |t|²)
      sVec.copy(tVec).multiplyScalar(2.0 / (1.0 + tMagSq));

      // vPlus = vMinus + (vPrime × s)
      crossTemp2.crossVectors(vPrime, sVec);
      const vPlus = vMinus.clone().add(crossTemp2);

      // 第三步：后半步加速 -> vNew = vPlus + qmE
      velRef.current.copy(vPlus).add(qmE);
      if (particle.enableGravity) {
        velRef.current.add(new THREE.Vector3(0,0,-particle.gravityConstant * dt2)); 
      }
      // 第四步：更新位置
      posRef.current.addScaledVector(velRef.current, dt);
    }

    meshRef.current.position.copy(posRef.current);
    meshRef.current.rotation.x += frameDt * 0.5;
    meshRef.current.rotation.y += frameDt * 0.5;
  });

  const particleColor = particle.charge > 0 ? "#ff4444" : (particle.charge < 0 ? "#4444ff" : "cyan");

  // 解析 trailInfo，填入默认值
  const trailColor  = (trailInfo?.color && trailInfo.color !== '') ? trailInfo.color : particleColor;
  const trailWidth  = particle.radius * (trailInfo?.width  ?? 0.8);
  const trailLength = trailInfo?.length ?? 600;

  const meshContent = (
    <mesh position={particle.position} ref={meshRef}>
      <sphereGeometry args={[particle.radius, 32, 32]} />
      <meshStandardMaterial color={particleColor} wireframe={true} />
    </mesh>
  );

  if (particle.trailVisible === false) {
    return meshContent;
  }

  return (
    <Trail
      key={resetTrigger}
      width={trailWidth}
      length={trailLength}
      color={trailColor}
      attenuation={(t) => t * t}
    >
      {meshContent}
    </Trail>
  );
}