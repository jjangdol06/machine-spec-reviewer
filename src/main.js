import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from './controls.js';
import { ABB_ORANGE, ROBOT_SPECS } from './robot/specs.js';
import { solveIK as _solveIK } from './robot/kinematics.js';
const solveIK = (target) => _solveIK(target, currentSpec, robotGroup, robotParts?.tcpAnchor?.position);

// ============================================================
//  씬 / 카메라 / 렌더러 초기화
// ============================================================
const viewport = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x0e1015);
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0e1015, 12, 28);

const camera = new THREE.PerspectiveCamera(45, viewport.clientWidth/viewport.clientHeight, 0.05, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.spherical.set(6, Math.PI/3, Math.PI/4);
controls.target.set(0, 0.6, 0);
controls.update();

// 조명
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
keyLight.position.set(5, 8, 5); keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -6; keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 6;   keyLight.shadow.camera.bottom = -6;
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xa0c4ff, 0.3);
fillLight.position.set(-5, 4, -5); scene.add(fillLight);

// 바닥
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.9, metalness: 0.1 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), floorMat);
floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(20, 40, 0x444a55, 0x2a2e36);
grid.material.opacity = 0.5; grid.material.transparent = true; scene.add(grid);

// 월드 좌표축 표시 (작게)
const worldAxes = new THREE.AxesHelper(0.5);
worldAxes.position.set(0, 0.001, 0);
scene.add(worldAxes);

// ============================================================
//  포지셔너: 베드형 A축 + 상단 C축 턴테이블
//  좌표계: Y-up
//  A축 = X축 회전 (베드 틸트). C축 = 베드 로컬 Y축 회전 (턴테이블).
//  구조: 바닥베이스 → 좌우 베어링 서포트 → A축 베드(슬래브) → C축 디스크
// ============================================================
const positionerGroup = new THREE.Group();
scene.add(positionerGroup);

const positionerBaseMat = new THREE.MeshStandardMaterial({ color: 0x4a5260, roughness: 0.6, metalness: 0.4 });
const positionerArmMat  = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.5, metalness: 0.5 });
const turntableMat      = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.3, metalness: 0.8 });
const cradleMat         = new THREE.MeshStandardMaterial({ color: 0x5b6370, roughness: 0.5, metalness: 0.5 });

// --- 치수 (m) ---
//   A축 회전축 = X축 → 서포트는 X 양 끝, 회전봉도 X 방향
const BASE_H = 0.10;
const SUP_W  = 0.12, SUP_H = 0.36, SUP_D = 0.22;     // 서포트 두께(X)/높이/깊이(Z)
const BED_H  = 0.06;
const BED_D  = 1.00;                                  // Z 방향 깊이 (디스크 수용)
const DISK_H = 0.08;
// 포지셔너 = 좌우 기둥 + 베드 + C-테이블 (floorBase, shaft 제거)
// 기둥 높이는 posH에 따라 동적으로 늘어남 (충돌 방지)
const PILLAR_BASE_H = BASE_H + SUP_H;                 // 기본 기둥 높이 (= 0.46m, posH=0)
const PIVOT_OFFSET_FROM_TOP = SUP_H/2;                 // pivot은 기둥 top에서 SUP_H/2 아래
let A_PIVOT_Y = PILLAR_BASE_H - PIVOT_OFFSET_FROM_TOP; // posH 변경 시 갱신
const BASE_SUP_X = 0.65;                              // 기본 서포트 X 위치 (디스크 지름에 따라 갱신)

// 좌우 베어링 서포트 (X 양 끝, A축 회전축 지지)
//   geometry 높이 = PILLAR_BASE_H. scale.y로 posH 만큼 추가 연장.
const supL = new THREE.Mesh(new THREE.BoxGeometry(SUP_W, PILLAR_BASE_H, SUP_D), cradleMat);
supL.position.set(+BASE_SUP_X, PILLAR_BASE_H/2, 0);
supL.castShadow = true; supL.receiveShadow = true;
positionerGroup.add(supL);
const supR = supL.clone();
supR.position.x = -BASE_SUP_X;
positionerGroup.add(supR);

// A축 베드 그룹 (X축 주위로 틸트)
const aAxisGroup = new THREE.Group();
aAxisGroup.position.y = A_PIVOT_Y;
positionerGroup.add(aAxisGroup);

// 베드 슬래브 — 양 서포트 안쪽 면 사이 (서포트와 겹치지 않도록 클리어런스)
const BED_CLEAR = 0.01;                               // 양쪽 10mm 갭
const baseBedW = 2*BASE_SUP_X - SUP_W - 2*BED_CLEAR;
const bed = new THREE.Mesh(
  new THREE.BoxGeometry(baseBedW, BED_H, BED_D),
  positionerArmMat
);
bed.position.y = 0;
bed.castShadow = true; bed.receiveShadow = true;
aAxisGroup.add(bed);


// 5) C축 턴테이블 그룹 (베드 상면 위)
//    cAxisGroup 원점 = 디스크 상단 (기존 디스크 오프셋 -0.04 그대로 동작)
const cAxisGroup = new THREE.Group();
cAxisGroup.position.y = BED_H/2 + DISK_H;
aAxisGroup.add(cAxisGroup);

// 테이블 부품을 묶어 한꺼번에 스케일 (지름 조절용)
// 기준 디스크 지름 = 1.0m (반지름 0.5m). scale.x/z = tableDia / 1.0
const tableScaleGroup = new THREE.Group();
cAxisGroup.add(tableScaleGroup);

// 턴테이블 디스크
const tableDisk = new THREE.Mesh(
  new THREE.CylinderGeometry(0.5, 0.55, 0.08, 48),
  turntableMat
);
tableDisk.position.y = -0.04; tableDisk.castShadow = true; tableDisk.receiveShadow = true;
tableScaleGroup.add(tableDisk);
// 턴테이블 상부 마킹 (방향 표시)
const tableMarker = new THREE.Mesh(
  new THREE.BoxGeometry(0.4, 0.005, 0.03),
  new THREE.MeshStandardMaterial({ color: 0xff6b35, emissive: 0x441100 })
);
tableMarker.position.set(0.05, 0.001, 0);
tableScaleGroup.add(tableMarker);
// T 슬롯 (4방향)
for (let i = 0; i < 4; i++) {
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.012, 0.025),
    new THREE.MeshStandardMaterial({ color: 0x303540 })
  );
  slot.rotation.y = (i * Math.PI) / 4;
  slot.position.y = -0.001;
  tableScaleGroup.add(slot);
}

// ============================================================
//  ABB 로봇 모델 (파라메트릭)
//  6축 (J1: base Z회전, J2: shoulder Y회전, J3: elbow Y회전,
//       J4: forearm X회전, J5: wrist Y회전, J6: tool X회전)
//  단순화된 운동학 - 시각적 표현 목적
// ============================================================
const robotGroup = new THREE.Group();
scene.add(robotGroup);

const robotMat       = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.5 });
const robotJointMat  = new THREE.MeshStandardMaterial({ color: 0x303540, roughness: 0.3, metalness: 0.8 });

let robotParts = null;
let currentSpec = null;

