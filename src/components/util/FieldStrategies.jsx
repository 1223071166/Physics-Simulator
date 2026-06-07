
import * as THREE from 'three';

// 基础场接口
//干脆再加个type表示电场还是磁场
//id: 1, visible: true, start: [-4, 0, -4], end: [0, 4, 0], rotation: [0, 0, 0]
//magnitude: 20,shape:'box'
//矩形场会出现start和end,圆柱场出现start,end,radius(刻画轴的位置和半径）
//目前会出现，方向不变的矩形场、圆柱场，强度可能会随时间变化
//然后方向始终沿圆切向的空心圆柱场（多一个外径和内径）
//还要考虑到它们某一方向无限长的情况
//矩形场可以定义 is_infinite[x,y,z];圆柱场可以用is_infinate[axis,radius]
//空心圆柱场只能用is_infinite[axis]
//关于时变情况：time : {type:'sine'/'const'/'square',frequency:1,phase:0}
//如果type是cosnt就不用理后面的东西

/*
汇总一下field的所有属性：
id,visible,start,end,rotation,magnitude
radius,innerRadius,is_infinite
shape(box,cylinder,torus),time : {type:'sine'/'const'/'square',frequency,phase}
*/
export class BaseField {
    constructor(config) {
      this.id = config.id;
      this.type = config.type || 'E'; // 'E' 代表电场，'B' 代表磁场
      this.shape = config.shape || 'box';
      this.magnitude = config.magnitude || 0;
      this.visible = config.visible ?? true;
      this.rotation = config.rotation || [0, 0, 0];
  
      // 时变配置：{ type: 'const' | 'sine' | 'square', frequency: 1, phase: 0 }
      this.timeConfig = config.time || { type: 'const' };
    }
  
    // 统一的随时间变化的强度系数计算
    // 公式：系数 = sin(2 * π * f * t + φ)
    getTimeFactor(time,globalSpeed) {
      if (this.timeConfig.type === 'const') return 1;
   
      const freq = this.timeConfig.frequency || 1;
      const phase = this.timeConfig.phase || 0;
      const wt = 2 * Math.PI * freq * time *globalSpeed + phase;
  
      if (this.timeConfig.type === 'sine') {
        return Math.sin(wt);
      } else if (this.timeConfig.type === 'square') {
        return Math.sin(wt) >= 0 ? 1 : -1;
      }
      return 1;
    }
  
    // 核心方法：子类必须覆盖此方法
    getVector(position, time,targetVector,globalSpeed) {
      targetVector.set(0, 0, 0);
    }
  }
  
  // ==========================================
  // 矩形场实现
  // ==========================================
  export class BoxField extends BaseField {
    constructor(config) {
      super(config);
      this.start = config.start || [-2, -2, -2];
      this.end = config.end || [2, 2, 2];
      // [x无限长, y无限长, z无限长]
      this.isInfinite = config.is_infinite || [false, false, false];
  
      // 性能优化：在构造时预计算方向向量，避免每帧重复生成 Euler 和 Vector3
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(this.rotation[0]),
        THREE.MathUtils.degToRad(this.rotation[1]),
        THREE.MathUtils.degToRad(this.rotation[2]),
        'XYZ'
      );
      // 默认方向沿 Y 轴
      this.baseDirection = new THREE.Vector3(0, 1, 0).applyEuler(euler);
  
      // 预计算并排序边界极值
      this.minBounds = [
        Math.min(this.start[0], this.end[0]),
        Math.min(this.start[1], this.end[1]),
        Math.min(this.start[2], this.end[2])
      ];
      this.maxBounds = [
        Math.max(this.start[0], this.end[0]),
        Math.max(this.start[1], this.end[1]),
        Math.max(this.start[2], this.end[2])
      ];
    }
  
    getVector(position, time, targetVector,globalSpeed) {
        if (this.magnitude === 0) {
          targetVector.set(0, 0, 0);
          return;
        }
      
        const posArray = [position.x, position.y, position.z];
        for (let i = 0; i < 3; i++) {
          if (!this.isInfinite[i]) {
            if (posArray[i] < this.minBounds[i] || posArray[i] > this.maxBounds[i]) {
              targetVector.set(0, 0, 0);
              return;
            }
          }
        }
      
        const currentMagnitude = this.magnitude * this.getTimeFactor(time,globalSpeed);
        targetVector.copy(this.baseDirection).multiplyScalar(currentMagnitude);
    }
}
// ==========================================
// 圆柱场实现
// ==========================================
export class CylinderField extends BaseField {
    constructor(config) {
      super(config);
      // 几何参数
      this.start = config.start || [-2, -2, -2];
      this.end = config.end || [2, 2, 2];
      this.radius = config.radius || 1;
      
      // [轴向无限长, 径向无限长]
      this.isInfinite = config.is_infinite || [false, false];
  
      // 预计算静态方向向量 (与 BoxField 一致，保持场强的统一方向)
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(this.rotation[0]),
        THREE.MathUtils.degToRad(this.rotation[1]),
        THREE.MathUtils.degToRad(this.rotation[2]),
        'XYZ'
      );
      this.baseDirection = new THREE.Vector3(0, 1, 0).applyEuler(euler);
  
