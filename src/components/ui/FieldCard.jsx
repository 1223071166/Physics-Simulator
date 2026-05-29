import React from 'react';
import SmartInput from './SmartInput';
export default function FieldCard({ title, field, type, onUpdate, onDelete }) {
  const headerColor = type === 'E' ? '#4facfe' : '#ff4b4b';

  const renderRow = (label, propName) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
      <span style={{ width: '45px', color: '#888', fontSize: '12px' }}>{label}</span>
      {['X', 'Y', 'Z'].map((axis, i) => (
        <SmartInput key={axis} value={field[propName][i]} onCommit={(val) => onUpdate(field.id, propName, i, val)} />
      ))}
    </div>
  );

  return (
    <div style={{ backgroundColor: '#2a2a2a', padding: '15px', borderRadius: '6px', marginBottom: '15px', borderLeft: `3px solid ${headerColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <strong style={{ color: headerColor }}>{title}</strong>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '12px', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input type="checkbox" checked={field.visible} onChange={(e) => onUpdate(field.id, 'visible', null, e.target.checked)} /> Show
          </label>
          <button onClick={() => onDelete(field.id)} style={{ backgroundColor: '#ff4b4b', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', padding: '4px 8px' }}>Del</button>
        </div>
      </div>
      
      {/* 🌟 优雅的表头：标识 X Y Z */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
        <span style={{ width: '45px' }}></span>
        <div style={{ flex: 1, textAlign: 'center', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>X</div>
        <div style={{ flex: 1, textAlign: 'center', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>Y</div>
        <div style={{ flex: 1, textAlign: 'center', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>Z</div>
      </div>

      {renderRow('Start', 'start')}
      {renderRow('End', 'end')}
      {renderRow('Rot(°)', 'rotation')}

      {/* 🌟 新增：独立控制场强大小的输入框 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #444' }}>
        <span style={{ width: '70px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>Magnitude</span>
        <SmartInput value={field.magnitude} onCommit={(val) => onUpdate(field.id, 'magnitude', null, val)} />
      </div>
    </div>
  );
}
