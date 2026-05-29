import React from 'react';
// ==========================================
// 右键菜单与主程序
// ==========================================
export default function ContextMenu({ visible, x, y, options }) {
    if (!visible) return null;
    return (
      <div style={{ position: 'absolute', top: y, left: x, backgroundColor: '#333', border: '1px solid #555', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', padding: '5px 0', zIndex: 1000, display: 'flex', flexDirection: 'column', width: '150px' }}>
        {options.map((item, index) => (
          <button key={index} onClick={item.onClick} style={{ background: 'none', border: 'none', color: 'white', padding: '8px 15px', textAlign: 'left', cursor: 'pointer', fontSize: '14px', width: '100%' }}>
            {item.label}
          </button>
        ))}
      </div>
    );
  }
  