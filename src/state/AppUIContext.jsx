// ── UI 状态 Context ──
// 管理面板折叠、菜单、Trail 设置、摄像机跟随、Save/Load 等纯 UI 状态

import React, { createContext, useContext, useState, useRef, useMemo } from 'react';

const AppUIContext = createContext(null);

export function AppUIProvider({ children }) {
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0 });
  const [menu2, setMenu2] = useState({ visible: false, x: 0, y: 0 });

  const [particlesExpanded, setParticlesExpanded] = useState(true);
  const [fieldsExpanded, setFieldsExpanded] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [trailPanelOpen, setTrailPanelOpen] = useState(false);

  const [trailInfo, setTrailInfo] = useState({
    color: '',
    width: 0.8,
    length: 600,
  });

  const [followId, setFollowId] = useState(-1);

  const fileInputRef = useRef(null);

  const value = useMemo(() => ({
    menu, setMenu, menu2, setMenu2,
    particlesExpanded, setParticlesExpanded,
    fieldsExpanded, setFieldsExpanded,
    inspectorOpen, setInspectorOpen,
    trailPanelOpen, setTrailPanelOpen,
    trailInfo, setTrailInfo,
    followId, setFollowId,
    fileInputRef,
  }), [
    menu, menu2,
    particlesExpanded, fieldsExpanded, inspectorOpen, trailPanelOpen,
    trailInfo, followId,
  ]);

  return (
    <AppUIContext.Provider value={value}>
      {children}
    </AppUIContext.Provider>
  );
}

export function useAppUI() {
  const ctx = useContext(AppUIContext);
  if (!ctx) throw new Error('useAppUI must be used inside <AppUIProvider>');
  return ctx;
}