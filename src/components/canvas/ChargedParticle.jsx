import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Text,Trail } from '@react-three/drei';
import * as THREE from 'three';
import { createFieldInstance } from '../util/FieldStrategies';

// 🌟 终极物理版 ChargedParticle：Boris 算法 + AABB 碰撞
export default function ChargedParticle({ particle, electricFields, magneticFields, isRunning, resetTrigger, renderTrigger, onSync }) {
  const meshRef = useRef();

  const posRef = useRef(new THREE.Vector3(...particle.position));
  const velRef = useRef(new THREE.Vector3(...particle.velocity));

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

    const dt = Math.min(delta, 0.1);
    const p = posRef.current;
    const elapsedTime = clock.elapsedTime; // 提取总时长用于时变场计算
    // 1. 搜集当前位置的电场和磁场
    accumulateFields(eFieldInstances, netE, p,elapsedTime);
    accumulateFields(bFieldInstances, netB, p,elapsedTime);

    const safeMass = particle.mass === 0 ? 0.0001 : particle.mass;
    const qm = particle.charge / safeMass;
    const dt2 = dt / 2.0;

    // ==========================================
    // 🌟 核心：Boris Integration Algorithm
    // ==========================================
    
    // 准备电场加速度项: (q/m) * E * (dt/2)
    qmE.copy(netE).multiplyScalar(qm * dt2);

    // 第一步：前半步电场加速 -> vMinus = v + qmE
    vMinus.copy(velRef.current).add(qmE);

    // 第二步：磁场纯旋转 (Boris Push)
    // t = (q/m) * B * (dt/2)
    tVec.copy(netB).multiplyScalar(qm * dt2);
    const tMagSq = tVec.lengthSq();

    // vPrime = vMinus + (vMinus x t)
    crossTemp1.crossVectors(vMinus, tVec);
    vPrime.copy(vMinus).add(crossTemp1);

    // s = 2t / (1 + |t|^2)
    sVec.copy(tVec).multiplyScalar(2.0 / (1.0 + tMagSq));

    // vPlus = vMinus + (vPrime x s)
    crossTemp2.crossVectors(vPrime, sVec);
    const vPlus = vMinus.clone().add(crossTemp2); // 这里用一个 clone 防止互相污染

    // 第三步：后半步电场加速 -> vNew = vPlus + qmE
    velRef.current.copy(vPlus).add(qmE);

    // 第四步：更新物理位置 -> pNew = p + vNew * dt
    posRef.current.add(velRef.current.clone().multiplyScalar(dt));
    
    // ==========================================

    meshRef.current.position.copy(posRef.current);
    meshRef.current.rotation.x += dt * 0.5;
    meshRef.current.rotation.y += dt * 0.5;
  });

  const particleColor = particle.charge > 0 ? "#ff4444" : (particle.charge < 0 ? "#4444ff" : "cyan");

  return (
    // 🌟 将原本的 mesh 用 Trail 组件包裹起来
    <Trail
      key={resetTrigger}           // 绝妙的防御：每次重置物理状态时，彻底销毁旧尾迹，防止画出“瞬移直线”
      width={particle.radius * 0.8} // 尾巴的宽度（跟随粒子半径自适应）
      length={600}                  // 尾巴的长度（记录多少帧的历史坐标，越大越长，但太大会耗性能）
      color={particleColor}         // 尾迹的颜色
      attenuation={(t) => t * t}    // 极具美感的衰减函数：让尾巴末端像流星一样极其平滑地变细、消失
    >
      <mesh position={particle.position} ref={meshRef}>
        <sphereGeometry args={[particle.radius, 32, 32]} />
        <meshStandardMaterial color={particleColor} wireframe={true} />
      </mesh>
    </Trail>
  );
}