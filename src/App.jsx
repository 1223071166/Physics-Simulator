import './i18n'
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import ContextMenu from './components/ui/ContextMenu';
import FieldVisualizer from './components/canvas/FieldVisualizer';
import ChargedParticle from './components/canvas/ChargedParticle';
import AdaptiveAxes from './components/canvas/AdaptiveAxes';
import CameraController from './components/utils/CameraController';
import { TimeProvider } from './components/utils/Time';
import { Inspector } from './components/ui/Inspector';

import { EntityProvider, useEntity } from './state/EntityContext';
import { SimulationProvider, useSimulation } from './state/SimulationContext';
import { AppUIProvider, useAppUI } from './state/AppUIContext';
import { downloadScene, parseSceneFile } from './components/utils/saveLoad';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

// ── 内部组件: 消费所有三个 Context，构建跨 Context 的逻辑 ──
function AppInner() {
  const { t } = useTranslation('app');
  const entity = useEntity();
  const sim = useSimulation();
  const ui = useAppUI();

  // ── Save/Load: 需要同时访问 entity 和 sim ──
  const handleSave = useCallback(() => {
    downloadScene(entity.particles, entity.electricFields, entity.magneticFields);
  }, [entity.particles, entity.electricFields, entity.magneticFields]);

  const handleLoad = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    parseSceneFile(file).then((data) => {
      entity.setParticles(data.particles);
      entity.setElectricFields(data.electricFields);
      entity.setMagneticFields(data.magneticFields);
      sim.setIsRunning(false);
      sim.setResetTrigger(prev => prev + 1);
    }).catch(() => {
      alert(t('errors.loadCorrupted'));
    });
    event.target.value = '';
  }, [entity, sim, t]);

  // ── 菜单选项: 需要 t() 和 entity 的 add 函数 ──
  const rightMenuOptions = useMemo(() => [
    { label: t('contextMenu.addParticle'), onClick: entity.addParticle },
    { label: t('contextMenu.addEField'), onClick: entity.addEField },
    { label: t('contextMenu.addBField'), onClick: entity.addBField },
  ], [t, entity.addParticle, entity.addEField, entity.addBField]);

  const leftMenuOptions = useMemo(() => [
    { label: t('contextMenu.refreshView'), onClick: () => { sim.setRenderTrigger(prev => prev + 1); ui.setMenu2(prev => ({ ...prev, visible: false })); } }
  ], [t, sim.setRenderTrigger, ui.setMenu2]);

  // ── 布局 ──
  return (
    <div>
      <style>{`
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        html, body, #root {
          height: 100%;
          overflow: hidden;
        }
      `}</style>
      <div
        onClick={() => { ui.setMenu({ ...ui.menu, visible: false }); ui.setMenu2({ ...ui.menu2, visible: false }); }}
        style={{
          display: 'flex',
          width: '100vw',
          height: '100vh',
          margin: 0,
          backgroundColor: '#111',
          color: 'white',
          fontFamily: 'sans-serif',
        }}>
        {/* 左侧渲染区域 */}
        <div
          style={{ width: ui.inspectorOpen ? '75vw' : '99vw', position: 'relative', outline: 'none' }} tabIndex={0}
          onContextMenu={(e) => { e.preventDefault(); ui.setMenu2({ visible: true, x: e.clientX, y: e.clientY }); }}
        >
          <Canvas camera={{ position: [10, 10, 10], fov: 50, up: [0, 0, 1] }}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <AdaptiveAxes />
            <TimeProvider globalSpeed={sim.speed} ref={sim.timeRef}>
              {entity.electricFields.map(f => <FieldVisualizer key={f.id} field={f} type="E" renderTrigger={sim.renderTrigger} />)}
              {entity.magneticFields.map(f => <FieldVisualizer key={f.id} field={f} type="B" renderTrigger={sim.renderTrigger} />)}
              {entity.particles.map(p => (
                <ChargedParticle
                  key={p.id}
                  particle={p}
                  electricFields={entity.electricFields}
                  magneticFields={entity.magneticFields}
                  isRunning={sim.isRunning}
                  resetTrigger={sim.resetTrigger}
                  renderTrigger={sim.renderTrigger}
                  onSync={entity.syncParticleState}
                  trailInfo={ui.trailInfo}
                  onRefReady={entity.handleParticleRefReady}
                />
              ))}
            </TimeProvider>
            <OrbitControls
              ref={sim.controlsRef}
              makeDefault
              enableDamping
              dampingFactor={0.05}
              panSpeed={2}
              enablePan={ui.followId === -1}
            />
            <CameraController controlsRef={sim.controlsRef} followId={ui.followId} particleRefsMap={entity.particleRefsMap} />
          </Canvas>
        </div>

        {/* 右侧组件区域 */}
        <div style={{ display: 'flex', flexShrink: 0 }}>
          {/* 折叠切换按钮 */}
          <div
            onClick={() => ui.setInspectorOpen(o => !o)}
            style={{
              width: '1vw',
              backgroundColor: '#2a2a2a',
              borderLeft: '1px solid #444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#aaa',
              fontSize: '18px',
              userSelect: 'none',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
            title={ui.inspectorOpen ? t('panel.collapse') : t('panel.expand')}
          >
            {ui.inspectorOpen ? '›' : '‹'}
          </div>
          {/* 右侧面板内容 */}
          <div
            style={{
              width: ui.inspectorOpen ? '24vw' : '0px',
              overflow: 'hidden',
              transition: 'width 0.3s ease',
              backgroundColor: '#222',
              borderLeft: '1px solid #444',
            }}
            onKeyDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); ui.setMenu({ visible: true, x: e.clientX, y: e.clientY }); }}
          >
            <div style={{ width: '24vw', padding: '10px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
              <Inspector handleSave={handleSave} handleLoad={handleLoad} />
            </div>
          </div>
        </div>

        <ContextMenu visible={ui.menu.visible} x={ui.menu.x} y={ui.menu.y} options={rightMenuOptions} />
        <ContextMenu visible={ui.menu2.visible} x={ui.menu2.x} y={ui.menu2.y} options={leftMenuOptions} />
      </div>
    </div>
  );
}

// ── 顶层: Provider 嵌套 ──
// 顺序: Simulation > AppUI > Entity > AppInner
// AppUI 必须包裹 Entity，因为 EntityProvider 的 closeMenu 需要从 AppUI 读取 setMenu
export default function App() {
  return (
    <SimulationProvider>
      <AppUIProvider>
        <EntityBridge />
      </AppUIProvider>
    </SimulationProvider>
  );
}

function EntityBridge() {
  const ui = useAppUI();
  return (
    <EntityProvider closeMenu={() => ui.setMenu(prev => ({ ...prev, visible: false }))}>
      <AppInner />
    </EntityProvider>
  );
}