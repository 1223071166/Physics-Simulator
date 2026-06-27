// ── 场景 Save / Load 纯函数模块 ──
// 无 React 依赖，仅依赖 defaults.js 中的模板

import { particleTemplate, fieldTemplate } from '../../data/defaults';

// ── 原子级数值清洗工具集 ──
const safeNum = (val, fallback) => {
  const n = parseFloat(val);
  return (Number.isFinite(n)) ? n : fallback;
};
const safeNumMin = (val, fallback, min) => Math.max(min, safeNum(val, fallback));
const safeNumClamp = (val, fallback, min, max) => {
  const n = safeNum(val, fallback);
  return Math.min(max, Math.max(min, n));
};
const safeBool = (val, fallback) =>
  typeof val === 'boolean' ? val : fallback;
const safeEnum = (val, allowed, fallback) =>
  allowed.includes(val) ? val : fallback;
const safeVec3 = (val, fallback) => {
  if (!Array.isArray(val) || val.length !== 3) return [...fallback];
  return val.map((v, i) => safeNum(v, fallback[i]));
};
const safeBoolVec3 = (val, fallback) => {
  if (!Array.isArray(val) || val.length !== 3) return [...fallback];
  return val.map((v, i) => safeBool(v, fallback[i]));
};
const safeId = (val) =>
  (val !== null && val !== undefined && val !== '' && Number.isFinite(Number(val)) === false
    ? val
    : (Number.isFinite(Number(val)) ? Number(val) : Date.now() + Math.random()));
const safeTime = (val, def) => {
  const d = def ?? { type: 'const', frequency: 1, phase: 0 };
  if (!val || typeof val !== 'object') return { ...d };
  return {
    type: safeEnum(val.type, ['const', 'sin', 'square', 'sawtooth'], d.type),
    frequency: safeNumMin(val.frequency, d.frequency, 0),
    phase: safeNumClamp(val.phase, d.phase, -Math.PI * 2, Math.PI * 2),
  };
};

// ── 实体级清洗 ──
const sanitizeParticles = (data) => {
  const DEF_P = particleTemplate;
  if (!Array.isArray(data)) return [{ ...structuredClone(DEF_P), id: Date.now() + Math.random() }];
  return data.map(p => {
    if (!p || typeof p !== 'object') return { ...structuredClone(DEF_P), id: Date.now() + Math.random() };
    return {
      id: safeId(p.id),
      position: safeVec3(p.position, DEF_P.position),
      velocity: safeVec3(p.velocity, DEF_P.velocity),
      charge: safeNum(p.charge, DEF_P.charge),
      mass: safeNumMin(p.mass, DEF_P.mass, 0.0001),
      radius: safeNumMin(p.radius, DEF_P.radius, 0.1),
      trailVisible: safeBool(p.trailVisible, DEF_P.trailVisible),
      enableGravity: safeBool(p.enableGravity, DEF_P.enableGravity),
      gravityConstant: safeNumMin(p.gravityConstant, DEF_P.gravityConstant, 0),
      monitorVisible: safeBool(p.monitorVisible, DEF_P.monitorVisible),
    };
  });
};

const sanitizeFields = (data) => {
  const DEF_F = fieldTemplate;
  const VALID_SHAPES = ['box', 'cylinder', 'torus', 'sphere'];
  if (!Array.isArray(data)) return [];
  return data.map(f => {
    if (!f || typeof f !== 'object') return { ...structuredClone(DEF_F), id: Date.now() + Math.random() };
    return {
      id: safeId(f.id),
      visible: safeBool(f.visible, DEF_F.visible),
      magnitude: safeNum(f.magnitude, DEF_F.magnitude),
      shape: safeEnum(f.shape, VALID_SHAPES, DEF_F.shape),
      start: safeVec3(f.start, DEF_F.start),
      end: safeVec3(f.end, DEF_F.end),
      rotation: safeVec3(f.rotation, DEF_F.rotation),
      is_infinite: safeBoolVec3(f.is_infinite, DEF_F.is_infinite),
      radius: safeNumMin(f.radius, DEF_F.radius, 0.01),
      innerRadius: safeNumMin(f.innerRadius, DEF_F.innerRadius, 0),
      time: safeTime(f.time, DEF_F.time),
    };
  });
};

// ── 公开 API ──

export function downloadScene(particles, electricFields, magneticFields) {
  const sceneData = { particles, electricFields, magneticFields };
  const jsonString = JSON.stringify(sceneData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'physics_scene.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseSceneFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve({
          particles: sanitizeParticles(data.particles),
          electricFields: sanitizeFields(data.electricFields),
          magneticFields: sanitizeFields(data.magneticFields),
        });
      } catch (error) {
        console.error("加载失败:", error);
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}