// ── 粒子/场模板（默认值），纯数据模块 ──

export const fieldTemplate = {
  id: 0, visible: true, start: [0, 0, 0], end: [2, 2, 2], rotation: [0, 0, 0],
  magnitude: 20, shape: 'box', is_infinite: [false, false, false],
  radius: 1, time: { type: 'const', frequency: 1, phase: 0 }, innerRadius: 0.5
};

export const particleTemplate = {
  id: 0, position: [0, 0, 0], radius: 1, velocity: [0, 0, 0],
  charge: 1, mass: 1, trailVisible: true, gravityConstant: 10, enableGravity: false, monitorVisible: false
};