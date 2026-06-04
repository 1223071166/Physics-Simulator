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
  const particleTemplate = { id: 0, position: [0, 0, 0], radius: 1 ,velocity: [0, 0, 0], charge: 1, mass: 1};
  
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
        
        // ==========================================
        // 🛡️ 核心护甲：数据清洗函数 (Sanitization)
        // ==========================================
        
        // 1. 向量清洗：确保传入的肯定是长度为 3 的数字数组
        const sanitizeVec = (vec, defaultVec = [0, 0, 0]) => {
          if (!Array.isArray(vec) || vec.length !== 3) return defaultVec;
          return vec.map(v => (isNaN(parseFloat(v)) ? 0 : parseFloat(v)));
        };

        // 2. 粒子清洗：锁死质量和半径的下限
        if (data.particles && Array.isArray(data.particles)) {
          const safeParticles = data.particles.map(p => ({
            ...p,
            id: p.id || Date.now() + Math.random(), // 防止 id 丢失
            position: sanitizeVec(p.position),
            velocity: sanitizeVec(p.velocity),
            charge: isNaN(parseFloat(p.charge)) ? 1 : parseFloat(p.charge),
            // 🌟 终极防御：质量最小 0.0001（防止除以0），半径最小 0.1（防止看不见）
            mass: Math.max(0.0001, parseFloat(p.mass) || 1), 
            radius: Math.max(0.1, parseFloat(p.radius) || 1)
          }));
          setParticles(safeParticles);
        }

        // 3. 场数据清洗 (电场与磁场通用)
        const sanitizeFields = (fields) => {
          if (!fields || !Array.isArray(fields)) return [];
          return fields.map(f => ({
            ...f,
            id: f.id || Date.now() + Math.random(),
            visible: typeof f.visible === 'boolean' ? f.visible : true,
            magnitude: isNaN(parseFloat(f.magnitude)) ? 0 : parseFloat(f.magnitude),
            start: sanitizeVec(f.start, [-2, -2, -2]),
            end: sanitizeVec(f.end, [2, 2, 2]),
            rotation: sanitizeVec(f.rotation, [0, 0, 0]),
            shape: f.shape || 'box'
          }));
        };

        if (data.electricFields) setElectricFields(sanitizeFields(data.electricFields));
        if (data.magneticFields) setMagneticFields(sanitizeFields(data.magneticFields));
        
        // ==========================================

        // 强制暂停引擎，并触发底层物理重置
        setIsRunning(false);
        setResetTrigger(prev => prev + 1);
        
      } catch (error) {
        // 如果文件根本不是 JSON，或者被乱码破坏得连 parse 都失败了
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

          {electricFields.map(f => <FieldVisualizer key={f.id} field={f} type="E" renderTrigger={renderTrigger} />)}
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