function buildRobot(specKey) {
  // 기존 로봇 제거
  while (robotGroup.children.length) {
    const child = robotGroup.children[0];
    robotGroup.remove(child);
    child.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  const spec = ROBOT_SPECS[specKey];
  currentSpec = spec;
  const orange = robotMat(spec.color);
  const dark   = robotMat(0x2c3038);

  // 베이스 (고정)
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, 0.18, 32), dark
  );
  base.position.y = 0.09;
  base.castShadow = true; base.receiveShadow = true;
  robotGroup.add(base);

  // J1: 회전 베이스 (Z축 회전) - 중심 기둥
  const j1Group = new THREE.Group();
  j1Group.position.y = 0.18;
  robotGroup.add(j1Group);

  const j1Body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, spec.d1 - 0.18, 24), orange
  );
  j1Body.position.y = (spec.d1 - 0.18)/2;
  j1Body.castShadow = true;
  j1Group.add(j1Body);

  // J1 베어링/조인트 표시
  const j1Joint = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), robotJointMat
  );
  j1Joint.position.y = 0.025;
  j1Group.add(j1Joint);

  // 어깨 캐스팅 — J1 상단과 J2 축 사이의 수평 오프셋(a1)을 시각적으로 연결
  const shoulderCasting = new THREE.Mesh(
    new THREE.BoxGeometry(spec.a1 + 0.18, 0.22, 0.26), orange
  );
  shoulderCasting.position.set(spec.a1/2, spec.d1 - 0.18 - 0.11, 0);
  shoulderCasting.castShadow = true;
  j1Group.add(shoulderCasting);

  // J2: 어깨 (Y축 회전) - J1 상단에 위치
  const j2Group = new THREE.Group();
  j2Group.position.set(spec.a1, spec.d1 - 0.18, 0);
  j1Group.add(j2Group);

  // J2 조인트 (수평 봉)
  const j2Joint = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.36, 24), robotJointMat
  );
  j2Joint.rotation.x = Math.PI/2;
  j2Group.add(j2Joint);

  // 상박 (J2-J3 사이 링크) - J2 그룹 안에 배치, +X 방향으로 a2 길이
  const upperArm = new THREE.Mesh(
    new THREE.BoxGeometry(spec.a2, 0.18, 0.18), orange
  );
  upperArm.position.set(spec.a2/2, 0, 0);
  upperArm.castShadow = true;
  j2Group.add(upperArm);

  // J3: 엘보우 (Y축 회전) - 상박 끝에 위치
  const j3Group = new THREE.Group();
  j3Group.position.set(spec.a2, 0, 0);
  j2Group.add(j3Group);

  const j3Joint = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.32, 24), robotJointMat
  );
  j3Joint.rotation.x = Math.PI/2;
  j3Group.add(j3Joint);

  // 전박 분리: J3 직후 짧은 부분 + J4 회전축 + 손목
  // 전박 본체 (J3-J4 사이) - +X 방향으로 d4 길이
  const forearm = new THREE.Mesh(
    new THREE.BoxGeometry(spec.d4, 0.14, 0.14), orange
  );
  forearm.position.set(spec.d4/2, 0, 0);
  forearm.castShadow = true;
  j3Group.add(forearm);

  // J4: 전박 롤 (X축 회전) - J3에서 (a3, d3, 0) 떨어진 곳에 위치 (실제 CAD 매칭)
  const j4Group = new THREE.Group();
  j4Group.position.set(spec.a3 ?? spec.d4, spec.d3 ?? 0, 0);
  j3Group.add(j4Group);

  // J4 표시 (회전 디스크)
  const j4Joint = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.12, 16), robotJointMat
  );
  j4Joint.rotation.z = Math.PI/2;
  j4Group.add(j4Joint);

  // J5: 손목 피치 (Y축 회전) - J4에서 (a4, 0, 0) 떨어진 곳 (실제 CAD)
  const j5Group = new THREE.Group();
  j5Group.position.set(spec.a4 ?? 0.05, 0, 0);
  j4Group.add(j5Group);

  const j5Joint = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.16, 16), robotJointMat
  );
  j5Joint.rotation.x = Math.PI/2;
  j5Group.add(j5Joint);

  // J6: 툴 롤 (X축 회전) - J5에서 (a5, 0, 0) (실제 CAD)
  const j6Group = new THREE.Group();
  j6Group.position.set(spec.a5 ?? 0.04, 0, 0);
  j5Group.add(j6Group);

  // === J6 끝단: 플랜지 + STL 모듈 (TCP가 모듈 끝) ===
  // J6 플랜지 (작은 디스크)
  const flange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.06, 0.01, 24),
    new THREE.MeshStandardMaterial({ color: 0xc0c4cc, roughness: 0.3, metalness: 0.85 })
  );
  flange.rotation.z = Math.PI/2;
  flange.position.x = 0.012;
  j6Group.add(flange);

  // STL 모듈 — 항상 표시. mounting 면이 j6 flange 면에 정렬되도록 +X 오프셋 (GLB 로드 후 정확한 flangeX 갱신)
  let moduleMesh = null;
  const initialFlangeX = 0.04;     // GLB 없을 때 기본값
  if (_moduleGeom) {
    moduleMesh = new THREE.Mesh(
      _moduleGeom,
      new THREE.MeshStandardMaterial({ color: 0x404448, roughness: 0.55, metalness: 0.45 })
    );
    moduleMesh.castShadow = true;
    moduleMesh.userData.glb = true;
    // 모듈 top에서 2/3 내려간 지점(= mesh local Y=-H/3)이 j6 회전축에 정렬되도록 mesh.position.y = +MODULE_HALF_Y/3
    moduleMesh.position.set(initialFlangeX, MODULE_HALF_Y / 3, 0);
    j6Group.add(moduleMesh);
  } else {
    _pendingModuleAttach = true;
  }

  // TCP — 모듈 바닥 원 중심. mesh.position.y(+H/3) + bottom mesh local(-H) = -2*MODULE_HALF_Y/3
  const tcpAnchor = new THREE.Object3D();
  tcpAnchor.position.set(initialFlangeX + MODULE_TIP_OFFSET.x, -2 * MODULE_HALF_Y / 3, MODULE_TIP_OFFSET.z);
  j6Group.add(tcpAnchor);

  // TCP 좌표계
  const tcpFrame = new THREE.AxesHelper(0.18);
  tcpAnchor.add(tcpFrame);

  robotParts = { j1Group, j2Group, j3Group, j4Group, j5Group, j6Group, tcpAnchor, tcpFrame, moduleMesh };

  // 파라메트릭 메쉬에 태그 — GLB 로드 시 가시성 토글용
  robotGroup.traverse(o => {
    if (o.isMesh && !o.userData.glb) o.userData.parametric = true;
  });
  // 즉시 파라메트릭 숨김 (반짝거림 방지). GLB 로드 실패 시만 다시 표시.
  hideParametric(true);

  // 작업 영역 구 업데이트
  if (workspaceSphere) workspaceSphere.geometry.dispose();
  workspaceSphere.geometry = new THREE.SphereGeometry(spec.reach, 32, 16);
  workspaceSphere.position.copy(robotGroup.position);
  workspaceSphere.position.y = spec.d1;

  // 실제 로봇 GLB 모델 시도 (modeling/<MODEL>/{base,link1..link6}.glb)
  applyRobotGLBs(specKey);
}

// === 모듈 STL 로드 (welding torch 등 J6 끝단 부착물) ===
const _stlLoader = new STLLoader();
let _moduleGeom = null;
let MODULE_HALF_Y = 0.474;
const MODULE_TIP_OFFSET = { x: 0, z: 0 };  // 바닥 원 중심의 X,Z 오프셋 (mesh local)
let _pendingModuleAttach = false;
function _computeTipOffset(geom) {
  const positions = geom.attributes.position;
  const bbox = geom.boundingBox;
  const minY = bbox.min.y;
  const cutoff = minY + (bbox.max.y - minY) * 0.05;
  let sumX = 0, sumZ = 0, count = 0;
  for (let i = 0; i < positions.count; i++) {
    if (positions.getY(i) <= cutoff) {
      sumX += positions.getX(i);
      sumZ += positions.getZ(i);
      count++;
    }
  }
  return count ? { x: sumX/count, z: sumZ/count } : { x: 0, z: 0 };
}
async function loadModuleGeom() {
  if (_moduleGeom) return _moduleGeom;
  try {
    const geom = await _stlLoader.loadAsync('modeling/module/module.stl');
    geom.center();
    geom.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI/2));
    geom.scale(0.001, 0.001, 0.001);
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    MODULE_HALF_Y = (geom.boundingBox.max.y - geom.boundingBox.min.y) / 2;
    const t = _computeTipOffset(geom);
    MODULE_TIP_OFFSET.x = t.x;
    MODULE_TIP_OFFSET.z = t.z;
    _moduleGeom = geom;
    if (_pendingModuleAttach && currentSpec) {
      _pendingModuleAttach = false;
      buildRobot(document.getElementById('robotModel').value);
      applyState(); updateInfo();
    }
    return geom;
  } catch (e) { console.warn('module.stl 로드 실패', e); return null; }
}
loadModuleGeom();

