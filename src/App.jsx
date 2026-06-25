import './i18n'
import React, { useState, useRef,createContext, useContext, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next'; // 【新增】
import { Canvas, useFrame,useThree } from '@react-three/fiber';
import { OrbitControls, Text,Trail } from '@react-three/drei';
import * as THREE from 'three';
//导入components组件
import SmartInput from './components/ui/SmartInput';
import ContextMenu from './components/ui/ContextMenu';
import ParticleCard from './components/ui/ParticleCard';
import FieldCard from './components/ui/FieldCard';
import FieldVisualizer from './components/canvas/FieldVisualizer';
import ChargedParticle from './components/canvas/ChargedParticle';
import AdaptiveAxes from './components/canvas/AdaptiveAxes';
import CameraController from './components/util/CameraController';
import {TimeProvider,useTime} from './components/util/Time';
import {Inspector,InspectorProvider} from './components/ui/Inspector'


THREE.Object3D.DEFAULT_UP.set(0, 0, 1); // 让Z轴朝上
export default function App() {
// 【新增】App.jsx自己的翻译命名空间，专门管右键菜单、面板折叠提示、报错弹窗这些散落在顶层组件里的文字
const { t } = useTranslation('app');
// ════════════════════════════════════════════
// 1. 模板 / 默认值
// ════════════════════════════════════════════
const fieldTemplate = {
  id: 0, visible: true, start: [0, 0, 0], end: [2, 2, 2], rotation: [0, 0, 0],
  magnitude: 20, shape: 'box', is_infinite: [false, false, false],
  radius: 1, time: { type: 'const', frequency: 1, phase: 0 }, innerRadius: 0.5
};
const particleTemplate = {
  id: 0, position: [0, 0, 0], radius: 1, velocity: [0, 0, 0],
  charge: 1, mass: 1, trailVisible: true, gravityConstant: 10, enableGravity: false,monitorVisible:false
};

// ════════════════════════════════════════════
// 2. 核心实体状态（粒子 / 电场 / 磁场）
// ════════════════════════════════════════════
const [particles, setParticles] = useState([{ ...structuredClone(particleTemplate), id: 1 }]);
const [electricFields, setElectricFields] = useState([{ ...structuredClone(fieldTemplate), id: 1 }]);
const [magneticFields, setMagneticFields] = useState([
  { ...structuredClone(fieldTemplate), id: 2, start: [3, 0, 0], end: [5, 2, 2] }
]);

// ════════════════════════════════════════════
// 3. Refs（DOM / 第三方实例引用，不触发渲染）
// ════════════════════════════════════════════
const controlsRef = useRef();           // 相机控制器
const fileInputRef = useRef(null);      // 隐藏的文件选择 input（用于 Load）
const timeRef = useRef(null);           // 物理引擎内部时间
const particleRefsMap = useRef({});     // { [particleId]: THREE.Vector3 }，用于摄像头跟踪

// ════════════════════════════════════════════
// 4. 右键 / 左键菜单 UI 状态
// ════════════════════════════════════════════
const [menu, setMenu] = useState({ visible: false, x: 0, y: 0 });   // 右侧菜单（添加实体）
const [menu2, setMenu2] = useState({ visible: false, x: 0, y: 0 });  // 左侧菜单（刷新视图）

// ════════════════════════════════════════════
// 5. 渲染 / 物理引擎运行控制
// ════════════════════════════════════════════
const [renderTrigger, setRenderTrigger] = useState(0); // 强制刷新触发器
const [isRunning, setIsRunning] = useState(false);     // 物理引擎运行状态
const [resetTrigger, setResetTrigger] = useState(0);   // 物理引擎重置触发器
const [speed, setSpeed] = useState(1);                 // 全局运动速度

// ════════════════════════════════════════════
// 6. 面板折叠 / 展开 UI 状态
// ════════════════════════════════════════════
const [particlesExpanded, setParticlesExpanded] = useState(true);
const [fieldsExpanded, setFieldsExpanded] = useState(true);
const [inspectorOpen, setInspectorOpen] = useState(true); // 右侧 inspector 面板折叠状态
const [trailPanelOpen, setTrailPanelOpen] = useState(false);

// ════════════════════════════════════════════
// 7. 轨迹（Trail）全局设置
// ════════════════════════════════════════════
const [trailInfo, setTrailInfo] = useState({
  color: '',   // 空字符串表示"跟随粒子颜色"
  width: 0.8,  // 相对于 particle.radius 的倍数
  length: 600, // Trail 的 length（帧数）
});

// ════════════════════════════════════════════
// 8. 摄像头跟随
// ════════════════════════════════════════════
const [followId, setFollowId] = useState(-1); // -1 表示不跟随

const handleParticleRefReady = React.useCallback((id, vecRef) => {
  if (vecRef) particleRefsMap.current[id] = vecRef;
  else delete particleRefsMap.current[id];
}, []);

// ════════════════════════════════════════════
// 9. "逆向同步"：把 3D 空间的真实坐标/速度同步回 UI 面板
// ════════════════════════════════════════════
const syncParticleState = React.useCallback((id, realPos, realVel) => {
  setParticles(prev => prev.map(p => {
    if (p.id === id) {
      return {
        ...p,
        // 保留 3 位小数，防止 UI 框里出现 0.30000000004 这种丑陋的浮点数
        position: realPos.map(v => parseFloat(v.toFixed(3))),
        velocity: realVel.map(v => parseFloat(v.toFixed(3)))
      };
    }
    return p;
  }));
}, []);

// ════════════════════════════════════════════
// 10. 实体增删改函数
// ════════════════════════════════════════════
// --- 增 ---
const addParticle = () => { setParticles([...particles, { ...structuredClone(particleTemplate), id: Date.now() }]); setMenu({ ...menu, visible: false }); };
const addEField = () => { setElectricFields([...electricFields, { ...structuredClone(fieldTemplate), id: Date.now() }]); setMenu({ ...menu, visible: false }); };
const addBField = () => { setMagneticFields([...magneticFields, { ...structuredClone(fieldTemplate), id: Date.now() }]); setMenu({ ...menu, visible: false }); };

// --- 改（通用） ---
const updateEntity = (setter, id, prop, index, val) => {
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
};

// --- 删 ---
const removeParticle = (id) => setParticles(particles.filter(p => p.id !== id));
const removeEField = (id) => setElectricFields(electricFields.filter(f => f.id !== id));
const removeBField = (id) => setMagneticFields(magneticFields.filter(f => f.id !== id));

// ════════════════════════════════════════════
// 11. 菜单选项（依赖上面的增删函数，必须放在其后）
// ════════════════════════════════════════════
// 【注意】原来是 '+ Particle (粒子)' 这种中英混写的伪双语，已拆成独立翻译key
const rightMenuOptions = [
  { label: t('contextMenu.addParticle'), onClick: addParticle },
  { label: t('contextMenu.addEField'), onClick: addEField },
  { label: t('contextMenu.addBField'), onClick: addBField },
];
const leftMenuOptions = [
  { label: t('contextMenu.refreshView'), onClick: () => { setRenderTrigger(prev => prev + 1); setMenu2({ ...menu2, visible: false }); } }
];

// ════════════════════════════════════════════
// 12. Save / Load（场景的导出与导入，含数据安全清洗）
// ════════════════════════════════════════════
const handleSave = () => {
  // 1. 将宇宙中所有的实体状态打包成一个巨大的 JSON 字典
  const sceneData = { particles, electricFields, magneticFields };
  const jsonString = JSON.stringify(sceneData, null, 2);

  // 2. 利用浏览器的 Blob API，在内存中凭空捏造出一个文本文件
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // 3. 模拟点击一个隐藏的超链接来触发下载
  const link = document.createElement('a');
  link.href = url;
  link.download = 'physics_scene.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const handleLoad = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

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

      // ── 实体级清洗：粒子 ──
      const DEF_P = particleTemplate;
      if (data.particles && Array.isArray(data.particles)) {
        const safeParticles = data.particles.map(p => {
          if (!p || typeof p !== 'object') return { ...structuredClone(DEF_P), id: Date.now() + Math.random() };
          return {
            id: safeId(p.id),
            position: safeVec3(p.position, DEF_P.position),
            velocity: safeVec3(p.velocity, DEF_P.velocity),
            charge: safeNum(p.charge, DEF_P.charge),
            mass: safeNumMin(p.mass, DEF_P.mass, 0.0001),
            radius: safeNumMin(p.radius, DEF_P.radius, 0.1),
            trailVisible: safeBool(p.trailVisible, DEF_P.trailVisible),
          };
        });
        setParticles(safeParticles);
      }

      // ── 实体级清洗：场（电场/磁场通用） ──
      const DEF_F = fieldTemplate;
      const VALID_SHAPES = ['box', 'cylinder', 'torus', 'sphere'];
      const sanitizeFields = (fields) => {
        if (!Array.isArray(fields)) return [];
        return fields.map(f => {
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

      if (data.electricFields) setElectricFields(sanitizeFields(data.electricFields));
      if (data.magneticFields) setMagneticFields(sanitizeFields(data.magneticFields));

      // 强制暂停引擎并触发底层物理重置
      setIsRunning(false);
      setResetTrigger(prev => prev + 1);

    } catch (error) {
      alert(t('errors.loadCorrupted'));
      console.error("加载失败:", error); // 仅开发者可见的console日志，不需要走i18n
    }
  };
  reader.readAsText(file);
  event.target.value = '';
};

// ════════════════════════════════════════════
// 13. 运行控制
// ════════════════════════════════════════════
const handleRun = () => {
  if (!isRunning) {
    timeRef.current?.reset();
    setIsRunning(true);
  }
};

// ════════════════════════════════════════════
// 14. 聚合输出：Inspector 面板所需的全部状态与方法
// ════════════════════════════════════════════
const inspectorValue = {
  // 状态
  isRunning, setIsRunning,
  resetTrigger, setResetTrigger,
  speed, setSpeed,
  trailInfo, setTrailInfo,
  trailPanelOpen, setTrailPanelOpen,
  followId, setFollowId,
  particles, electricFields, magneticFields,
  particlesExpanded, setParticlesExpanded,
  fieldsExpanded, setFieldsExpanded,
  // handlers
  handleRun, handleSave, handleLoad,
  updateEntity, setParticles, setElectricFields, setMagneticFields,
  controlsRef, fileInputRef, removeParticle, removeEField, removeBField
};







//=============执行区===================
  return (
<div>
    <style>{`
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        html, body, #root {
          height: 100%;
          overflow: hidden;
        }
      `}</style>
    <div 
      onClick={() => {setMenu({ ...menu, visible: false });setMenu2({ ...menu2, visible: false })}} 
      style={
        { display: 'flex', 
        width: '100vw', 
        height: '100vh', 
        margin: 0, 
        backgroundColor: '#111', 
        color: 'white', 
        fontFamily: 'sans-serif',
        
        }}>
      {/*左侧渲染区域 */}
      <div 
        style={{ width: inspectorOpen ? '75vw' : '99vw', position: 'relative', outline: 'none' }} tabIndex={0} 
        onContextMenu={(e) => { e.preventDefault(); setMenu2({ visible: true, x: e.clientX, y: e.clientY }); }}
      >
        <Canvas camera={{ position: [10, 10, 10], fov: 50,up: [0, 0, 1] }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <AdaptiveAxes />
          <TimeProvider globalSpeed={speed} ref={timeRef} >
          {electricFields.map(f => <FieldVisualizer key={f.id} field={f} type="E" renderTrigger={renderTrigger}/>)}
          {magneticFields.map(f => <FieldVisualizer key={f.id} field={f} type="B" renderTrigger={renderTrigger} />)}
          {particles.map(p => (
            <ChargedParticle 
              key={p.id} 
              particle={p} 
              electricFields={electricFields} 
              magneticFields={magneticFields}
              isRunning={isRunning}            // 传入启停状态
              resetTrigger={resetTrigger}      // 传入重置触发器
              renderTrigger={renderTrigger}    // 传入渲染触发器
              onSync={syncParticleState}       // 传入状态逆向同步方法
              trailInfo={trailInfo}            // 传入全局轨迹设置 
              onRefReady={handleParticleRefReady}
            />
          ))}</TimeProvider>
          <OrbitControls 
          ref={controlsRef} 
          makeDefault 
          enableDamping 
          dampingFactor={0.05} 
          panSpeed={2}
          enablePan={followId === -1}
          />
          <CameraController controlsRef={controlsRef} followId={followId} particleRefsMap={particleRefsMap}/> 
          
      </Canvas>
      </div>
      {/* 右侧组件区域 */}
      <div style={{ display: 'flex', flexShrink: 0 }}>
      {/* 折叠切换按钮 */}
      <div
        onClick={() => setInspectorOpen(o => !o)}
        style={{
          width: '1vw',
          backgroundColor: '#2a2a2a',
          borderLeft: '1px solid #444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#aaa',
          fontSize: '18px',
          userSelect: 'none',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
        title={inspectorOpen ? t('panel.collapse') : t('panel.expand')}
      >
        {inspectorOpen ? '›' : '‹'}
      </div>
      {/*右侧组件区域主题 */}
      <div
        style={{
          width: inspectorOpen ? '24vw' : '0px',
          overflow: 'hidden',
          transition: 'width 0.3s ease',
          backgroundColor: '#222',
          borderLeft: '1px solid #444',
          
        }}
        onKeyDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ visible: true, x: e.clientX, y: e.clientY }); }}
      >
        <div style={{ width: '24vw', 
          padding: '10px', 
          overflowY: 'auto', 
          height: '100%', 
          boxSizing: 'border-box', }}>
          {/*检查面板 */}  
          <InspectorProvider value={inspectorValue}>
            <Inspector />
          </InspectorProvider>
        </div>
      </div>
      </div>
      <ContextMenu visible={menu.visible} x={menu.x} y={menu.y} options={rightMenuOptions} />
      <ContextMenu visible={menu2.visible} x={menu2.x} y={menu2.y} options={leftMenuOptions} />
    </div>
</div>
  );
}