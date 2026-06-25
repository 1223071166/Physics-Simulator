import React from 'react';
import { useTranslation } from 'react-i18next'; 
import SmartInput from './SmartInput';
import ParticleMonitor from './ParticleMonitor'; // 【新增】实时检测悬浮卡片
// 粒子卡片
export default function ParticleCard({ particle, index, onUpdate, onDelete}) {
  // 【新增】同时引入本组件的命名空间 particleCard，以及跨组件共享的 common
  const { t } = useTranslation(['particleCard', 'common']);

  // 提取一个通用的横向三维向量输入行
  const renderVecRow = (label, prop) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
      <span style={{ width: '25px', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>{label}</span>
      {['X', 'Y', 'Z'].map((axis, i) => (
        <SmartInput key={axis} value={particle[prop][i]} onCommit={(val) => onUpdate(particle.id, prop, i, val)} />
      ))}
    </div>
  );

  return (
    <>
    <div style={{ backgroundColor: '#333', padding: '12px', borderRadius: '6px', marginBottom: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        {/* 【注意】原来是 `Particle ${index + 1}`，index是动态数字，用 {{index}} 插值 */}
        <strong style={{ color: 'cyan', fontSize: '14px' }}>{t('title', { index: index + 1 })}</strong>
        {/* 轨迹显示/隐藏勾选框与重力启用框 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#ccc', cursor: 'pointer' ,color:'white'}}>
          <input
            type="checkbox"
            checked={particle.trailVisible ?? true}
            onChange={(e) => onUpdate(particle.id, 'trailVisible', null, e.target.checked)}
            style={{ cursor: 'pointer', accentColor: 'cyan' }}
          />
          {t('trail')}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#ccc', cursor: 'pointer' ,color:'white'}}>
          <input
            type="checkbox"
            checked={particle.enableGravity ?? false}
            onChange={(e) => onUpdate(particle.id, 'enableGravity', null, e.target.checked)}
            style={{ cursor: 'pointer', accentColor: 'cyan' }}
          />
          {t('gravity')}
        </label>
        {/* 【新增】实时检测：勾选后弹出可拖动悬浮卡片，实时显示该粒子的位置与速度 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#ccc', cursor: 'pointer' ,color:'white'}}>
          <input
            type="checkbox"
            checked={particle.monitorVisible ?? false}
            onChange={(e) => onUpdate(particle.id, 'monitorVisible', null, e.target.checked)}
            style={{ cursor: 'pointer', accentColor: 'cyan' }}
          />
          {t('monitor')}
        </label>
        {/* 【注意】Del 这个词在 FieldCard 里也出现过，复用 common 命名空间，
            而不是在两个文件里各存一份相同的翻译 */}
        <button onClick={() => onDelete(particle.id)} style={{ backgroundColor: '#ff4b4b', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', padding: '2px 8px', fontSize: '12px' }}>{t('common:actions.delete')}</button>
      </div>
      {/*如果有重力，可以自定义修改重力常量（默认为10） */}
      {particle.enableGravity && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
          {/* 【注意】g/R/q/m 是物理学通用符号，中英文教材都用同样的拉丁字母，
              不当作自然语言翻译，刻意保留硬编码 */}
          <span style={{ color: '#888', fontSize: '12px' }}>g:</span>
          <SmartInput value={particle.gravityConstant} onCommit={(val) => onUpdate(particle.id, 'gravityConstant', null, Math.max(0, val))} />
        </div>
      )}
      {/* 🌟 优雅的表头：标识 X Y Z（坐标轴字母，同样不翻译） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
        <span style={{ width: '25px' }}></span>
        <div style={{ flex: 1, textAlign: 'center', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>X</div>
        <div style={{ flex: 1, textAlign: 'center', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>Y</div>
        <div style={{ flex: 1, textAlign: 'center', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>Z</div>
      </div>
      {/* 极其紧凑的 2 行 XYZ */}
      {renderVecRow(t('pos'), 'position')}
      {renderVecRow(t('vel'), 'velocity')}
      
      {/* 第 3 行：半径、电荷、质量挤在一起（R/q/m 同样是物理符号，不翻译） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderTop: '1px solid #444', paddingTop: '8px' }}>
        <span style={{ color: '#888', fontSize: '12px' }}>R:</span>
        <SmartInput value={particle.radius} onCommit={(val) => onUpdate(particle.id, 'radius', null, Math.max(0.1, val))} />
        <span style={{ color: '#888', fontSize: '12px', marginLeft: '4px' }}>q:</span>
        <SmartInput value={particle.charge} onCommit={(val) => onUpdate(particle.id, 'charge', null, val)} />
        <span style={{ color: '#888', fontSize: '12px', marginLeft: '4px' }}>m:</span>
        <SmartInput value={particle.mass} onCommit={(val) => onUpdate(particle.id, 'mass', null, Math.max(0.1, val))} />
      </div>
    </div>
    {/* 【新增】实时检测悬浮卡片：勾选后渡到 document.body 上，自由拖动 */}
    {particle.monitorVisible && (
      <ParticleMonitor
        particleId={particle.id}
        label={t('title', { index: index + 1 })}
        color={particle.charge > 0 ? '#ff4444' : (particle.charge < 0 ? '#4444ff' : 'cyan')}
        onClose={() => onUpdate(particle.id, 'monitorVisible', null, false)}
      />
    )}
    </>
  );
}