      // 预计算圆柱的拓扑特征向量
      this.startVec = new THREE.Vector3(...this.start);
      this.endVec = new THREE.Vector3(...this.end);
      
      // axisVec = end - start (圆柱的脊椎骨)
      this.axisVec = new THREE.Vector3().subVectors(this.endVec, this.startVec);
      this.axisLenSq = this.axisVec.lengthSq(); // 脊椎长度的平方
      this.radiusSq = this.radius * this.radius; // 半径的平方
  
      // 提前声明计算过程所需的临时变量，坚决防止内存抖动
      this._spVec = new THREE.Vector3();     // 粒子到起点的向量
      this._projVec = new THREE.Vector3();   // 粒子在中轴线上的投影点
      this._radialVec = new THREE.Vector3(); // 粒子到中轴线的垂直向量
    }
  
    getVector(position, time, targetVector,globalSpeed) {
      // 防御性拦截：无场强、或者圆柱长度为 0 (变成了球)
      if (this.magnitude === 0 || this.axisLenSq === 0) {
        targetVector.set(0, 0, 0);
        return;
      }
  
      // 计算向量 SP (Start -> Position)
      this._spVec.subVectors(position, this.startVec);
  
      // 1. 轴向判定 (Axial Check)
      // 核心数学：利用点积计算投影比例 t = (SP · axis) / |axis|^2
      const t = this._spVec.dot(this.axisVec) / this.axisLenSq;
  
      if (!this.isInfinite[0]) {
        // 轴向非无限：粒子必须夹在 start 和 end 之间
        if (t < 0 || t > 1) {
          targetVector.set(0, 0, 0);
          return;
        }
      }
  
      // 2. 径向判定 (Radial Check)
      if (!this.isInfinite[1]) {
        // 找准粒子在中轴线上的影子：投影点 = Start + t * axis
        this._projVec.copy(this.axisVec).multiplyScalar(t).add(this.startVec);
        
        // 算出垂直距离向量 = Position - 投影点
        this._radialVec.subVectors(position, this._projVec);
        
        // 如果偏离中轴线的距离平方 > 半径平方，说明飞出去了
        if (this._radialVec.lengthSq() > this.radiusSq) {
          targetVector.set(0, 0, 0);
          return;
        }
      }
  
      // 3. 生效区内：应用时变因子并返回场强
      const currentMagnitude = this.magnitude * this.getTimeFactor(time,globalSpeed);
      
      // 写入目标向量
      targetVector.copy(this.baseDirection).multiplyScalar(currentMagnitude);
    }
  }
