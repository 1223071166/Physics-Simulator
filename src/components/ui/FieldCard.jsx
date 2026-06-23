import {React,useState,useEffect} from 'react';
import SmartInput from './SmartInput';
import * as THREE from 'three';
export default function FieldCard({ title, field, type, onUpdate, onDelete }) {
  const headerColor = type === 'E' ? '#4facfe' : '#ff4b4b';
  const currentShape = field.shape || 'box';
  const currentTimeType = field.time?.type || 'const';

  // ==========================================
  // 🛡️ 状态安全切换器：切换形状时，清理不兼容的数据
  // ==========================================
  const handleShapeChange = (e) => {
    const newShape = e.target.value;
    onUpdate(field.id, 'shape', null, newShape);
    
    // 重置 is_infinite，防止 Box 的 [x,y,z] 污染 Cylinder 的 [axial, radial]
    const defaultInf = newShape === 'box' ? [false, false, false] :( newShape ==='cylinder' ? [false, false]: [false]);
    onUpdate(field.id, 'is_infinite', null, defaultInf);
  };

  // ==========================================
  // 🎛️ 场强类型切换器：切换时保留 frequency/phase，仅更新 type
  // ==========================================
  const handleTimeTypeChange = (e) => {
    const newType = e.target.value;
    const prevTime = field.time || { frequency: 1, phase: 0 };
    onUpdate(field.id, 'time', null, {
      type: newType,
      frequency: prevTime.frequency ?? 1,
      phase: prevTime.phase ?? 0,
    });
  };

  // ==========================================
  // 🧱 高度封装的 UI 渲染积木库
  // ==========================================

  //第一步，方向向量与欧拉角的互相转换
  // 1. 读取当前的 rotation，逆向推导出当前的方向向量用于展示
  const currentEuler = new THREE.Euler(
    THREE.MathUtils.degToRad(field.rotation[0] || 0),
    THREE.MathUtils.degToRad(field.rotation[1] || 0),
    THREE.MathUtils.degToRad(field.rotation[2] || 0),
    'XYZ'
  );
  // 基础方向沿 Y 轴 (0,1,0)
  const currentDirVec = new THREE.Vector3(0, 1, 0).applyEuler(currentEuler);
  // 真实的本地向量状态
  const [dirArray,setDirArray] = useState(()=>{return [currentDirVec.x, currentDirVec.y, currentDirVec.z].map(v => Number(v.toFixed(3)))});

  // 🌟 新增：临时输入缓冲状态 (用于存放用户在输入框里打字的字符串)
  const [tempDir, setTempDir] = useState([...dirArray]);
  useEffect(() => {
    // 1. 每次外部传入的 field.rotation 改变时，重新计算最新的方向向量
    const currentEuler = new THREE.Euler(
      THREE.MathUtils.degToRad(field.rotation[0] || 0),
      THREE.MathUtils.degToRad(field.rotation[1] || 0),
      THREE.MathUtils.degToRad(field.rotation[2] || 0),
      'XYZ'
    );
    const currentDirVec = new THREE.Vector3(0, 1, 0).applyEuler(currentEuler);
    const syncedDirArr = [currentDirVec.x, currentDirVec.y, currentDirVec.z].map(v => Number(v.toFixed(3)));

    // 2. 覆盖本地的状态，让 UI 输入框强行更新为外部传入的最新值
    setDirArray(syncedDirArr);
    setTempDir(syncedDirArr); // 同时覆盖缓存，防止用户还没点确认就被以前的输入覆盖

  }, [field.rotation]);
  // 临时记录输入框的值
  const handleTempDirChange = (axisIndex, valStr) => {
    const newTemp = [...tempDir];
    newTemp[axisIndex] = valStr;
    setTempDir(newTemp);
  };

  //核心：只有点击确定，或按下回车时，才整体执行计算
  const applyDirection = () => {
    // 1. 解析临时字符串，如果是乱码则按 0 处理
    const parsedDir = tempDir.map(v => isNaN(parseFloat(v)) ? 0 : parseFloat(v));
    const targetVec = new THREE.Vector3(...parsedDir);

    // 2. 🛡️ 防御：如果全是 0，强行恢复默认向上
    if (targetVec.lengthSq() === 0) {
      targetVec.set(0, 1, 0);
    }
    
    // 3. 归一化 (就地修改)
    targetVec.normalize();

    // 4. 将归一化后的完美数字，回写到真实状态和临时状态中，让输入框立刻显示标准单位向量
    const finalDir = [
      Number(targetVec.x.toFixed(3)),
      Number(targetVec.y.toFixed(3)),
      Number(targetVec.z.toFixed(3))
    ];
    setDirArray(finalDir);
    setTempDir(finalDir);

    // 5. 核心数学：计算如何从 (0,1,0) 旋转到目标向量
    const baseVec = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(baseVec, targetVec);
    const newEuler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');

    // 6. 转回角度制
    const newRot = [
      Number(THREE.MathUtils.radToDeg(newEuler.x).toFixed(2)),
      Number(THREE.MathUtils.radToDeg(newEuler.y).toFixed(2)),
      Number(THREE.MathUtils.radToDeg(newEuler.z).toFixed(2))
    ];

    // 7. 发送给上层，真正改变场景中的场
    onUpdate(field.id, 'rotation', null, newRot);
  };
  // 3. 专属的方向向量 UI 积木 (带确认按钮)
  const renderDirectionRow = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
      <span style={{ width:'45px', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>Dir(方向)</span>
      {['X', 'Y', 'Z'].map((axis, i) => (
        <input
          key={`dir-${axis}`}
          type="text"
          value={tempDir[i]}
          onChange={(e) => handleTempDirChange(i, e.target.value)}
          // 加上回车键快捷确定功能，体验更佳
          onKeyDown={(e) => { if (e.key === 'Enter') applyDirection(); }}
          style={{ flex: 1, padding: '4px', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '3px', width: '0', textAlign: 'center' }}
        />
      ))}
      <button 
        onClick={applyDirection}
        title="Apply Direction"
        style={{ 
          padding: '4px 10px', backgroundColor: '#27ae60', color: 'white',
          border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' 
        }}
      >
        ✓
      </button>
    </div>
  );

  // 1. 三维向量输入行 (Start, End, Rotation)
  const renderVec3 = (label, propName) => {
    // 防御性取值，防止对象缺少该属性时崩溃
    const vec = field[propName] || [0, 0, 0]; 
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
        <span style={{ flex:1, color: '#888', fontSize: '12px', fontWeight: 'bold' }}>{label}</span>
        {['X', 'Y', 'Z'].map((axis, i) => (
          <SmartInput key={axis} value={vec[i]} onCommit={(val) => onUpdate(field.id, propName, i, val)} />
        ))}
      </div>
    );
  };

  // 2. 标量输入行 (Radius 等单一数值)
  const renderScalar = (label, propName, minVal = 0) => {
    const val = field[propName] !== undefined ? field[propName] : (minVal || 1);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
        <span style={{ flex:1, color: '#888', fontSize: '12px', fontWeight: 'bold' }}>{label}</span>
        <SmartInput 
          value={val} 
          onCommit={(newVal) => onUpdate(field.id, propName, null, Math.max(minVal, newVal))} 
        />
      </div>
    );
  };

  // 3. 复选框组 (Infinite 设定)
  const renderCheckboxes = (label, labelsArray) => {
    // 动态适配长度，如果尚未定义则初始化全 false
    const currentVals = field.is_infinite || Array(labelsArray.length).fill(false);
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px', padding: '4px 0', backgroundColor: '#333', borderRadius: '4px' }}>
        <span style={{ width: '45px', color: '#aaa', fontSize: '12px', textAlign: 'right', paddingRight: '5px' }}>{label}</span>
        <div style={{ display: 'flex', flex: 1, justifyContent: 'space-around' }}>
          {labelsArray.map((lbl, idx) => (
            <label key={lbl} style={{ fontSize: '11px', color: '#ccc', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!currentVals[idx]}
                onChange={(e) => {
                  // 为了防止 App.jsx 报错，这里必须复制整个数组传回去，而不使用索引更新
                  const newArr = [...currentVals];
                  newArr[idx] = e.target.checked;
                  onUpdate(field.id, 'is_infinite', null, newArr);
                }}
              /> {lbl}
            </label>
          ))}
        </div>
      </div>
    );
  };

  // 4. 频率 & 相位输入行 (仅 sine / square 时显示)
  const renderTimeParams = () => {
    const freq = field.time?.frequency ?? 1;
    const phase = field.time?.phase ?? 0;
    return (
      <div style={{ borderTop: '1px dashed #444', paddingTop: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
          <span style={{ width: '45px', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>Freq(Hz)</span>
          <SmartInput
            value={freq}
            onCommit={(val) => onUpdate(field.id, 'time', null, { ...field.time, frequency: Math.max(0, val) })}
          />
          <span style={{ width: '45px', color: '#888', fontSize: '12px', fontWeight: 'bold' }}>Phase(°)</span>
          <SmartInput
            value={phase}
            onCommit={(val) => onUpdate(field.id, 'time', null, { ...field.time, phase: val })}
          />
        </div>
        
      </div>
    );
  };

  // ==========================================
  // 📐 策略模式：根据不同形状分发渲染视图
  // ==========================================
  
  const renderBoxSettings = () => (
    <>
      {renderVec3('Start', 'start')}
      {renderVec3('End', 'end')}
      {renderVec3('Rot(°)', 'rotation')}
      {renderDirectionRow()}
      {renderCheckboxes('Infinite', ['X-Axis', 'Y-Axis', 'Z-Axis'])}
      {currentTimeType !== 'const' && renderTimeParams()}
    </>
  );

  const renderCylinderSettings = () => (
    <>
      {renderVec3('Start', 'start')}
      {renderVec3('End', 'end')}
      {renderVec3('Rot(°)', 'rotation')}
      {renderDirectionRow()}
      {renderScalar('Radius', 'radius', 0.1)}
      {renderCheckboxes('Infinite', ['Axial(轴向)', 'Radial(径向)'])}
      {currentTimeType !== 'const' && renderTimeParams()}
    </>
  );
  const renderTorusSettings = () => (
    <>
      {renderVec3('Start', 'start')}
      {renderVec3('End', 'end')}
      {renderScalar('OuterRadius(外径)', 'radius', 0.1)}
      {renderScalar('InnerRadius(内径)', 'innerRadius', 0)}
      {renderCheckboxes('Infinite', ['Axial(轴向)'])}
      {currentTimeType !== 'const' && renderTimeParams()}
    </>
  );
  return (
    <div style={{ backgroundColor: '#2a2a2a', padding: '15px', borderRadius: '6px', marginBottom: '15px', borderLeft: `3px solid ${headerColor}` }}>
      
      {/* 头部控制栏：标题、形状选择、显示切换、删除 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <strong style={{ color: headerColor }}>{title}</strong>
        
        {/* 切换场的形状 */}
        <select 
          value={currentShape} 
          onChange={handleShapeChange}
          style={{ 
            backgroundColor: '#333', color: 'white', border: '1px solid #555', 
            borderRadius: '4px', padding: '3px 8px', fontSize: '12px', outline: 'none', cursor: 'pointer'
          }}
        >
          <option value="box">矩形</option>
          <option value="cylinder">圆柱</option>
          <option value="torus">圆环</option>
        </select>

        {/* 切换场强随时间的变化类型 */}
        <select
          value={currentTimeType}
          onChange={handleTimeTypeChange}
          style={{
            backgroundColor: '#333', color: 'white',
            border: '1px solid #555',
            borderRadius: '4px', padding: '3px 8px', fontSize: '12px', outline: 'none', cursor: 'pointer'
          }}
        >
          <option value="const">匀强</option>
          <option value="sine">正弦式</option>
          <option value="square">方波式</option>
        </select>
        
        {/* 显示切换和删除按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '12px', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input type="checkbox" checked={field.visible ?? true} onChange={(e) => onUpdate(field.id, 'visible', null, e.target.checked)} /> Show
          </label>
          <button onClick={() => onDelete(field.id)} style={{ backgroundColor: '#ff4b4b', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', padding: '4px 8px' }}>Del</button>
        </div>
      </div>
      
      {/* 坐标轴提示表头 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
        <span style={{ width: '45px' }}></span>
        <div style={{ flex: 1, textAlign: 'center', color: '#555', fontSize: '12px', fontWeight: 'bold' }}>X</div>
        <div style={{ flex: 1, textAlign: 'center', color: '#555', fontSize: '12px', fontWeight: 'bold' }}>Y</div>
        <div style={{ flex: 1, textAlign: 'center', color: '#555', fontSize: '12px', fontWeight: 'bold' }}>Z</div>
      </div>

      {/* 动态渲染核心属性表单 */}
      {currentShape === 'box' && renderBoxSettings()}
      {currentShape === 'cylinder' && renderCylinderSettings()}
      {currentShape === 'torus' && renderTorusSettings()}
      {/* 统一渲染场强 (Magnitude) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #444' }}>
        <span style={{ width: '70px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>Magnitude</span>
        <SmartInput value={field.magnitude !== undefined ? field.magnitude : 20} onCommit={(val) => onUpdate(field.id, 'magnitude', null, val)} />
      </div>
    </div>
  );
}