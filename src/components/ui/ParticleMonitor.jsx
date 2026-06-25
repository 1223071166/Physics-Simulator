import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getParticleRefs } from '../util/Particlerefstore.jsx';

// 实时检测卡片：勾选 ParticleCard 里的“实时检测”后弹出，
// 可自由拖动，实时显示该粒子的 position / velocity / 速度大小。
export default function ParticleMonitor({ particleId, label, color = 'cyan', onClose }) {
  const { t } = useTranslation(['particleCard', 'common']);
  const cardRef = useRef();
  const posTextRef = useRef();
  const velTextRef = useRef();
  const speedTextRef = useRef();

  // 卡片在屏幕上的位置，仅在拖动时才更新（不参与 60fps 的数值刷新）
  const [pos, setPos] = useState({ x: 24, y: 24 });
  const dragState = useRef({ dragging: false, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    const handleMove = (e) => {
      if (!dragState.current.dragging) return;
      setPos({
        x: e.clientX - dragState.current.offsetX,
        y: e.clientY - dragState.current.offsetY,
      });
    };
    const handleUp = () => { dragState.current.dragging = false; };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const handleMouseDown = (e) => {
    const rect = cardRef.current.getBoundingClientRect();
    dragState.current.dragging = true;
    dragState.current.offsetX = e.clientX - rect.left;
    dragState.current.offsetY = e.clientY - rect.top;
  };

  // 实时刷新：直接操作 DOM 文本，绕开 React 渲染树，
  // 和 ChargedParticle 物理引擎里“内存池防止掉帧”的思路一致
  useEffect(() => {
    let rafId;
    const tick = () => {
      const refs = getParticleRefs(particleId);
      if (refs) {
        const p = refs.posRef.current;
        const v = refs.velRef.current;
        if (posTextRef.current) {
          posTextRef.current.textContent = `${p.x.toFixed(5)}, ${p.y.toFixed(5)}, ${p.z.toFixed(5)}`;
        }
        if (velTextRef.current) {
          velTextRef.current.textContent = `${v.x.toFixed(5)}, ${v.y.toFixed(5)}, ${v.z.toFixed(5)}`;
        }
        if (speedTextRef.current) {
          const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
          speedTextRef.current.textContent = speed.toFixed(5);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [particleId]);

  return createPortal(
    <div
      ref={cardRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        backgroundColor: '#262626',
        border: `1px solid ${color}`,
        borderRadius: '6px',
        padding: '10px 12px',
        minWidth: '190px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        userSelect: 'none',
        fontFamily: 'monospace',
      }}
    >
      <div
        onMouseDown={handleMouseDown}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'move',
          marginBottom: '8px',
          paddingBottom: '6px',
          borderBottom: '1px solid #444',
        }}
      >
        <strong style={{ color, fontSize: '12px' }}>{label}</strong>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '14px',
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
        <span style={{ width: '25px' }}></span>
        <div style={{ flex: 1, textAlign: 'center', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>X</div>
        <div style={{ flex: 1, textAlign: 'center', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>Y</div>
        <div style={{ flex: 1, textAlign: 'center', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>Z</div>
      </div>
      <div style={{ fontSize: '12px', color: '#ccc', lineHeight: 1.7 }}>
        <div>{t('monitorPos')}: <span ref={posTextRef} style={{ color: 'white' }}>-</span></div>
        <div>{t('monitorVel')}: <span ref={velTextRef} style={{ color: 'white' }}>-</span></div>
        <div>{t('monitorSpeed')}: <span ref={speedTextRef} style={{ color: 'white' }}>-</span></div>
      </div>
    </div>,
    document.body
  );
}