// === 실제 로봇 모델(GLB) 로드 — 있으면 파라메트릭 위에 오버레이 ===
// CAD가 로봇 베이스 절대좌표(Z-up)로 export됐다고 가정.
// 각 LINK GLB는 calibration pose의 j*Group inverse * robot.matrix * Rx(-π/2) 행렬을
// 자기 transform으로 가져 CAD 위치를 보존한 채 j*Group의 회전을 따라가도록 함.
const _gltfLoader = new GLTFLoader();
async function tryLoadGLB(url) {
  try {
    const gltf = await _gltfLoader.loadAsync(url);
    return gltf.scene;
  } catch (e) { return null; }
}
async function applyRobotGLBs(specKey) {
  if (!robotParts) return;
  // calibration pose 강제 (모든 state = 0) — j*Group.matrixWorld가 calibration일 때 캡처
  const saved = { ...state };
  Object.assign(state, { j1:0,j2:0,j3:0,j4:0,j5:0,j6:0,axisA:0,axisC:0 });
  applyState();
  scene.updateMatrixWorld(true);

  const dir = `modeling/${specKey}/`;
  const files = [
    { f: 'base.glb',  parent: robotGroup },
    { f: 'link1.glb', parent: robotParts.j1Group },
    { f: 'link2.glb', parent: robotParts.j2Group },
    { f: 'link3.glb', parent: robotParts.j3Group },
    { f: 'link4.glb', parent: robotParts.j4Group },
    { f: 'link5.glb', parent: robotParts.j5Group },
    { f: 'link6.glb', parent: robotParts.j6Group },
  ];
  const robotMat = robotGroup.matrixWorld;

  let anyLoaded = false;
  let link6Sc = null;
  for (const p of files) {
    const sc = await tryLoadGLB(dir + p.f);
    if (!sc) continue;
    sc.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.glb = true; }
    });
    sc.userData.glb = true;
    p.parent.updateMatrixWorld(true);
    const M = new THREE.Matrix4()
      .copy(p.parent.matrixWorld).invert()
      .multiply(robotMat);
    sc.applyMatrix4(M);
    p.parent.add(sc);
    if (p.f === 'link6.glb') link6Sc = sc;
    anyLoaded = true;
  }

  // 원래 state 복원
  Object.assign(state, saved);
  applyState();

  if (anyLoaded) {
    hideParametric(true);
    // LINK6 flange 면 X 위치 측정 → STL 모듈 + TCP 재배치
    if (link6Sc && robotParts && robotParts.j6Group) {
      robotParts.j6Group.updateMatrixWorld(true);
      const wb = new THREE.Box3().setFromObject(link6Sc);
      const inv = new THREE.Matrix4().copy(robotParts.j6Group.matrixWorld).invert();
      wb.applyMatrix4(inv);
      const flangeX = wb.max.x;
      if (robotParts.moduleMesh) {
        robotParts.moduleMesh.position.set(flangeX, MODULE_HALF_Y / 3, 0);
      }
      if (robotParts.tcpAnchor) {
        robotParts.tcpAnchor.position.set(flangeX + MODULE_TIP_OFFSET.x, -2 * MODULE_HALF_Y / 3, MODULE_TIP_OFFSET.z);
      }
    }
  } else {
    // GLB 못 찾음 — 파라메트릭 다시 표시
    hideParametric(false);
  }
}
function hideParametric(hide) {
  robotGroup.traverse(o => {
    if (o.isMesh && o.userData.parametric) o.visible = !hide;
  });
}

// 작업 영역 표시 (도달 가능 반경 와이어프레임 구)
const workspaceSphere = new THREE.Mesh(
  new THREE.SphereGeometry(2.5, 32, 16),
  new THREE.MeshBasicMaterial({
    color: 0xa0c4ff, transparent: true, opacity: 0.08, wireframe: true
  })
);
scene.add(workspaceSphere);

// 작업 스트로크 박스 (X×Y×Z, C-테이블 중심 = 상대좌표 0,0,0 기준)
// cAxisGroup에 부모 설정 → 테이블 회전/틸트와 함께 움직임
const wsEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
  new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.9 })
);
cAxisGroup.add(wsEdges);

// === 워크오브젝트 적층 시뮬레이션 ===
// 워크오브젝트 ghost (와이어프레임, C-테이블 중심 위에)
const woGhost = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),
  new THREE.LineBasicMaterial({ color: 0x55ff88, transparent: true, opacity: 0.55 })
);
woGhost.visible = false;
cAxisGroup.add(woGhost);
// 적층 재료 — InstancedMesh
const WO_MAX = 8000;
const woDeposit = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xff8855, roughness: 0.6, metalness: 0.2 }),
  WO_MAX
);
woDeposit.count = 0;
woDeposit.castShadow = true;
cAxisGroup.add(woDeposit);
// 툴 팁 마커 (재생 중 현재 위치)
const woTip = new THREE.Mesh(
  new THREE.SphereGeometry(0.008, 12, 8),
  new THREE.MeshBasicMaterial({ color: 0xffff00 })
);
woTip.visible = false;
cAxisGroup.add(woTip);

// 로봇 페더스털 (높이 가시화) — 포지셔너는 기둥 자체가 늘어나므로 페더스털 없음
const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.7, metalness: 0.3 });
const robotPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1, 24), pedestalMat);
robotPedestal.castShadow = true; robotPedestal.receiveShadow = true;
robotPedestal.visible = false;
scene.add(robotPedestal);

// 로봇 위치 (포지셔너로부터 거리) + 높이
let robotDistance = 2.2;
let robotHeightMm = 0;
let positionerHeightMm = 0;

function updateRobotPedestal() {
  const m = robotHeightMm / 1000;
  if (m < 0.005) { robotPedestal.visible = false; return; }
  robotPedestal.visible = true;
  robotPedestal.scale.y = m;
  robotPedestal.position.set(robotDistance, m / 2, 0);
}
function updatePositionerPedestal() {
  // 새 디자인: posH는 기둥 자체를 늘림. positionerGroup은 floor에 고정.
  positionerGroup.position.y = 0;
  applyPillarHeight();
}
function updateRobotPosition() {
  robotGroup.position.set(robotDistance, robotHeightMm / 1000, 0);
  robotGroup.rotation.y = Math.PI;
  if (workspaceSphere && currentSpec) {
    workspaceSphere.position.set(robotDistance, robotHeightMm/1000 + currentSpec.d1, 0);
  }
  updateRobotPedestal();
}

// ============================================================
//  TCP 궤적 라인
// ============================================================
const trailPoints = [];
const trailMaxPoints = 500;
const trailGeom = new THREE.BufferGeometry();
trailGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trailMaxPoints * 3), 3));
trailGeom.setDrawRange(0, 0);
const trailLine = new THREE.Line(
  trailGeom,
  new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.85 })
);
trailLine.visible = false;
scene.add(trailLine);

