import React, { useState, useRef,createContext, useContext, useEffect, useMemo } from 'react';
import { Canvas, useFrame,useThree } from '@react-three/fiber';
import { OrbitControls, Text,Trail } from '@react-three/drei';
import * as THREE from 'three';
import SmartInput from '../ui/SmartInput';
import ContextMenu from '../ui/ContextMenu';
import ParticleCard from '../ui/ParticleCard';
import FieldCard from '../ui/FieldCard';
export const InspectorContext = createContext(null);
export function InspectorProvider({ children, value }) {
  return <InspectorContext.Provider value={value}>{children}</InspectorContext.Provider>;
}
export function Inspector({}){
    const {
            // 状态
            isRunning, setIsRunning,
            resetTrigger, setResetTrigger,
            speed, setSpeed,
            trailInfo, setTrailInfo,
            trailPanelOpen, setTrailPanelOpen,
            followId, setFollowId,
            particles, electricFields, magneticFields,
            particlesExpanded, setParticlesExpanded,
            fieldsExpanded, setFieldsExpanded,
            // handlers
            handleRun, handleSave, handleLoad,
            updateEntity, setParticles, setElectricFields, setMagneticFields,
            controlsRef, fileInputRef,removeParticle,removeEField,removeBField
    }=useContext(InspectorContext);
    return(
      <div>
        <h2 style={{ marginTop: 0, borderBottom: '1px solid #555', paddingBottom: '10px' }}>Physics Inspector</h2>
                 {/*三维引擎中控台按钮组 */}
                 <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                  <button onClick={handleRun} style={{ flex: 1, padding: '8px', backgroundColor: isRunning ? '#27ae60' : '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    ▶ Run
                  </button>
                  <button onClick={() => setIsRunning(false)} style={{ flex: 1, padding: '8px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    ⏸ Stop
                  </button>
                  <button onClick={() => { setIsRunning(false); setResetTrigger(prev => prev + 1); }} style={{ flex: 1, padding: '8px', backgroundColor: '#34495e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    ⏹ Reset
                  </button>
                </div>
                {/* 隐藏的文件读取器，专门用来接收文件 */}
                <input 
                  type="file" 
                  accept=".json" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  onChange={handleLoad} 
                />
        
                {/* Save & Load 档案管理组 */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  <button onClick={handleSave} style={{ flex: 1, padding: '8px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    💾 Save Scene
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: '8px', backgroundColor: '#f39c12', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    📂 Load Scene
                  </button>
                </div>
                <button onClick={() => controlsRef.current?.reset()} style={{ width: '100%', padding: '10px', backgroundColor: '#e67e22', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '20px' }}>
                  🎥 Reset Camera
                </button>
                {/* ========== 轨迹设置按钮 + 面板 ========== */}
                <button
                  onClick={() => setTrailPanelOpen(o => !o)}
                  style={{ width: '100%', padding: '10px', backgroundColor: trailPanelOpen ? '#1a6b8a' : '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}
                >
                  ✨ Trail Settings {trailPanelOpen ? '▲' : '▼'}
                </button>
                {trailPanelOpen && (
                  <div style={{ backgroundColor: '#1a1a2e', border: '1px solid #17a2b8', borderRadius: '6px', padding: '14px', marginBottom: '20px' }}>
                    
                    {/* 颜色 */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '13px', color: '#aaa' }}>Trail Color</label>
                        <label style={{ fontSize: '11px', color: '#666', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={trailInfo.color === ''}
                            onChange={(e) => setTrailInfo(t => ({ ...t, color: e.target.checked ? '' : '#ffffff' }))}
                            style={{ cursor: 'pointer', accentColor: '#17a2b8' }}
                          />
                          Auto (follow particle)
                        </label>
                      </div>
                      {trailInfo.color !== '' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="color"
                            value={trailInfo.color}
                            onChange={(e) => setTrailInfo(t => ({ ...t, color: e.target.value }))}
                            style={{ width: '48px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent', padding: 0 }}
                          />
                          <span style={{ fontSize: '13px', color: '#ccc', fontFamily: 'monospace' }}>{trailInfo.color}</span>
                        </div>
                      )}
                    </div>
        
                    {/* 粗细 */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '13px', color: '#aaa' }}>Width multiplier</label>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{trailInfo.width.toFixed(2)}×</span>
                      </div>
                      <input
                        type="range" min={0.1} max={5} step={0.05} value={trailInfo.width}
                        onChange={(e) => setTrailInfo(t => ({ ...t, width: parseFloat(e.target.value) }))}
                        style={{ width: '100%', accentColor: '#17a2b8', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginTop: '2px' }}>
                        <span>thin</span><span>thick</span>
                      </div>
                    </div>
        
                    {/* 持续时间（length） */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '13px', color: '#aaa' }}>Length (frames)</label>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{trailInfo.length}</span>
                      </div>
                      <input
                        type="range" min={10} max={2000} step={10} value={trailInfo.length}
                        onChange={(e) => setTrailInfo(t => ({ ...t, length: parseInt(e.target.value) }))}
                        style={{ width: '100%', accentColor: '#17a2b8', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginTop: '2px' }}>
                        <span>short</span><span>long</span>
                      </div>
                    </div>
        
                  </div>
                )}
                {/* 选择摄像机跟随的下拉框 */}
                <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '14px', color: '#aaa', display: 'block', marginBottom: '6px' }}>
                  Follow Particle (摄像头跟随)
                </label>
                <select
                  value={followId}
                  onChange={(e) => setFollowId(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1a1a2e', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
                >
                  <option value={-1}>无 (自由视角)</option>
                  {particles.map((p, i) => (
                    <option key={p.id} value={p.id}>粒子 {i + 1}</option>
                  ))}
                </select>
              </div>
                {/* ========== 全局速度控制 ========== */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Simulation Speed</label>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', minWidth: '32px', textAlign: 'right' }}>
                      {speed.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: '#2ecc71', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#666', marginTop: '3px' }}>
                    <span>0 (paused)</span>
                    <span>1x (full)</span>
                  </div>
                </div>
                {/* ========== 粒子折叠分组 ========== */}
                <div 
                  style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: '10px' }} 
                  onClick={() => setParticlesExpanded(!particlesExpanded)}
                >
                  <span style={{ 
                    marginRight: '8px', 
                    transform: particlesExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', 
                    transition: 'transform 0.2s',
                    display: 'inline-block',
                    fontSize: '0.9em'
                  }}>
                    ▼
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.1em' }}>Particles ({particles.length})</h3>
                </div>
                {particlesExpanded && particles.map((p, i) => 
                  <ParticleCard key={p.id} particle={p} index={i} onUpdate={(id, prop, idx, val) => updateEntity(setParticles, id, prop, idx, val)} onDelete={removeParticle} />
                )}
                {/* ========== 场折叠分组（电场+磁场） ========== */}
                <div 
                  style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: '10px', marginTop: '20px' }} 
                  onClick={() => setFieldsExpanded(!fieldsExpanded)}
                >
                  <span style={{ 
                    marginRight: '8px', 
                    transform: fieldsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', 
                    transition: 'transform 0.2s',
                    display: 'inline-block',
                    fontSize: '0.9em'
                  }}>
                    ▼
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.1em' }}>Fields ({electricFields.length + magneticFields.length})</h3>
                </div>
                {fieldsExpanded && (
                  <>
                    {electricFields.map((f, i) => <FieldCard key={f.id} title={`E-Field ${i + 1}`} field={f} type="E" onUpdate={(id, prop, idx, val) => updateEntity(setElectricFields, id, prop, idx, val)} onDelete={removeEField} />)}
                    {magneticFields.map((f, i) => <FieldCard key={f.id} title={`B-Field ${i + 1}`} field={f} type="B" onUpdate={(id, prop, idx, val) => updateEntity(setMagneticFields, id, prop, idx, val)} onDelete={removeBField} />)}
                  </>
                )}
      </div>  
    );
}