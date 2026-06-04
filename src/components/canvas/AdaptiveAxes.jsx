import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame,useThree } from '@react-three/fiber';
import { OrbitControls, Text,Trail } from '@react-three/drei';
import * as THREE from 'three';
// ==========================================
// 会呼吸的智能坐标轴 (Adaptive Axes)
// ==========================================
export default function AdaptiveAxes() {
    const axesRef = useRef();
    const xRef = useRef();
    const yRef = useRef();
    const zRef = useRef();
    
    useFrame(({ camera }) => {
      // 1. 获取相机距离原点的距离 (上帝视角的拉伸度)
      const dist = camera.position.length();
      
      // 2. 动态伸缩：保持与相机的相对比例 (0.8 是针对 FOV 50 度的完美屏占比系数)
      const len = dist * 0.8;
      if (axesRef.current) axesRef.current.scale.set(len, len, len);
      
      // 3. 将字母精确锚定在轴的末端，再往外探出 5% 的留白
      const offset = len * 1.05;
      if (xRef.current) xRef.current.position.set(offset, 0, 0);
      if (yRef.current) yRef.current.position.set(0, offset, 0);
      if (zRef.current) zRef.current.position.set(0, 0, offset);
  
      // 4. 文字大小自适应：距离越远，文字模型等比例放大，肉眼看起来大小永远不变
      const textScale = dist * 0.05;
      if (xRef.current) xRef.current.scale.setScalar(textScale);
      if (yRef.current) yRef.current.scale.setScalar(textScale);
      if (zRef.current) zRef.current.scale.setScalar(textScale);
  
      // 5. Billboard 广告牌效应：强迫文字的旋转角度永远与摄像机同步，绝不侧视
      if (xRef.current) xRef.current.quaternion.copy(camera.quaternion);
      if (yRef.current) yRef.current.quaternion.copy(camera.quaternion);
      if (zRef.current) zRef.current.quaternion.copy(camera.quaternion);
    });
  
    return (
      <group>
        {/* 基础长度设为 1，全靠 useFrame 动态放大 */}
        <axesHelper ref={axesRef} args={[1]} />
        <Text ref={xRef} color="#ff4b4b" fontSize={1} fontWeight="bold" anchorX="center" anchorY="middle">x</Text>
        <Text ref={yRef} color="#4facfe" fontSize={1} fontWeight="bold" anchorX="center" anchorY="middle">y</Text>
        <Text ref={zRef} color="#44ff44" fontSize={1} fontWeight="bold" anchorX="center" anchorY="middle">z</Text>
      </group>
    );
  }