function pushTrail(p) {
  if (trailPoints.length >= trailMaxPoints) trailPoints.shift();
  trailPoints.push(p.clone());
  const arr = trailGeom.attributes.position.array;
  for (let i = 0; i < trailPoints.length; i++) {
    arr[i*3]     = trailPoints[i].x;
    arr[i*3 + 1] = trailPoints[i].y;
    arr[i*3 + 2] = trailPoints[i].z;
  }
  trailGeom.attributes.position.needsUpdate = true;
  trailGeom.setDrawRange(0, trailPoints.length);
}

// ============================================================
//  현재 자세 상태
// ============================================================
const state = {
  j1: 0, j2: 0, j3: 0, j4: 0, j5: 0, j6: 0,
  axisA: 0, axisC: 0,
};

function applyState() {
  if (!robotParts) return;
  const r = robotParts;
  // ABB IRB 캘리브레이션 컨벤션:
  //   J=0 자세 → 상박(upper arm) 수직 위, 전박(forearm) 수평 forward
  //   J2+ = 상박이 앞쪽으로 기움 (toward target)
  //   J3+ = 전박이 위쪽으로 들림
  // 시각 모델은 +X 방향으로 직선 정렬되어 있으므로
  //   J2 회전축에 +90° 오프셋, J3에 -90° 오프셋을 추가해 위 컨벤션을 맞춤.
  r.j1Group.rotation.y = THREE.MathUtils.degToRad(state.j1);
  r.j2Group.rotation.z = THREE.MathUtils.degToRad(-state.j2) + Math.PI/2;
  r.j3Group.rotation.z = THREE.MathUtils.degToRad(state.j3)  - Math.PI/2;
  r.j4Group.rotation.x = THREE.MathUtils.degToRad(state.j4);
  r.j5Group.rotation.z = THREE.MathUtils.degToRad(state.j5);
  r.j6Group.rotation.x = THREE.MathUtils.degToRad(state.j6);

  // 포지셔너 (Three.js Y-up: Z up은 의미상이지만 실제 회전은
  // A축=X축 회전, C축은 자기 로컬 Y축 회전으로 매핑)
  aAxisGroup.rotation.x = THREE.MathUtils.degToRad(state.axisA);
  cAxisGroup.rotation.y = THREE.MathUtils.degToRad(state.axisC);
}

// ============================================================
//  TCP 위치/자세 계산 (월드 좌표) 및 거리/충돌 평가
// ============================================================
const _tcpPos = new THREE.Vector3();
const _tcpQuat = new THREE.Quaternion();
const _tcpScale = new THREE.Vector3();
const _tcpEuler = new THREE.Euler();

function computeTCP() {
  if (!robotParts) return null;
  robotParts.tcpAnchor.updateWorldMatrix(true, false);
  robotParts.tcpAnchor.matrixWorld.decompose(_tcpPos, _tcpQuat, _tcpScale);
  _tcpEuler.setFromQuaternion(_tcpQuat, 'XYZ');
  return {
    pos: _tcpPos.clone(),
    rot: _tcpEuler.clone(),
    distFromOrigin: _tcpPos.length(),
  };
}

const statusEl = document.getElementById('status');
function updateInfo() {
  const tcp = computeTCP();
  if (!tcp) return;
  document.getElementById('tcpX').textContent = tcp.pos.x.toFixed(3);
  document.getElementById('tcpY').textContent = tcp.pos.z.toFixed(3); // 화면 표시는 산업용 좌표(Z up)으로
  document.getElementById('tcpZ').textContent = tcp.pos.y.toFixed(3);
  document.getElementById('tcpRX').textContent = THREE.MathUtils.radToDeg(tcp.rot.x).toFixed(1);
  document.getElementById('tcpRY').textContent = THREE.MathUtils.radToDeg(tcp.rot.y).toFixed(1);
  document.getElementById('tcpRZ').textContent = THREE.MathUtils.radToDeg(tcp.rot.z).toFixed(1);
  document.getElementById('tcpDist').textContent = tcp.distFromOrigin.toFixed(3);

  // 충돌/도달 평가
  const reach = currentSpec ? currentSpec.reach : 2.5;
  const robotBaseTop = robotGroup.position.clone();
  robotBaseTop.y = currentSpec ? currentSpec.d1 : 0.5;
  const tcpToBase = tcp.pos.distanceTo(robotBaseTop);

  if (tcpToBase > reach * 0.99) {
    statusEl.textContent = '⚠ 도달 한계 초과 (out of reach)';
    statusEl.className = 'warn';
  } else if (tcpToBase > reach * 0.92) {
    statusEl.textContent = '⚠ 도달 한계 근접';
    statusEl.className = 'warn';
  } else {
    statusEl.textContent = `✓ 정상 동작 / 도달거리 ${tcpToBase.toFixed(2)}m / ${currentSpec.name}`;
    statusEl.className = 'ok';
  }

  if (showTrail.checked) pushTrail(tcp.pos);
}

// ============================================================
//  슬라이더/버튼 바인딩
// ============================================================
function bindSlider(id, key) {
  const slider = document.getElementById(id);
  const input  = document.getElementById(id+'v');
  slider.value = state[key];
  input.value  = state[key];

  // 슬라이더 → 즉시 반영
  slider.addEventListener('input', () => {
    state[key] = parseFloat(slider.value);
    input.value = state[key];
    applyState(); updateInfo();
  });

  // 입력박스 → 확정(Enter/blur)에서만 반영 — 타이핑 중엔 필드 보존, 사이드이펙트 없음
  input.addEventListener('change', () => {
    let v = parseFloat(input.value);
    const min = parseFloat(slider.min), max = parseFloat(slider.max);
    if (!Number.isFinite(v)) v = state[key];
    v = Math.max(min, Math.min(max, v));
    state[key] = v;
    slider.value = v;
    input.value  = v;
    applyState(); updateInfo();
  });
}
['j1','j2','j3','j4','j5','j6','axisA','axisC'].forEach(k => bindSlider(k, k));

// 데이터시트 limits를 J1~J6 슬라이더 + 입력박스에 적용 + 현재값 클램프
function applyJointLimitsToSliders(spec) {
  if (!spec || !spec.limits) return;
  for (const k of ['j1','j2','j3','j4','j5','j6']) {
    const [lo, hi] = spec.limits[k];
    const slider = document.getElementById(k);
    const input  = document.getElementById(k+'v');
    slider.min = lo; slider.max = hi;
    input.min = lo;  input.max = hi;
    if (state[k] < lo) state[k] = lo;
    if (state[k] > hi) state[k] = hi;
    slider.value = state[k];
    input.value  = state[k];
  }
}

// 테이블 지름 입력 (mm 단위, 기준 디스크 = 1000mm)
const tableDiaEl = document.getElementById('tableDia');
const tableDiaV = document.getElementById('tableDiaV');
function updatePositionerForDisk(mm) {
  // 디스크 지름이 커져도 서포트가 더 넓도록 동적 갱신
  const diskR = mm / 1000 / 2;
  const desiredSupX = Math.max(BASE_SUP_X, diskR + 0.15);
  supL.position.x = +desiredSupX;
  supR.position.x = -desiredSupX;
  const newBedW = 2*desiredSupX - SUP_W - 2*BED_CLEAR;
  bed.scale.x = newBedW / baseBedW;
  updateAxisALimit();
}

// 기둥 높이 + A_PIVOT_Y 동기화 (posH에 따라 기둥 늘어남)
function applyPillarHeight() {
  const pillarH = PILLAR_BASE_H + positionerHeightMm/1000;
  const scaleY = pillarH / PILLAR_BASE_H;
  supL.scale.y = scaleY;
  supR.scale.y = scaleY;
  supL.position.y = pillarH / 2;
  supR.position.y = pillarH / 2;
  // A_PIVOT_Y = pillarH - PIVOT_OFFSET_FROM_TOP (pivot은 기둥 top에서 SUP_H/2 아래 = 원래 위치 유지)
  A_PIVOT_Y = pillarH - PIVOT_OFFSET_FROM_TOP;
  aAxisGroup.position.y = A_PIVOT_Y;
}

