
import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
// 1. 创建一个自定义的键盘控制器组件
export default function CameraController({ controlsRef }) {
    const { camera } = useThree();
    const keys = useRef({ KeyW: false, KeyA: false, KeyS: false, KeyD: false, ShiftLeft: false });
  
    // 监听键盘按下和抬起
    useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.code in keys.current) keys.current[e.code] = true;
      };
      const handleKeyUp = (e) => {
        if (e.code in keys.current) keys.current[e.code] = false;
      };
  
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }, []);
  
    // 在每一帧中根据相机朝向计算平移
    // 在每一帧中根据相机朝向计算平移
  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // 检测是否有按键按下
    const { KeyW, KeyA, KeyS, KeyD, ShiftLeft } = keys.current;
    if (!KeyW && !KeyA && !KeyS && !KeyD) return;

    // 基础速度与加速逻辑
    const baseSpeed = 5; 
    const boostMultiplier = 3; // 按住Shift时加速
    const speed = baseSpeed * (ShiftLeft ? boostMultiplier : 1) * delta;

    // 直接从相机获取“完全对准屏幕视角”的前方向和右方向
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    
    // 1. 获取摄像头的正右方向（直接提取相机世界矩阵的X轴）
    // 这比叉乘更安全，因为它完美匹配你在屏幕上看到的“右边”
    right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();

    // 2. 获取摄像头的正前方向（也就是你眼睛直视的方向）
    camera.getWorldDirection(forward);
    forward.normalize();

    // 计算本次帧的位移量
    const moveDirection = new THREE.Vector3();
    if (KeyW) moveDirection.add(forward);
    if (KeyS) moveDirection.sub(forward);
    if (KeyD) moveDirection.add(right);
    if (KeyA) moveDirection.sub(right);
    
    // 统一归一化并乘以速度（防止斜向移动变快）
    moveDirection.normalize().multiplyScalar(speed);

    // 同时应用到相机位置和 OrbitControls 的目标点
    camera.position.add(moveDirection);
    controls.target.add(moveDirection);

    // 必须手动更新控制器以同步画面
    controls.update();
  });
  
    return null;
  }