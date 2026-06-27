// ── 实体数据 Context ──
// 管理粒子、电场、磁场的增删改，以及位置/速度的 3D→UI 逆向同步

import React, { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';
import { particleTemplate, fieldTemplate } from '../data/defaults';

const EntityContext = createContext(null);

export function EntityProvider({ children, closeMenu }) {
  const [particles, setParticles] = useState([{ ...structuredClone(particleTemplate), id: 1 }]);
  const [electricFields, setElectricFields] = useState([{ ...structuredClone(fieldTemplate), id: 1 }]);
  const [magneticFields, setMagneticFields] = useState([
    { ...structuredClone(fieldTemplate), id: 2, start: [3, 0, 0], end: [5, 2, 2] }
  ]);

  const particleRefsMap = useRef({});

  const handleParticleRefReady = useCallback((id, vecRef) => {
    if (vecRef) particleRefsMap.current[id] = vecRef;
    else delete particleRefsMap.current[id];
  }, []);

  const syncParticleState = useCallback((id, realPos, realVel) => {
    setParticles(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          position: realPos.map(v => parseFloat(v.toFixed(3))),
          velocity: realVel.map(v => parseFloat(v.toFixed(3)))
        };
      }
      return p;
    }));
  }, []);

  // ── CRUD ──
  const addParticle = useCallback(() => {
    setParticles(prev => [...prev, { ...structuredClone(particleTemplate), id: Date.now() }]);
    closeMenu?.();
  }, [closeMenu]);

  const addEField = useCallback(() => {
    setElectricFields(prev => [...prev, { ...structuredClone(fieldTemplate), id: Date.now() }]);
    closeMenu?.();
  }, [closeMenu]);

  const addBField = useCallback(() => {
    setMagneticFields(prev => [...prev, { ...structuredClone(fieldTemplate), id: Date.now() }]);
    closeMenu?.();
  }, [closeMenu]);

  const updateEntity = useCallback((setter, id, prop, index, val) => {
    setter(prev => prev.map(item => {
      if (item.id === id) {
        if (index !== null) {
          const newArray = [...item[prop]];
          newArray[index] = val;
          return { ...item, [prop]: newArray };
        }
        return { ...item, [prop]: val };
      }
      return item;
    }));
  }, []);

  const removeParticle = useCallback((id) => setParticles(prev => prev.filter(p => p.id !== id)), []);
  const removeEField    = useCallback((id) => setElectricFields(prev => prev.filter(f => f.id !== id)), []);
  const removeBField    = useCallback((id) => setMagneticFields(prev => prev.filter(f => f.id !== id)), []);

  const value = useMemo(() => ({
    particles, setParticles,
    electricFields, setElectricFields,
    magneticFields, setMagneticFields,
    particleRefsMap,
    handleParticleRefReady,
    syncParticleState,
    addParticle, addEField, addBField,
    updateEntity,
    removeParticle, removeEField, removeBField,
  }), [
    particles, electricFields, magneticFields,
    handleParticleRefReady, syncParticleState,
    addParticle, addEField, addBField,
    updateEntity, removeParticle, removeEField, removeBField,
  ]);

  return (
    <EntityContext.Provider value={value}>
      {children}
    </EntityContext.Provider>
  );
}

export function useEntity() {
  const ctx = useContext(EntityContext);
  if (!ctx) throw new Error('useEntity must be used inside <EntityProvider>');
  return ctx;
}