// A축 동적 한계 — 디스크 가장자리 / 베드 가장자리가 floor를 뚫지 않도록 제한
//   디스크 edge 최소 Y(world) = pivotY + Y_OFFSET*cos(θ) - R*sin(θ) ≥ 0
//   해: θ ≤ atan(Y_OFFSET/R) + asin(pivotY / sqrt(R² + Y_OFFSET²))
function updateAxisALimit() {
  const diskR = parseFloat(document.getElementById('tableDia').value || 1000) / 2 / 1000;
  const pivotY = (positionerHeightMm/1000) + A_PIVOT_Y;
  // 디스크 중심 Y (aAxis pivot 기준) = BED_H/2 + DISK_H/2
  const Y_OFFSET = BED_H/2 + DISK_H/2;
  // 디스크 한계 (정확)
  let limFromDisk = Math.PI/2;
  if (diskR > 0.001) {
    const denom = Math.sqrt(diskR*diskR + Y_OFFSET*Y_OFFSET);
    const ratio = Math.min(1, pivotY / denom);
    limFromDisk = Math.atan2(Y_OFFSET, diskR) + Math.asin(ratio);
  }
  // 베드 한계 — 베드 Z 가장자리 (Y_aAxis = 0)
  const limFromBed = (BED_D/2) > 0.001 ? Math.asin(Math.min(1, pivotY / (BED_D/2))) : Math.PI/2;
  const geomLimitDeg = Math.min(limFromDisk, limFromBed) * 180 / Math.PI;
  // 슬라이더 + 입력박스 갱신 (조인트 한계와 교집합)
  const axisAEl = document.getElementById('axisA');
  const axisAvEl = document.getElementById('axisAv');
  if (!axisAEl) return;
  const jointLim = 120;             // 데이터시트 A축 한계
  const lim = Math.min(jointLim, geomLimitDeg);
  axisAEl.min = -lim;
  axisAEl.max = +lim;
  if (axisAvEl) { axisAvEl.min = -lim; axisAvEl.max = +lim; }
  // 현재 값 클램프
  if (typeof state !== 'undefined' && state) {
    if (Math.abs(state.axisA) > lim) {
      state.axisA = state.axisA > 0 ? lim : -lim;
      axisAEl.value = state.axisA;
      if (axisAvEl) axisAvEl.value = state.axisA.toFixed(1);
      if (typeof applyState === 'function') { applyState(); if (typeof updateInfo === 'function') updateInfo(); }
    }
  }
}
function setTableDiaMm(mm) {
  // 3D 씬과 라벨만 갱신 — 입력 필드의 value는 건드리지 않음 (커서/입력 보존)
  if (!Number.isFinite(mm)) return;
  const s = mm / 1000;
  tableScaleGroup.scale.set(s, 1, s);
  updatePositionerForDisk(mm);
  tableDiaV.textContent = `mm (${(mm/1000).toFixed(3)}m)`;
}
function clampTableDiaInput() {
  const min = parseFloat(tableDiaEl.min), max = parseFloat(tableDiaEl.max);
  let mm = parseFloat(tableDiaEl.value);
  if (!Number.isFinite(mm)) mm = 1000;
  mm = Math.max(min, Math.min(max, mm));
  tableDiaEl.value = mm;
  setTableDiaMm(mm);
}
// 타이핑 중: 부분 값으로도 미리보기 갱신, 단 필드 값은 보존
tableDiaEl.addEventListener('input', () => {
  const mm = parseFloat(tableDiaEl.value);
  if (Number.isFinite(mm)) setTableDiaMm(mm);
});
// 확정(blur/Enter): 한계 클램프하여 필드에 반영
tableDiaEl.addEventListener('change', clampTableDiaInput);
clampTableDiaInput();

const robotSel = document.getElementById('robotModel');
robotSel.addEventListener('change', () => {
  buildRobot(robotSel.value);
  applyJointLimitsToSliders(currentSpec);
  applyState(); updateInfo();
});

// 로봇 거리 입력 (mm 단위)
const robotDistEl = document.getElementById('robotDistance');
const robotDistVal = document.getElementById('robotDistanceVal');
function setRobotDistMm(mm) {
  if (!Number.isFinite(mm)) return;
  robotDistance = mm / 1000;
  robotDistVal.textContent = `mm (${robotDistance.toFixed(2)}m)`;
  updateRobotPosition();
  applyState(); updateInfo();
}
function clampRobotDistInput() {
  const min = parseFloat(robotDistEl.min), max = parseFloat(robotDistEl.max);
  let mm = parseFloat(robotDistEl.value);
  if (!Number.isFinite(mm)) mm = 2200;
  mm = Math.max(min, Math.min(max, mm));
  robotDistEl.value = mm;
  setRobotDistMm(mm);
}
robotDistEl.addEventListener('input', () => {
  const mm = parseFloat(robotDistEl.value);
  if (Number.isFinite(mm)) setRobotDistMm(mm);
});
robotDistEl.addEventListener('change', clampRobotDistInput);
clampRobotDistInput();

// 로봇 높이 (mm) — 페더스털
const robotHeightEl = document.getElementById('robotHeight');
const robotHeightVal = document.getElementById('robotHeightVal');
function setRobotHeightMm(mm) {
  if (!Number.isFinite(mm)) return;
  robotHeightMm = mm;
  robotHeightVal.textContent = `mm (${(mm/1000).toFixed(2)}m)`;
  updateRobotPosition();
  applyState(); updateInfo();
}
function clampRobotHeightInput() {
  const min = parseFloat(robotHeightEl.min), max = parseFloat(robotHeightEl.max);
  let mm = parseFloat(robotHeightEl.value);
  if (!Number.isFinite(mm)) mm = 0;
  mm = Math.max(min, Math.min(max, mm));
  robotHeightEl.value = mm;
  setRobotHeightMm(mm);
}
robotHeightEl.addEventListener('input', () => {
  const mm = parseFloat(robotHeightEl.value);
  if (Number.isFinite(mm)) setRobotHeightMm(mm);
});
robotHeightEl.addEventListener('change', clampRobotHeightInput);
clampRobotHeightInput();

// 포지셔너 높이 (mm) — 페더스털
const posHeightEl = document.getElementById('positionerHeight');
const posHeightVal = document.getElementById('positionerHeightVal');
function setPosHeightMm(mm) {
  if (!Number.isFinite(mm)) return;
  positionerHeightMm = mm;
  posHeightVal.textContent = `mm (${(mm/1000).toFixed(2)}m)`;
  updatePositionerPedestal();
  updateAxisALimit();
  applyState(); updateInfo();
}
function clampPosHeightInput() {
  const min = parseFloat(posHeightEl.min), max = parseFloat(posHeightEl.max);
  let mm = parseFloat(posHeightEl.value);
  if (!Number.isFinite(mm)) mm = 0;
  mm = Math.max(min, Math.min(max, mm));
  posHeightEl.value = mm;
  setPosHeightMm(mm);
}
posHeightEl.addEventListener('input', () => {
  const mm = parseFloat(posHeightEl.value);
  if (Number.isFinite(mm)) setPosHeightMm(mm);
});
posHeightEl.addEventListener('change', clampPosHeightInput);
clampPosHeightInput();

