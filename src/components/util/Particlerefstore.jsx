// 实时检测功能专用：在 ChargedParticle（物理仿真组件）与
// ParticleMonitor（悬浮检测卡片）之间共享 position / velocity 的引用。
//
// 设计动机：
// - ChargedParticle 内部用 useFrame 以远高于 React 渲染频率的速度
//   （每帧再细分 N 个子步）更新 posRef / velRef，这两个 Vector3 实例
//   是“原地修改”（.set / .addScaledVector），对象引用本身不会变。
// - 如果要做“实时”监测，又不想每帧都触发 React state 更新（那样等于
//   把整个粒子卡片树拉到 60fps 重渲染，violate 现有代码里反复强调的
//   “内存池/防止掉帧”性能原则），最简单的办法就是用一个模块级单例，
//   存的是 ref 本身，UI 侧自己用 requestAnimationFrame 去读、直接改 DOM 文本。
//
// 用法：
//   ChargedParticle:  registerParticleRefs(id, posRef, velRef) / unregisterParticleRefs(id)
//   ParticleMonitor:  getParticleRefs(id) -> { posRef, velRef } | undefined

const store = new Map();

export function registerParticleRefs(id, posRef, velRef) {
  store.set(id, { posRef, velRef });
}

export function unregisterParticleRefs(id) {
  store.delete(id);
}

export function getParticleRefs(id) {
  return store.get(id);
}