import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Text,Trail } from '@react-three/drei';
import * as THREE from 'three';
import { createFieldInstance } from '../util/FieldStrategies';
import {TimeProvider,useTime} from '../util/Time';
import { registerParticleRefs, unregisterParticleRefs } from '../util/Particlerefstore.jsx'; // 【新增】实时检测功能
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

  // useEffect(() => {
  //   if (renderTrigger > 0) {
  //     onSync(particle.id, posRef.current.toArray(), velRef.current.toArray());
  //   }
  // }, [renderTrigger, particle.id, onSync]);
  //禁止回调

  useEffect(() => {
    onRefReady?.(particle.id, posRef.current);
    return () => onRefReady?.(particle.id, null);
  }, [particle.id, onRefReady]);

  // 【新增】实时检测功能：把 pos/vel 的 ref 注册到共享 store，
  // 这样 ParticleMonitor 浮动卡片可以用 rAF 直接读取最新值，
  // 不需要把每帧的物理状态同步进 React state（避免 60fps 重渲染）
  useEffect(() => {
    registerParticleRefs(particle.id, posRef, velRef);
    return () => unregisterParticleRefs(particle.id);
  }, [particle.id]);
  
  // 🌟 将纯数据对象转化为具有多态 getVector 方法的类实例
  // 仅在场数据发生变化时重新实例化，保护引擎性能
  const eFieldInstances = useMemo(() => 
    electricFields.map(f => createFieldInstance(f, 'E')), 
  [electricFields]);

  const bFieldInstances = useMemo(() => 
    magneticFields.map(f => createFieldInstance(f, 'B')), 
  [magneticFields]);

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
  const axis = useMemo(() => new THREE.Vector3(), []);
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

    const speed = velRef.current.length();
    const estimatedDist = speed * frameDt;
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
          // 🌟 核心：Boris Integration Algorithm
          // 准备电场加速度项: (q/m) * E * (dt/2)
          qmE.copy(netE).multiplyScalar(qm * dt2);

          // 第一步：前半步加速 -> vMinus = v + qmE

          vMinus.copy(velRef.current).add(qmE);
          if (particle.enableGravity) {
            vMinus.add(new THREE.Vector3(0,0,-particle.gravityConstant * dt2)); // 加入重力加速度
          }
          // 第二步：磁场纯旋转 (Boris Push)
          tVec.copy(netB).multiplyScalar(qm * dt2); //旋转半角度
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
      key={`${resetTrigger}-${particle.position}`}
      width={trailWidth}
      length={trailLength}
      color={trailColor}
      attenuation={(t) => t * t}
    >
      {meshContent}
    </Trail>
  );
}