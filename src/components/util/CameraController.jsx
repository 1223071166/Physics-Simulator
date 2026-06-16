
import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
export default function CameraController({ controlsRef, followId = -1, particleRefsMap }) {
  const { camera } = useThree();
  const keys = useRef({ KeyW: false, KeyA: false, KeyS: false, KeyD: false, ShiftLeft: false });
  
  // 记录跟随偏移量；进入跟随模式那一刻才计算，之后保持不变直到下次进入
  const followOffset = useRef(new THREE.Vector3());
  const prevFollowId = useRef(-1);
  const prevTargetPos = useRef(new THREE.Vector3());
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.code in keys.current) keys.current[e.code] = true; };
    const handleKeyUp = (e) => { if (e.code in keys.current) keys.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const targetVec = followId !== -1 ? particleRefsMap.current[followId] : null;

    // ───────── 跟随模式 ─────────
    if (targetVec) {
      if (prevFollowId.current !== followId) {
        // 刚切换目标：记录初始 target 位置，不计算 offset 了，offset 这个概念可以完全不需要
        prevTargetPos.current.copy(targetVec);
        prevFollowId.current = followId;
      }

      // 计算粒子这一帧相对上一帧移动了多少
      const delta = targetVec.clone().sub(prevTargetPos.current);

      // camera 和 target 都加上这个增量 —— 相机和焦点一起平移，相对关系（距离/角度）完全不变
      camera.position.add(delta);
      controls.target.copy(targetVec);

      prevTargetPos.current.copy(targetVec);

      controls.update();
      return;
    }

    // 退出跟随模式时复位标记，下次重新进入会重新记录 offset
    prevFollowId.current = -1;

    // ───────── 自由模式：原有 WASD 平移逻辑 ─────────
    const { KeyW, KeyA, KeyS, KeyD, ShiftLeft } = keys.current;
    if (!KeyW && !KeyA && !KeyS && !KeyD) return;

    const baseSpeed = 5;
    const boostMultiplier = 3;
    const speed = baseSpeed * (ShiftLeft ? boostMultiplier : 1) * delta;

    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    camera.getWorldDirection(forward);
    forward.normalize();

    const moveDirection = new THREE.Vector3();
    if (KeyW) moveDirection.add(forward);
    if (KeyS) moveDirection.sub(forward);
    if (KeyD) moveDirection.add(right);
    if (KeyA) moveDirection.sub(right);

    moveDirection.normalize().multiplyScalar(speed);
    camera.position.add(moveDirection);
    controls.target.add(moveDirection);
    controls.update();
  });

  return null;
}