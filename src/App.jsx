import React, { useState, useRef, useEffect, useMemo } from 'react';
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

THREE.Object3D.DEFAULT_UP.set(0, 0, 1); // 让Z轴朝上

export default function App() {


  
  //=============定义区==================
  const fieldTemplate = { id: 0, visible: true, start: [0, 0, 0], end: [2, 2, 2], rotation: [0, 0, 0], magnitude: 20 ,shape:'box',is_infinite: [false, false, false],radius:1,time: { type: 'const', frequency: 1, phase: 0 },innerRadius:0.5};
  const particleTemplate = { id: 0, position: [0, 0, 0], radius: 1 ,velocity: [0, 0, 0], charge: 1, mass: 1,trailVisible:true};
  
  const [particles, setParticles] = useState([{...structuredClone(particleTemplate),id:1}]);
  const [electricFields, setElectricFields] = useState([{...structuredClone(fieldTemplate),id:1}]);
  const [magneticFields, setMagneticFields] = useState([{...structuredClone(fieldTemplate),id:2,start:[3,0,0],end:[5,2,2]}]);
  
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0 });
  const [menu2, setMenu2] = useState({ visible: false, x: 0, y: 0 });//这是左侧区域的菜单状态
  const controlsRef = useRef();
  // 强制刷新触发器
  const [renderTrigger, setRenderTrigger] = useState(0);
  
  // 物理引擎运行状态与重置触发器
  const [isRunning, setIsRunning] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);
  // 折叠状态
  const [particlesExpanded, setParticlesExpanded] = useState(true);
  const [fieldsExpanded, setFieldsExpanded] = useState(true);
  //全局运动速度
  const [speed,setSpeed] = useState(1);
  // 轨迹全局设置
  const [trailInfo, setTrailInfo] = useState({
    color: '',        // 空字符串表示"跟随粒子颜色"
    width: 0.8,       // 相对于 particle.radius 的倍数
    length: 600,      // Trail 的 length（帧数）
  });
  const [trailPanelOpen, setTrailPanelOpen] = useState(false);
  //“逆向同步”函数,负责把 3D 空间里的真实坐标/速度，提取并覆盖到 UI 面板上
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
  // 三个添加实体的函数
  const addParticle = () => { setParticles([...particles,{...structuredClone(particleTemplate),id:Date.now()}]); setMenu({ ...menu, visible: false }); };
  const addEField = () => { setElectricFields([...electricFields, {...structuredClone(fieldTemplate),id:Date.now()}]); setMenu({ ...menu, visible: false }); };
  const addBField = () => { setMagneticFields([...magneticFields, {...structuredClone(fieldTemplate),id:Date.now()}]); setMenu({ ...menu, visible: false }); };
  //更新实体的函数
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
  const removeParticle = (id) => setParticles(particles.filter(p => p.id !== id));
  const removeEField = (id) => setElectricFields(electricFields.filter(f => f.id !== id));
  const removeBField = (id) => setMagneticFields(magneticFields.filter(f => f.id !== id));

  const rightMenuOptions = [
    { label: '+ Particle (粒子)', onClick: addParticle },
    { label: '+ E-Field (电场)', onClick: addEField },
    { label: '+ B-Field (磁场)', onClick: addBField },
  ];
  const leftMenuOptions = [
    { label: 'Refresh View (刷新视图)', onClick: () => { setRenderTrigger(prev => prev + 1); setMenu2({ ...menu2, visible: false }); } }
  ];

  // ==========================================
  // Save & Load 核心逻辑,注意load时的数据安全处理问题
  // ==========================================
  const fileInputRef = useRef(null);

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
  
        // ══════════════════════════════════════════════════════
        // 🛡️ 原子级数值清洗工具集
        // ══════════════════════════════════════════════════════
  
        // 安全数字：必须是有限实数，不接受 NaN / Infinity / null / 字符串垃圾
        const safeNum = (val, fallback) => {
          const n = parseFloat(val);
          return (Number.isFinite(n)) ? n : fallback;
        };
  
        // 有下限的安全数字（用于 mass、radius 等物理上不能为零/负的量）
        const safeNumMin = (val, fallback, min) => Math.max(min, safeNum(val, fallback));
  
        // 有上下限的安全数字（用于归一化参数、角度等有明确范围的量）
        const safeNumClamp = (val, fallback, min, max) => {
          const n = safeNum(val, fallback);
          return Math.min(max, Math.max(min, n));
        };
  
        // 安全布尔：只认 true/false，其他一律降级为 fallback
        const safeBool = (val, fallback) =>
          typeof val === 'boolean' ? val : fallback;
  
        // 安全枚举：值必须在白名单内，否则取 fallback
        const safeEnum = (val, allowed, fallback) =>
          allowed.includes(val) ? val : fallback;
  
        // 安全向量：长度必须严格为 3，每个分量独立清洗
        const safeVec3 = (val, fallback) => {
          if (!Array.isArray(val) || val.length !== 3) return [...fallback];
          return val.map((v, i) => safeNum(v, fallback[i]));
        };
  
        // 安全 bool 向量（用于 is_infinite）
        const safeBoolVec3 = (val, fallback) => {
          if (!Array.isArray(val) || val.length !== 3) return [...fallback];
          return val.map((v, i) => safeBool(v, fallback[i]));
        };
  
        // 安全 id：必须是非空的 number 或 string
        const safeId = (val) =>
          (val !== null && val !== undefined && val !== '' && Number.isFinite(Number(val)) === false
            ? val                           // 合法字符串 id
            : (Number.isFinite(Number(val)) ? Number(val) : Date.now() + Math.random()));
  
        // 安全 time 子对象（场的时变参数）
        const safeTime = (val, def) => {
          const d = def ?? { type: 'const', frequency: 1, phase: 0 };
          if (!val || typeof val !== 'object') return { ...d };
          return {
            type:      safeEnum(val.type, ['const', 'sin', 'square', 'sawtooth'], d.type),
            frequency: safeNumMin(val.frequency, d.frequency, 0),   // 频率不能为负
            phase:     safeNumClamp(val.phase, d.phase, -Math.PI * 2, Math.PI * 2),
          };
        };
  
        // ══════════════════════════════════════════════════════
        // 🧬 实体级清洗：粒子
        // ══════════════════════════════════════════════════════
        const DEF_P = particleTemplate; // 直接引用模板作为默认值来源
  
        if (data.particles && Array.isArray(data.particles)) {
          const safeParticles = data.particles.map(p => {
            if (!p || typeof p !== 'object') return { ...structuredClone(DEF_P), id: Date.now() + Math.random() };
            return {
              id:           safeId(p.id),
              position:     safeVec3(p.position,     DEF_P.position),
              velocity:     safeVec3(p.velocity,     DEF_P.velocity),
              charge:       safeNum(p.charge,        DEF_P.charge),           // 电荷允许负数和零
              mass:         safeNumMin(p.mass,       DEF_P.mass,    0.0001),  // 质量最小 0.0001，防除零
              radius:       safeNumMin(p.radius,     DEF_P.radius,  0.1),     // 半径最小 0.1，防隐形
              trailVisible: safeBool(p.trailVisible, DEF_P.trailVisible),
            };
          });
          setParticles(safeParticles);
        }
  
        // ══════════════════════════════════════════════════════
        // 🧲 实体级清洗：场（电场/磁场通用）
        // ══════════════════════════════════════════════════════
        const DEF_F = fieldTemplate;
        const VALID_SHAPES = ['box', 'cylinder', 'torus', 'sphere'];
  
        const sanitizeFields = (fields) => {
          if (!Array.isArray(fields)) return [];
          return fields.map(f => {
            if (!f || typeof f !== 'object') return { ...structuredClone(DEF_F), id: Date.now() + Math.random() };
            return {
              id:          safeId(f.id),
              visible:     safeBool(f.visible,      DEF_F.visible),
              magnitude:   safeNum(f.magnitude,     DEF_F.magnitude),         // 允许负场强（反向场）
              shape:       safeEnum(f.shape,        VALID_SHAPES, DEF_F.shape),
              start:       safeVec3(f.start,        DEF_F.start),
              end:         safeVec3(f.end,          DEF_F.end),
              rotation:    safeVec3(f.rotation,     DEF_F.rotation),
              is_infinite: safeBoolVec3(f.is_infinite, DEF_F.is_infinite),
              radius:      safeNumMin(f.radius,     DEF_F.radius,      0.01), // 半径不能为零
              innerRadius: safeNumMin(f.innerRadius,DEF_F.innerRadius, 0),    // 内径允许为零
              time:        safeTime(f.time,         DEF_F.time),
            };
          });
        };
  
        if (data.electricFields) setElectricFields(sanitizeFields(data.electricFields));
        if (data.magneticFields) setMagneticFields(sanitizeFields(data.magneticFields));
  
        // 强制暂停引擎并触发底层物理重置
        setIsRunning(false);
        setResetTrigger(prev => prev + 1);
  
      } catch (error) {
        alert("存档文件已损坏或格式非法！");
        console.error("加载失败:", error);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };



