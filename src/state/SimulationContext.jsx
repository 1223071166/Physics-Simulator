// ── 仿真控制 Context ──
// 管理物理引擎的启停、速度、重置等运行时控制

import React, { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';

const SimulationContext = createContext(null);

export function SimulationProvider({ children }) {
  const controlsRef = useRef();          // 相机控制器
  const timeRef = useRef(null);          // 物理引擎内部时间

  const [renderTrigger, setRenderTrigger] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [speed, setSpeed] = useState(1);

  const handleRun = useCallback(() => {
    if (!isRunning) {
      timeRef.current?.reset();
      setIsRunning(true);
    }
  }, [isRunning]);

  const value = useMemo(() => ({
    isRunning, setIsRunning,
    resetTrigger, setResetTrigger,
    renderTrigger, setRenderTrigger,
    speed, setSpeed,
    controlsRef, timeRef,
    handleRun,
  }), [isRunning, resetTrigger, renderTrigger, speed, handleRun]);

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used inside <SimulationProvider>');
  return ctx;
}