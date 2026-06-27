import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ParticleCard from './ParticleCard';
import FieldCard from './FieldCard';
import { useEntity } from '../../state/EntityContext';
import { useSimulation } from '../../state/SimulationContext';
import { useAppUI } from '../../state/AppUIContext';

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button onClick={() => i18n.changeLanguage('zh')}>中文</button>
      <button onClick={() => i18n.changeLanguage('en')}>EN</button>
    </div>
  );
}

export function Inspector({ handleSave, handleLoad }) {
  const { t } = useTranslation('inspector');
  const entity = useEntity();
  const sim = useSimulation();
  const ui = useAppUI();

  return (
    <div>
      {/* 标题行 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #555', paddingBottom: '10px', marginBottom: '15px'
      }}>
        <h2 style={{ margin: 0 }}>{t('title')}</h2>
        <LanguageSwitcher />
      </div>

      {/* 三维引擎中控台按钮组 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
        <button onClick={sim.handleRun} style={{ flex: 1, padding: '8px', backgroundColor: sim.isRunning ? '#27ae60' : '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          ▶ {t('controls.run')}
        </button>
        <button onClick={() => sim.setIsRunning(false)} style={{ flex: 1, padding: '8px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          ⏸ {t('controls.stop')}
        </button>
        <button onClick={() => { sim.setIsRunning(false); sim.setResetTrigger(prev => prev + 1); }} style={{ flex: 1, padding: '8px', backgroundColor: '#34495e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          ⏹ {t('controls.reset')}
        </button>
      </div>

      {/* 隐藏的文件读取器 */}
      <input
        type="file" accept=".json" ref={ui.fileInputRef}
        style={{ display: 'none' }} onChange={handleLoad}
      />

      {/* Save & Load */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button onClick={handleSave} style={{ flex: 1, padding: '8px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          💾 {t('scene.save')}
        </button>
        <button onClick={() => ui.fileInputRef.current?.click()} style={{ flex: 1, padding: '8px', backgroundColor: '#f39c12', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          📂 {t('scene.load')}
        </button>
      </div>

      {/* Camera Reset */}
      <button onClick={() => sim.controlsRef.current?.reset()} style={{ width: '100%', padding: '10px', backgroundColor: '#e67e22', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '20px' }}>
        🎥 {t('camera.resetCamera')}
      </button>

      {/* Trail 设置 */}
      <button
        onClick={() => ui.setTrailPanelOpen(o => !o)}
        style={{ width: '100%', padding: '10px', backgroundColor: ui.trailPanelOpen ? '#1a6b8a' : '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}
      >
        ✨ {t('trail.settingsTitle')} {ui.trailPanelOpen ? '▲' : '▼'}
      </button>
      {ui.trailPanelOpen && (
        <div style={{ backgroundColor: '#1a1a2e', border: '1px solid #17a2b8', borderRadius: '6px', padding: '14px', marginBottom: '20px' }}>
          {/* 颜色 */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', color: '#aaa' }}>{t('trail.color')}</label>
              <label style={{ fontSize: '11px', color: '#666', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={ui.trailInfo.color === ''}
                  onChange={(e) => ui.setTrailInfo(t => ({ ...t, color: e.target.checked ? '' : '#ffffff' }))}
                  style={{ cursor: 'pointer', accentColor: '#17a2b8' }}
                />
                {t('trail.autoFollow')}
              </label>
            </div>
            {ui.trailInfo.color !== '' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="color" value={ui.trailInfo.color}
                  onChange={(e) => ui.setTrailInfo(t => ({ ...t, color: e.target.value }))}
                  style={{ width: '48px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent', padding: 0 }}
                />
                <span style={{ fontSize: '13px', color: '#ccc', fontFamily: 'monospace' }}>{ui.trailInfo.color}</span>
              </div>
            )}
          </div>
          {/* 粗细 */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '13px', color: '#aaa' }}>{t('trail.widthMultiplier')}</label>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{ui.trailInfo.width.toFixed(2)}×</span>
            </div>
            <input
              type="range" min={0.1} max={5} step={0.05} value={ui.trailInfo.width}
              onChange={(e) => ui.setTrailInfo(t => ({ ...t, width: parseFloat(e.target.value) }))}
              style={{ width: '100%', accentColor: '#17a2b8', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginTop: '2px' }}>
              <span>{t('trail.thin')}</span><span>{t('trail.thick')}</span>
            </div>
          </div>
          {/* 持续时间 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '13px', color: '#aaa' }}>{t('trail.length')}</label>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{ui.trailInfo.length}</span>
            </div>
            <input
              type="range" min={10} max={2000} step={10} value={ui.trailInfo.length}
              onChange={(e) => ui.setTrailInfo(t => ({ ...t, length: parseInt(e.target.value) }))}
              style={{ width: '100%', accentColor: '#17a2b8', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginTop: '2px' }}>
              <span>{t('trail.short')}</span><span>{t('trail.long')}</span>
            </div>
          </div>
        </div>
      )}

      {/* 摄像机跟随 */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '14px', color: '#aaa', display: 'block', marginBottom: '6px' }}>
          {t('follow.label')}
        </label>
        <select
          value={ui.followId}
          onChange={(e) => ui.setFollowId(Number(e.target.value))}
          style={{ width: '100%', padding: '8px', backgroundColor: '#1a1a2e', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
        >
          <option value={-1}>{t('follow.none')}</option>
          {entity.particles.map((p, i) => (
            <option key={p.id} value={p.id}>{t('follow.particle', { index: i + 1 })}</option>
          ))}
        </select>
      </div>

      {/* 速度控制 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '14px', color: '#aaa' }}>{t('speed.label')}</label>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', minWidth: '32px', textAlign: 'right' }}>
            {sim.speed.toFixed(2)}x
          </span>
        </div>
        <input
          type="range" min={0} max={1} step={0.01} value={sim.speed}
          onChange={(e) => sim.setSpeed(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#2ecc71', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#666', marginTop: '3px' }}>
          <span>{t('speed.paused')}</span>
          <span>{t('speed.full')}</span>
        </div>
      </div>

      {/* 粒子折叠分组 */}
      <div
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: '10px' }}
        onClick={() => ui.setParticlesExpanded(!ui.particlesExpanded)}
      >
        <span style={{ marginRight: '8px', transform: ui.particlesExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', display: 'inline-block', fontSize: '0.9em' }}>
          ▼
        </span>
        <h3 style={{ margin: 0, fontSize: '1.1em' }}>{t('particles.sectionTitle', { count: entity.particles.length })}</h3>
      </div>
      {ui.particlesExpanded && entity.particles.map((p, i) =>
        <ParticleCard key={p.id} particle={p} index={i} onUpdate={(id, prop, idx, val) => entity.updateEntity(entity.setParticles, id, prop, idx, val)} onDelete={entity.removeParticle} />
      )}

      {/* 场折叠分组 */}
      <div
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: '10px', marginTop: '20px' }}
        onClick={() => ui.setFieldsExpanded(!ui.fieldsExpanded)}
      >
        <span style={{ marginRight: '8px', transform: ui.fieldsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', display: 'inline-block', fontSize: '0.9em' }}>
          ▼
        </span>
        <h3 style={{ margin: 0, fontSize: '1.1em' }}>{t('fields.sectionTitle', { count: entity.electricFields.length + entity.magneticFields.length })}</h3>
      </div>
      {ui.fieldsExpanded && (
        <>
          {entity.electricFields.map((f, i) => <FieldCard key={f.id} title={t('fields.eField', { index: i + 1 })} field={f} type="E" onUpdate={(id, prop, idx, val) => entity.updateEntity(entity.setElectricFields, id, prop, idx, val)} onDelete={entity.removeEField} />)}
          {entity.magneticFields.map((f, i) => <FieldCard key={f.id} title={t('fields.bField', { index: i + 1 })} field={f} type="B" onUpdate={(id, prop, idx, val) => entity.updateEntity(entity.setMagneticFields, id, prop, idx, val)} onDelete={entity.removeBField} />)}
        </>
      )}
    </div>
  );
}