// 작업 스트로크 (X×Y×Z mm, 바닥 기준)
const wsXEl = document.getElementById('wsX');
const wsYEl = document.getElementById('wsY');
const wsZEl = document.getElementById('wsZ');
function applyWorkingStroke() {
  const x = parseFloat(wsXEl.value);
  const y = parseFloat(wsYEl.value);
  const z = parseFloat(wsZEl.value);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
  wsEdges.scale.set(x/1000, y/1000, z/1000);
  // C-테이블 중심 표면 = (0,0,0). 박스 바닥이 표면에 닿고 +Y로 뻗음.
  wsEdges.position.set(0, (y/1000)/2, 0);
}
function clampWsInput(el) {
  const min = parseFloat(el.min), max = parseFloat(el.max);
  let v = parseFloat(el.value);
  if (!Number.isFinite(v)) v = 1500;
  v = Math.max(min, Math.min(max, v));
  el.value = v;
  applyWorkingStroke();
}
[wsXEl, wsYEl, wsZEl].forEach(el => {
  el.addEventListener('input', applyWorkingStroke);
  el.addEventListener('change', () => clampWsInput(el));
});
applyWorkingStroke();

// 표시 옵션
const showWorkspace = document.getElementById('showWorkspace');
showWorkspace.addEventListener('change', () => workspaceSphere.visible = showWorkspace.checked);
workspaceSphere.visible = false;

const showFrame = document.getElementById('showFrame');
showFrame.addEventListener('change', () => {
  if (robotParts) robotParts.tcpFrame.visible = showFrame.checked;
});

const showTrail = document.getElementById('showTrail');
showTrail.addEventListener('change', () => {
  trailLine.visible = showTrail.checked;
});

const showWorkingStroke = document.getElementById('showWorkingStroke');
showWorkingStroke.addEventListener('change', () => {
  wsEdges.visible = showWorkingStroke.checked;
});


document.getElementById('clearTrail').addEventListener('click', () => {
  trailPoints.length = 0;
  trailGeom.setDrawRange(0, 0);
});

// ============================================================
//  설정 저장 / 불러오기 / 보고서 생성
// ============================================================
function getCurrentSettings() {
  return {
    version: 1,
    timestamp: new Date().toISOString(),
    robotModel: document.getElementById('robotModel').value,
    robotDistanceMm: parseFloat(document.getElementById('robotDistance').value),
    robotHeightMm,
    positionerHeightMm,
    tableDiaMm: parseFloat(document.getElementById('tableDia').value),
    strokeMm: {
      x: parseFloat(document.getElementById('wsX').value),
      y: parseFloat(document.getElementById('wsY').value),
      z: parseFloat(document.getElementById('wsZ').value),
    },
    joints: { j1: state.j1, j2: state.j2, j3: state.j3, j4: state.j4, j5: state.j5, j6: state.j6 },
    axes:   { axisA: state.axisA, axisC: state.axisC },
  };
}

function applySettings(s) {
  if (!s || typeof s !== 'object') return;
  // 1) 로봇 모델 먼저 (조인트 한계 갱신 트리거)
  if (s.robotModel && ROBOT_SPECS[s.robotModel]) {
    const sel = document.getElementById('robotModel');
    sel.value = s.robotModel;
    sel.dispatchEvent(new Event('change'));
  }
  // 2) 숫자 입력들
  const setNumChange = (id, v) => {
    if (typeof v !== 'number') return;
    const e = document.getElementById(id);
    if (!e) return;
    e.value = v; e.dispatchEvent(new Event('change'));
  };
  setNumChange('robotDistance',     s.robotDistanceMm);
  setNumChange('robotHeight',       s.robotHeightMm);
  setNumChange('positionerHeight',  s.positionerHeightMm);
  setNumChange('tableDia',          s.tableDiaMm);
  if (s.strokeMm) {
    setNumChange('wsX', s.strokeMm.x);
    setNumChange('wsY', s.strokeMm.y);
    setNumChange('wsZ', s.strokeMm.z);
  }
  // 3) 조인트/축 — state + UI 직접 갱신
  const setJoint = (k, v) => {
    if (typeof v !== 'number') return;
    state[k] = v;
    const slider = document.getElementById(k);
    const input  = document.getElementById(k+'v');
    if (slider) slider.value = v;
    if (input)  input.value  = v;
  };
  if (s.joints) Object.entries(s.joints).forEach(([k,v]) => setJoint(k, v));
  if (s.axes)   Object.entries(s.axes  ).forEach(([k,v]) => setJoint(k, v));
  applyState(); updateInfo();
}