//时间函数，用于在运行时将时间归零
  function ClockExporter({ clockRef }) {
    const { clock } = useThree();
    clockRef.current = clock;
    return null;
  }
  const clockRef = useRef(null);

const handleRun = () => {
  // 归零：stop() 重置内部计时，start() 重新开始
  if (clockRef.current) {
    clockRef.current.stop();
    clockRef.current.start();
  }
  setIsRunning(true);
};
  //=============执行区===================
  return (
    <div onClick={() => {setMenu({ ...menu, visible: false });setMenu2({ ...menu2, visible: false })}} style={{ display: 'flex', width: '100vw', height: '100vh', margin: 0, backgroundColor: '#111', color: 'white', fontFamily: 'sans-serif' }}>
      {/*左侧渲染区域 */}
      <div 
        style={{ flex: 1, position: 'relative', outline: 'none' }} tabIndex={0} 
        onContextMenu={(e) => { e.preventDefault(); setMenu2({ visible: true, x: e.clientX, y: e.clientY }); }}
      >
        <Canvas camera={{ position: [10, 10, 10], fov: 50,up: [0, 0, 1] }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <ClockExporter clockRef={clockRef} />
          <AdaptiveAxes />

          {electricFields.map(f => <FieldVisualizer key={f.id} field={f} type="E" renderTrigger={renderTrigger} globalSpeed={speed}/>)}
          {magneticFields.map(f => <FieldVisualizer key={f.id} field={f} type="B" renderTrigger={renderTrigger} globalSpeed={speed} />)}
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
              globalSpeed={speed}              // 传入全局速度
              trailInfo={trailInfo}            // 传入全局轨迹设置 

            />
          ))}
          <OrbitControls 
          ref={controlsRef} 
          makeDefault 
          enableDamping 
          dampingFactor={0.05} 
          panSpeed={2}/>
          <CameraController controlsRef={controlsRef} /> 
          
        
        
      </Canvas>
      </div>

      {/*右侧组件区域 */}
      <div 
        style={{ width: '350px', backgroundColor: '#222', borderLeft: '1px solid #444', padding: '20px', overflowY: 'auto' }} onKeyDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ visible: true, x: e.clientX, y: e.clientY }); }}
      >
        <h2 style={{ marginTop: 0, borderBottom: '1px solid #555', paddingBottom: '10px' }}>Physics Inspector</h2>
         {/*三维引擎中控台按钮组 */}
         <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
          <button onClick={handleRun} style={{ flex: 1, padding: '8px', backgroundColor: isRunning ? '#27ae60' : '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            ▶ Run
          </button>
          <button onClick={() => setIsRunning(false)} style={{ flex: 1, padding: '8px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            ⏸ Stop
          </button>
          <button onClick={() => { setIsRunning(false); setResetTrigger(prev => prev + 1); }} style={{ flex: 1, padding: '8px', backgroundColor: '#34495e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            ⏹ Reset
          </button>
        </div>
        {/* 隐藏的文件读取器，专门用来接收文件 */}
        <input 
          type="file" 
          accept=".json" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleLoad} 
        />

        {/* Save & Load 档案管理组 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button onClick={handleSave} style={{ flex: 1, padding: '8px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            💾 Save Scene
          </button>
          <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: '8px', backgroundColor: '#f39c12', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            📂 Load Scene
          </button>
        </div>
        <button onClick={() => controlsRef.current?.reset()} style={{ width: '100%', padding: '10px', backgroundColor: '#e67e22', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '20px' }}>
          🎥 Reset Camera
        </button>
        {/* ========== 轨迹设置按钮 + 面板 ========== */}
        <button
          onClick={() => setTrailPanelOpen(o => !o)}
          style={{ width: '100%', padding: '10px', backgroundColor: trailPanelOpen ? '#1a6b8a' : '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}
        >
          ✨ Trail Settings {trailPanelOpen ? '▲' : '▼'}
        </button>

        {trailPanelOpen && (
          <div style={{ backgroundColor: '#1a1a2e', border: '1px solid #17a2b8', borderRadius: '6px', padding: '14px', marginBottom: '20px' }}>
            
            {/* 颜色 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', color: '#aaa' }}>Trail Color</label>
                <label style={{ fontSize: '11px', color: '#666', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={trailInfo.color === ''}
                    onChange={(e) => setTrailInfo(t => ({ ...t, color: e.target.checked ? '' : '#ffffff' }))}
                    style={{ cursor: 'pointer', accentColor: '#17a2b8' }}
                  />
                  Auto (follow particle)
                </label>
              </div>
              {trailInfo.color !== '' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={trailInfo.color}
                    onChange={(e) => setTrailInfo(t => ({ ...t, color: e.target.value }))}
                    style={{ width: '48px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent', padding: 0 }}
                  />
                  <span style={{ fontSize: '13px', color: '#ccc', fontFamily: 'monospace' }}>{trailInfo.color}</span>
                </div>
              )}
            </div>

            {/* 粗细 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '13px', color: '#aaa' }}>Width multiplier</label>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{trailInfo.width.toFixed(2)}×</span>
              </div>
              <input
                type="range" min={0.1} max={5} step={0.05} value={trailInfo.width}
                onChange={(e) => setTrailInfo(t => ({ ...t, width: parseFloat(e.target.value) }))}
                style={{ width: '100%', accentColor: '#17a2b8', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginTop: '2px' }}>
                <span>thin</span><span>thick</span>
              </div>
            </div>

            {/* 持续时间（length） */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '13px', color: '#aaa' }}>Length (frames)</label>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{trailInfo.length}</span>
              </div>
              <input
                type="range" min={10} max={2000} step={10} value={trailInfo.length}
                onChange={(e) => setTrailInfo(t => ({ ...t, length: parseInt(e.target.value) }))}
                style={{ width: '100%', accentColor: '#17a2b8', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginTop: '2px' }}>
                <span>short</span><span>long</span>
              </div>
            </div>

          </div>
        )}
        {/* ========== 全局速度控制 ========== */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '14px', color: '#aaa' }}>Simulation Speed</label>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', minWidth: '32px', textAlign: 'right' }}>
              {speed.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#2ecc71', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#666', marginTop: '3px' }}>
            <span>0 (paused)</span>
            <span>1x (full)</span>
          </div>
        </div>
        {/* ========== 粒子折叠分组 ========== */}
        <div 
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: '10px' }} 
          onClick={() => setParticlesExpanded(!particlesExpanded)}
        >
          <span style={{ 
            marginRight: '8px', 
            transform: particlesExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', 
            transition: 'transform 0.2s',
            display: 'inline-block',
            fontSize: '0.9em'
          }}>
            ▼
          </span>
          <h3 style={{ margin: 0, fontSize: '1.1em' }}>Particles ({particles.length})</h3>
        </div>
        {particlesExpanded && particles.map((p, i) => 
          <ParticleCard key={p.id} particle={p} index={i} onUpdate={(id, prop, idx, val) => updateEntity(setParticles, id, prop, idx, val)} onDelete={removeParticle} />
        )}
        {/* ========== 场折叠分组（电场+磁场） ========== */}
        <div 
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: '10px', marginTop: '20px' }} 
          onClick={() => setFieldsExpanded(!fieldsExpanded)}
        >
          <span style={{ 
            marginRight: '8px', 
            transform: fieldsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', 
            transition: 'transform 0.2s',
            display: 'inline-block',
            fontSize: '0.9em'
          }}>
            ▼
          </span>
          <h3 style={{ margin: 0, fontSize: '1.1em' }}>Fields ({electricFields.length + magneticFields.length})</h3>
        </div>
        {fieldsExpanded && (
          <>
            {electricFields.map((f, i) => <FieldCard key={f.id} title={`E-Field ${i + 1}`} field={f} type="E" onUpdate={(id, prop, idx, val) => updateEntity(setElectricFields, id, prop, idx, val)} onDelete={removeEField} />)}
            {magneticFields.map((f, i) => <FieldCard key={f.id} title={`B-Field ${i + 1}`} field={f} type="B" onUpdate={(id, prop, idx, val) => updateEntity(setMagneticFields, id, prop, idx, val)} onDelete={removeBField} />)}
          </>
        )}
      
      </div>

      <ContextMenu visible={menu.visible} x={menu.x} y={menu.y} options={rightMenuOptions} />
      <ContextMenu visible={menu2.visible} x={menu2.x} y={menu2.y} options={leftMenuOptions} />
    </div>
  );
}
/* =====================================================================
 * 这是外部函数的使用指南
 * * 📂 UI 组件组 (src/components/ui/):
 * * 1. <SmartInput value={Number|String} onCommit={(val) => void} />
 * - 作用: 防抖的智能输入框。
 * - 交互: 失去焦点或按回车时触发 onCommit 传递最终数值。
 * 
 * * 2. <ContextMenu visible={Boolean} x={Number} y={Number} options={Array} />
 * - options 格式: [{ label: '按钮文字', onClick: () => void }]
 * - 作用: 悬浮的右键菜单。
 * 
 * * 3. <ParticleCard particle={Object} index={Number} onUpdate={Function} onDelete={Function} />
 * - particle 结构: { id, position: [x,y,z], velocity: [x,y,z], charge, mass, radius }
 * - onUpdate 签名: (id, propName, arrayIndex, newValue) => void
 * - onDelete 签名: (id) => void
 * 
 * * 4. <FieldCard title={String} field={Object} type={"E"|"B"} onUpdate={Function} onDelete={Function} />
 * - field 结构: { id, visible, start: [x,y,z], end: [x,y,z], rotation: [x,y,z], magnitude }
 * * 
 * 📂 3D 渲染组件组 (src/components/canvas/):
 * * 5. <FieldVisualizer field={Object} type={"E"|"B"} renderTrigger={Number} />
 * - 作用: 渲染电磁场的线框与内部的向量箭头矩阵。
 * - 注意: renderTrigger 改变时会触发内部的视锥体 LOD 剔除重算。
 * 
 * * 6. <ChargedParticle 
 * particle={Object} 
 * electricFields={Array} 
 * magneticFields={Array} 
 * isRunning={Boolean} 
 * resetTrigger={Number} 
 * renderTrigger={Number} 
 * onSync={(id, realPosArr, realVelArr) => void} 
 * />
 * - 作用: 包含独立物理循环 (useFrame) 的粒子实体。
 * - 物理引擎规则: 开启 isRunning 时才进行时间步积分；收到 resetTrigger 变化时瞬间将显卡坐标重置为 props 传入的初始坐标。
 * ===================================================================== */