// ==========================================
// 空心圆柱（环形）切向场实现
// ==========================================
// 场强方向：始终沿截面圆切向（axisUnit × radialUnit）
// 判定区域：innerRadius < 径向距离 < outerRadius，轴向夹在 start~end 之间
// is_infinite：[轴向无限长]（切向场径向天然有界，不提供径向无限选项）
export class TorusField extends BaseField {
  constructor(config) {
    super(config);

    this.start       = config.start       || [-2, -2, -2];
    this.end         = config.end         || [2,  2,  2];
    this.radius      = config.radius      || 2;   // 外半径
    this.innerRadius = config.innerRadius || 1;   // 内半径

    // [轴向无限长]
    this.isInfinite = config.is_infinite || [false];

    // ── 预计算圆柱拓扑特征 ─────────────────────────────────────────────────
    this.startVec  = new THREE.Vector3(...this.start);
    this.endVec    = new THREE.Vector3(...this.end);

    // 轴向单位向量（脊椎方向）
    this.axisVec   = new THREE.Vector3().subVectors(this.endVec, this.startVec);
    this.axisLenSq = this.axisVec.lengthSq();
    this.axisUnit  = this.axisVec.clone().normalize(); // 归一化，叉积时需要单位向量

    // 平方缓存
    this.outerRadiusSq = this.radius      * this.radius;
    this.innerRadiusSq = this.innerRadius * this.innerRadius;

    // ── 预分配每帧复用的临时对象，彻底避免 GC 抖动 ────────────────────────
    this._spVec      = new THREE.Vector3(); // Start → Position
    this._projVec    = new THREE.Vector3(); // 轴线上的投影点
    this._radialVec  = new THREE.Vector3(); // 径向向量（投影点 → 粒子）
    this._tangentVec = new THREE.Vector3(); // 切向向量（叉积结果）
  }

  getVector(position, time, targetVector,globalSpeed) {
    // 防御：无场强 或 轴线退化为点
    if (this.magnitude === 0 || this.axisLenSq === 0) {
      targetVector.set(0, 0, 0);
      return;
    }

    // ── 1. 计算 SP 与轴向投影比例 t ────────────────────────────────────────
    this._spVec.subVectors(position, this.startVec);
    const t = this._spVec.dot(this.axisVec) / this.axisLenSq;

    // ── 2. 轴向判定 ─────────────────────────────────────────────────────────
    if (!this.isInfinite[0] && (t < 0 || t > 1)) {
      targetVector.set(0, 0, 0);
      return;
    }

    // ── 3. 求投影点与径向向量 ───────────────────────────────────────────────
    // 投影点 = start + t * axisVec
    this._projVec.copy(this.axisVec).multiplyScalar(t).add(this.startVec);
    // 径向向量 = position - 投影点
    this._radialVec.subVectors(position, this._projVec);
    const radialLenSq = this._radialVec.lengthSq();

    // ── 4. 环形径向判定：innerRadius < r < outerRadius ──────────────────────
    if (radialLenSq <= this.innerRadiusSq || radialLenSq >= this.outerRadiusSq) {
      targetVector.set(0, 0, 0);
      return;
    }

    // ── 5. 计算切向单位向量：tangent = axisUnit × radialUnit ────────────────
    // crossVectors 结果已是垂直于轴线和径向的切向，再归一化得单位切向
    this._tangentVec
      .crossVectors(this.axisUnit, this._radialVec)
      .normalize();

    // ── 6. 应用时变因子，写入目标向量 ──────────────────────────────────────
    const currentMagnitude = this.magnitude * this.getTimeFactor(time,globalSpeed);
    targetVector.copy(this._tangentVec).multiplyScalar(currentMagnitude);
  }
}

//功能函数：
  export function createFieldInstance(fieldData, type) {
    // 合并 type 属性，以便在策略内部知道自己是 E 还是 B
    const config = { ...fieldData, type };
    
    switch (fieldData.shape) {
      case 'box': return new BoxField(config);
      case 'cylinder': return new CylinderField(config);
      case 'torus': return new TorusField(config);
      default:
        return new BoxField(config);
        
        
    }
  }