document.getElementById('saveSettings').addEventListener('click', () => {
  const s = getCurrentSettings();
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `robot-stage-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('loadSettings').addEventListener('click', () => {
  document.getElementById('loadFile').click();
});
document.getElementById('loadFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try { applySettings(JSON.parse(ev.target.result)); }
    catch (err) { alert('설정 파일 로드 실패: ' + err.message); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

function generateReport() {
  const tcp = computeTCP();
  if (!tcp || !currentSpec) { alert('아직 로봇이 준비되지 않음'); return; }
  const spec = currentSpec;
  const wp = (obj) => {
    if (!obj) return null;
    const v = new THREE.Vector3();
    obj.getWorldPosition(v);
    return v;
  };
  const r = robotParts;
  const positions = {
    'Robot Base':       wp(robotGroup),
    'J1 axis':          wp(r.j1Group),
    'J2 axis':          wp(r.j2Group),
    'J3 axis':          wp(r.j3Group),
    'J4 axis':          wp(r.j4Group),
    'J5 axis':          wp(r.j5Group),
    'J6 axis':          wp(r.j6Group),
    'TCP':              tcp.pos.clone(),
    'Positioner Base':  wp(positionerGroup),
    'C-table Center':   wp(cAxisGroup),
  };
  const tableDia = parseFloat(document.getElementById('tableDia').value);
  const wsX = document.getElementById('wsX').value;
  const wsY = document.getElementById('wsY').value;
  const wsZ = document.getElementById('wsZ').value;

  const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><title>로봇 셀 셋업 보고서</title>
<style>
body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 24px; max-width: 900px; margin: auto; color: #222; }
h1 { color: #ff6b35; border-bottom: 2px solid #ff6b35; padding-bottom: 8px; }
h2 { color: #444; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 24px; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px; }
th, td { border: 1px solid #ddd; padding: 6px 12px; text-align: left; }
th { background: #f5f5f5; font-weight: 600; }
.coord { font-family: 'Consolas', monospace; }
.meta { color: #888; font-size: 12px; margin-bottom: 16px; }
.btn { padding: 8px 16px; background: #ff6b35; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
.btn:hover { background: #ff8255; }
@media print { body { padding: 0; } .btn { display: none; } }
</style></head><body>
<h1>ABB 로봇 셀 셋업 보고서</h1>
<p class="meta">생성일: ${new Date().toLocaleString('ko-KR')}</p>

<h2>장비 사양</h2>
<table>
<tr><th>로봇 모델</th><td>${spec.name}</td></tr>
<tr><th>페이로드</th><td>${spec.payload} kg</td></tr>
<tr><th>도달거리</th><td>${spec.reach} m (${(spec.reach*1000).toFixed(0)} mm)</td></tr>
<tr><th>로봇–포지셔너 거리 (X축)</th><td>${(robotDistance*1000).toFixed(0)} mm</td></tr>
<tr><th>로봇 페더스털 높이</th><td>${robotHeightMm} mm</td></tr>
<tr><th>포지셔너 페더스털 높이</th><td>${positionerHeightMm} mm</td></tr>
<tr><th>C-테이블 지름</th><td>${tableDia.toFixed(0)} mm</td></tr>
</table>

<h2>조인트 한계 (데이터시트)</h2>
<table>
<tr><th>조인트</th><th>최소</th><th>최대</th><th>현재 값</th></tr>
${Object.entries(spec.limits).map(([k,[lo,hi]]) =>
  `<tr><td>${k.toUpperCase()}</td><td>${lo}°</td><td>${hi}°</td><td>${state[k].toFixed(2)}°</td></tr>`).join('')}
</table>

<h2>포지셔너 한계 (Working Range)</h2>
<table>
<tr><th>축</th><th>최소</th><th>최대</th><th>스트로크</th></tr>
<tr><td>A축 (틸트)</td><td>${document.getElementById('axisA').min}°</td><td>${document.getElementById('axisA').max}°</td><td>${parseFloat(document.getElementById('axisA').max) - parseFloat(document.getElementById('axisA').min)}°</td></tr>
<tr><td>C축 (회전)</td><td>${document.getElementById('axisC').min}°</td><td>${document.getElementById('axisC').max}°</td><td>${parseFloat(document.getElementById('axisC').max) - parseFloat(document.getElementById('axisC').min)}°</td></tr>
</table>

<h2>월드 좌표 위치 (Three.js Y-up 기준)</h2>
<table>
<tr><th>지점</th><th>X</th><th>Y (높이)</th><th>Z</th></tr>
${Object.entries(positions).map(([k, p]) =>
  p ? `<tr><td>${k}</td><td class="coord">${(p.x*1000).toFixed(1)} mm</td><td class="coord">${(p.y*1000).toFixed(1)} mm</td><td class="coord">${(p.z*1000).toFixed(1)} mm</td></tr>` : ''
).join('')}
</table>
<p style="font-size:11px;color:#888">* 산업용 좌표(Z-up)로 환산: industrial X = world X, industrial Y = world Z, industrial Z = world Y</p>

<h2>작업 스트로크 (C-테이블 중심 = 상대좌표 0,0,0)</h2>
<table>
<tr><th>축</th><th>크기</th></tr>
<tr><td>X (전후)</td><td>${wsX} mm</td></tr>
<tr><td>Y (높이)</td><td>${wsY} mm</td></tr>
<tr><td>Z (좌우)</td><td>${wsZ} mm</td></tr>
</table>

<p style="margin-top:24px"><button class="btn" onclick="window.print()">프린트 / PDF로 저장</button></p>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('팝업이 차단되었습니다. 보고서 표시를 허용해 주세요.'); return; }
  w.document.write(html);
  w.document.close();
}
document.getElementById('generateReport').addEventListener('click', generateReport);

// ============================================================
//  워크오브젝트 적층 — 패스 생성 + 재생
// ============================================================
let woToolpath = [];     // [{x,y,z}, ...] cAxis local frame, m
let woPathIndex = 0;
let woPlaying = false;
const _woMat = new THREE.Matrix4();

function woUpdateGhost() {
  const shape = document.getElementById('woShape').value;
  if (woGhost.geometry) woGhost.geometry.dispose();
  if (shape === 'box') {
    const wx = parseFloat(document.getElementById('woX').value)/1000;
    const wy = parseFloat(document.getElementById('woY').value)/1000;
    const wz = parseFloat(document.getElementById('woZ').value)/1000;
    woGhost.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(wx, wy, wz));
    woGhost.position.set(0, wy/2, 0);
  } else {
    const d = parseFloat(document.getElementById('woD').value)/1000;
    const h = parseFloat(document.getElementById('woH').value)/1000;
    woGhost.geometry = new THREE.EdgesGeometry(new THREE.CylinderGeometry(d/2, d/2, h, 32));
    woGhost.position.set(0, h/2, 0);
  }
  woGhost.visible = true;
}

function woBuildPath() {
  const shape = document.getElementById('woShape').value;
  const layerH = parseFloat(document.getElementById('woLayerH').value)/1000;
  const track  = parseFloat(document.getElementById('woTrack').value)/1000;
  woToolpath = [];

  if (shape === 'box') {
    const wx = parseFloat(document.getElementById('woX').value)/1000;
    const wy = parseFloat(document.getElementById('woY').value)/1000;
    const wz = parseFloat(document.getElementById('woZ').value)/1000;
    const numLayers = Math.max(1, Math.round(wy / layerH));
    const lh = wy / numLayers;
    const numRows = Math.max(1, Math.round(wz / track));
    const tz = wz / numRows;
    const numCols = Math.max(1, Math.round(wx / track));
    const tx = wx / numCols;
    for (let li = 0; li < numLayers; li++) {
      const y = (li + 0.5) * lh;
      const layerForward = li % 2 === 0;
      for (let ri = 0; ri < numRows; ri++) {
        const z = -wz/2 + (ri + 0.5) * tz;
        const eff = (layerForward === (ri % 2 === 0));
        for (let ci = 0; ci < numCols; ci++) {
          const ic = eff ? ci : (numCols - 1 - ci);
          const x = -wx/2 + (ic + 0.5) * tx;
          woToolpath.push({ x, y, z });
        }
      }
    }
  } else {
    // 원기둥: 로봇은 고정 (TCP 월드 위치 고정), C축이 회전하면서 외곽 둘레 적층
    const d = parseFloat(document.getElementById('woD').value)/1000;
    const h = parseFloat(document.getElementById('woH').value)/1000;
    const rr = d/2 - track/2;
    const numLayers = Math.max(1, Math.round(h / layerH));
    const lh = h / numLayers;
    if (rr > 0) {
      const numAngles = Math.max(12, Math.round((2 * Math.PI * rr) / track));
      for (let li = 0; li < numLayers; li++) {
        const y = (li + 0.5) * lh;
        const dir = (li % 2 === 0) ? 1 : -1;
        for (let pi = 0; pi < numAngles; pi++) {
          const aDeg = (pi / numAngles) * 360 * dir;
          // 로봇 고정 + C축 회전 모드
          woToolpath.push({ isCylinder: true, axisCDeg: aDeg, layerY: y, rr });
        }
      }
    }
  }

  document.getElementById('woPointCount').textContent = woToolpath.length;
  woDeposit.count = 0;
  woDeposit.instanceMatrix.needsUpdate = true;
  woPathIndex = 0;
  document.getElementById('woDepositCount').textContent = 0;
  woTip.visible = false;
  woUpdateGhost();
}

// solveIK 는 ./robot/kinematics.js 에서 import. 위 헤더에서 currentSpec/robotGroup/robotParts 의존 closure 로 wrap.

let WO_STEP_MS = 250;             // 한 포인트당 진행 시간 (ms) — 슬라이더로 갱신
function woTick() {
  if (!woPlaying) return;
  if (woPathIndex >= woToolpath.length) {
    woPlaying = false;
    woTip.visible = false;
    document.getElementById('woPlay').textContent = '▶ 적층 재생';
    return;
  }
  if (woDeposit.count >= WO_MAX) {
    woPlaying = false;
    alert('적층 최대 개수(' + WO_MAX + ') 도달');
    return;
  }
  const track = parseFloat(document.getElementById('woTrack').value)/1000;
  const layerH = parseFloat(document.getElementById('woLayerH').value)/1000;
  const sx = track * 0.92, sy = layerH * 0.95, sz = track * 0.92;
  const p = woToolpath[woPathIndex];

  let depX, depY, depZ;
  let updatedAxisC = false;

  if (p.isCylinder) {
    // 원기둥 모드: state.axisC 갱신 → 같은 월드 TCP 위치를 위해 cAxis local 보정 좌표 계산
    state.axisC = p.axisCDeg;
    updatedAxisC = true;
    applyState();
    cAxisGroup.updateMatrixWorld(true);
    const aRad = THREE.MathUtils.degToRad(p.axisCDeg);
    depX = p.rr * Math.cos(aRad);
    depY = p.layerY;
    depZ = p.rr * Math.sin(aRad);
  } else {
    cAxisGroup.updateMatrixWorld(true);
    depX = p.x; depY = p.y; depZ = p.z;
  }

  // 월드 TCP 타깃 (cAxis local → world)
  const worldTcp = new THREE.Vector3(depX, depY, depZ).applyMatrix4(cAxisGroup.matrixWorld);
  // IK로 조인트 해석
  const ik = solveIK(worldTcp);
  if (ik && currentSpec) {
    const lim = currentSpec.limits;
    const clmp = (k, v) => Math.max(lim[k][0], Math.min(lim[k][1], v));
    state.j1 = clmp('j1', ik.j1);
    state.j2 = clmp('j2', ik.j2);
    state.j3 = clmp('j3', ik.j3);
    state.j4 = clmp('j4', ik.j4);
    state.j5 = clmp('j5', ik.j5);
    state.j6 = clmp('j6', ik.j6);
  }
  // UI 동기화
  const updateKeys = updatedAxisC ? ['j1','j2','j3','j4','j5','j6','axisC'] : ['j1','j2','j3','j4','j5','j6'];
  for (const k of updateKeys) {
    const sl = document.getElementById(k);
    const inp = document.getElementById(k+'v');
    if (sl) sl.value = Math.round(state[k]);
    if (inp) inp.value = state[k].toFixed(1);
  }
  applyState();
  updateInfo();

  // 적층 (cAxis local 좌표에 박스)
  _woMat.makeScale(sx, sy, sz);
  _woMat.setPosition(depX, depY, depZ);
  woDeposit.setMatrixAt(woDeposit.count, _woMat);
  woDeposit.count++;
  woDeposit.instanceMatrix.needsUpdate = true;
  woTip.position.set(depX, depY, depZ);
  woTip.visible = true;
  document.getElementById('woDepositCount').textContent = woDeposit.count;
  woPathIndex++;
  if (woPlaying) setTimeout(woTick, WO_STEP_MS);
}

document.getElementById('woShape').addEventListener('change', (e) => {
  const isBox = e.target.value === 'box';
  document.getElementById('woBoxDims').style.display = isBox ? '' : 'none';
  document.getElementById('woCylDims').style.display = isBox ? 'none' : '';
});
document.getElementById('woBuild').addEventListener('click', woBuildPath);
document.getElementById('woPlay').addEventListener('click', () => {
  if (!woToolpath.length) woBuildPath();
  woPlaying = !woPlaying;
  document.getElementById('woPlay').textContent = woPlaying ? '⏸ 일시정지' : '▶ 적층 재생';
  if (woPlaying) woTick();
});
document.getElementById('woReset').addEventListener('click', () => {
  woPlaying = false;
  woDeposit.count = 0;
  woDeposit.instanceMatrix.needsUpdate = true;
  woPathIndex = 0;
  document.getElementById('woDepositCount').textContent = 0;
  woTip.visible = false;
  document.getElementById('woPlay').textContent = '▶ 적층 재생';
});

// 적층 속도 슬라이더
const woSpeedEl = document.getElementById('woSpeed');
const woSpeedV  = document.getElementById('woSpeedV');
woSpeedEl.addEventListener('input', () => {
  WO_STEP_MS = parseFloat(woSpeedEl.value);
  woSpeedV.textContent = WO_STEP_MS + 'ms';
});

// 화면 비우기 — ghost / deposit / tip 모두 숨김 (재생 정지) + path 비움
document.getElementById('woClear').addEventListener('click', () => {
  woPlaying = false;
  woDeposit.count = 0;
  woDeposit.instanceMatrix.needsUpdate = true;
  woPathIndex = 0;
  woToolpath = [];
  document.getElementById('woDepositCount').textContent = 0;
  document.getElementById('woPointCount').textContent = 0;
  woTip.visible = false;
  woGhost.visible = false;
  document.getElementById('woPlay').textContent = '▶ 적층 재생';
});

// 워크오브젝트 가시성 토글
const showWorkobject = document.getElementById('showWorkobject');
showWorkobject.addEventListener('change', () => {
  const v = showWorkobject.checked;
  if (!v) {
    woGhost.visible = false;
    woDeposit.visible = false;
    woTip.visible = false;
  } else {
    woDeposit.visible = true;
    if (woToolpath.length) woGhost.visible = true;
    if (woPlaying) woTip.visible = true;
  }
});

// 프리셋 자세
function setPose(p) {
  Object.assign(state, p);
  for (const k of Object.keys(p)) {
    const slider = document.getElementById(k);
    const input  = document.getElementById(k+'v');
    if (slider) slider.value = p[k];
    if (input)  input.value  = p[k];
  }
  applyState(); updateInfo();
}
document.getElementById('presetHome').addEventListener('click', () =>
  setPose({ j1:0, j2:0, j3:0, j4:0, j5:0, j6:0, axisA:0, axisC:0 }));

// 경로 시뮬레이션
const path = [];
const poseCountEl = document.getElementById('poseCount');
function refreshPathInfo() { poseCountEl.textContent = path.length; }

document.getElementById('recordPose').addEventListener('click', () => {
  path.push({ ...state });
  refreshPathInfo();
});
document.getElementById('clearPath').addEventListener('click', () => {
  path.length = 0; refreshPathInfo();
});

let playing = false;
let playSpeed = 1;
const playSpeedEl = document.getElementById('playSpeed');
const playSpeedV = document.getElementById('playSpeedV');
playSpeedEl.addEventListener('input', () => {
  playSpeed = parseFloat(playSpeedEl.value);
  playSpeedV.textContent = playSpeed.toFixed(1) + '×';
});

document.getElementById('playPath').addEventListener('click', () => {
  if (path.length < 2) {
    alert('최소 2개의 자세를 저장해 주세요. ("현재 자세 저장" 버튼)');
    return;
  }
  playing = true;
  playPath();
});
document.getElementById('stopPath').addEventListener('click', () => {
  playing = false;
});

let playStart = 0;
let playSegment = 0;
function playPath() {
  if (!playing || path.length < 2) return;
  playSegment = 0;
  playStart = performance.now();
  const segDuration = 1500; // ms per segment at 1x speed

  function animate() {
    if (!playing) return;
    const now = performance.now();
    const elapsed = (now - playStart) * playSpeed;
    const segIdx = Math.floor(elapsed / segDuration);
    if (segIdx >= path.length - 1) {
      // 마지막 자세에 정지
      const last = path[path.length - 1];
      Object.assign(state, last);
      syncSlidersFromState(); applyState(); updateInfo();
      playing = false;
      return;
    }
    const t = (elapsed % segDuration) / segDuration;
    const a = path[segIdx];
    const b = path[segIdx + 1];
    for (const k of Object.keys(state)) {
      state[k] = a[k] + (b[k] - a[k]) * t;
    }
    syncSlidersFromState(false); // 슬라이더 라벨만 갱신 (성능)
    applyState(); updateInfo();
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

function syncSlidersFromState(updateInputs=true) {
  for (const k of Object.keys(state)) {
    const slider = document.getElementById(k);
    const input  = document.getElementById(k+'v');
    if (!slider) continue;
    if (updateInputs) slider.value = state[k];
    if (input) input.value = (Math.round(state[k] * 10) / 10).toFixed(0);
  }
}

// ============================================================
//  리사이즈 및 렌더 루프
// ============================================================
window.addEventListener('resize', () => {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

function tick() {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// 초기화
robotSel.value = 'IRB4600';
buildRobot('IRB4600');
applyJointLimitsToSliders(currentSpec);
updateRobotPosition();
applyState();
updateInfo();
refreshPathInfo();
tick();

// 콘솔에 도움말 출력
console.log('%c ABB 로봇 + A/C축 시뮬레이터 ', 'background:#ff6b35;color:#fff;font-weight:bold;padding:4px 8px');
console.log('마우스: 좌클릭 회전 / 휠 줌 / 우클릭(또는 Shift+드래그) 패닝');
