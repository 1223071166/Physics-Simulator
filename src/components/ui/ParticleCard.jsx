import React from 'react';
import SmartInput from './SmartInput';
// 粒子卡片
export default function ParticleCard({ particle, index, onUpdate, onDelete }) {
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
    <div style={{ backgroundColor: '#333', padding: '12px', borderRadius: '6px', marginBottom: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <strong style={{ color: 'cyan', fontSize: '14px' }}>Particle {index + 1}</strong>
        {/* 轨迹显示/隐藏勾选框 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#ccc', cursor: 'pointer' ,color:'white'}}>
          <input
            type="checkbox"
            checked={particle.trailVisible ?? true}
            onChange={(e) => onUpdate(particle.id, 'trailVisible', null, e.target.checked)}
            style={{ cursor: 'pointer', accentColor: 'cyan' }}
          />
          Trail
        </label>
        <button onClick={() => onDelete(particle.id)} style={{ backgroundColor: '#ff4b4b', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', padding: '2px 8px', fontSize: '12px' }}>Del</button>
      </div>
      {/* 🌟 优雅的表头：标识 X Y Z */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
        <span style={{ width: '25px' }}></span>
        <div style={{ flex: 1, textAlign: 'center', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>X</div>
        <div style={{ flex: 1, textAlign: 'center', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>Y</div>
        <div style={{ flex: 1, textAlign: 'center', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>Z</div>
      </div>
      {/* 极其紧凑的 2 行 XYZ */}
      {renderVecRow('Pos', 'position')}
      {renderVecRow('Vel', 'velocity')}
      
      {/* 第 3 行：半径、电荷、质量挤在一起 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderTop: '1px solid #444', paddingTop: '8px' }}>
        <span style={{ color: '#888', fontSize: '12px' }}>R:</span>
        <SmartInput value={particle.radius} onCommit={(val) => onUpdate(particle.id, 'radius', null, Math.max(0.1, val))} />
        <span style={{ color: '#888', fontSize: '12px', marginLeft: '4px' }}>q:</span>
        <SmartInput value={particle.charge} onCommit={(val) => onUpdate(particle.id, 'charge', null, val)} />
        <span style={{ color: '#888', fontSize: '12px', marginLeft: '4px' }}>m:</span>
        <SmartInput value={particle.mass} onCommit={(val) => onUpdate(particle.id, 'mass', null, Math.max(0.1, val))} />
      </div>
    </div>
  );
}