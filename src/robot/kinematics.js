// 단순 IK — TCP를 월드 타깃으로 보내는 J1/J2/J3/J5 해석해
// 체인: j3 → (a3, d3) elbow 굴곡 → j4 → a4 → j5(wrist center) → a5 → j6 → STL 모듈 → TCP
// 가정: wrist 수평 유지 (combined Z 회전 = 0). state.j5 = state.j2 - state.j3
//
// 입력:
//   targetWorld: THREE.Vector3 — 월드 좌표계의 TCP 타깃
//   spec: ROBOT_SPECS 항목 (a1, a2, a3, a4, a5, d1, d3, d4 ...)
//   robotGroup: THREE.Object3D — robotGroup (월드 위치/회전 가져오기 위함)
//   tcpLocalPos: THREE.Vector3 — j6 로컬 좌표의 TCP anchor 위치
//
// 반환: { j1, j2, j3, j4, j5, j6 } (degrees) 또는 null
import * as THREE from 'three';

export function solveIK(targetWorld, spec, robotGroup, tcpLocalPos) {
  if (!spec || !robotGroup || !tcpLocalPos) return null;
  // j5에서 TCP까지 = (a5, 0, 0) + tcpAnchor.position
  const TOOL_FORWARD = (spec.a5 ?? 0.04) + tcpLocalPos.x;
  const TOOL_DROP = -tcpLocalPos.y;
  const rw = new THREE.Vector3();
  robotGroup.getWorldPosition(rw);
  const dx = targetWorld.x - rw.x;
  const dy = targetWorld.y - rw.y;
  const dz = targetWorld.z;
  // robotGroup은 Ry(π) 회전 → 로봇 로컬에선 X·Z 부호 반전
  const lx = -dx, ly = dy, lz = -dz;
  const theta1 = Math.atan2(-lz, lx);
  const r_tcp = Math.sqrt(lx*lx + lz*lz);
  const h_tcp = ly;
  // wrist(j5) 타깃 = TCP - (TOOL_FORWARD, -TOOL_DROP)
  const r_w = r_tcp - TOOL_FORWARD;
  const h_w = h_tcp + TOOL_DROP;
  const dx2 = r_w - spec.a1;
  const dy2 = h_w - spec.d1;
  const D = Math.sqrt(dx2*dx2 + dy2*dy2);
  const L1 = spec.a2;
  // J3→J5 = sqrt((a3+a4)² + d3²) — elbow bend 포함
  const a34 = (spec.a3 ?? spec.d4) + (spec.a4 ?? 0.05);
  const d34 = spec.d3 ?? 0;
  const L2 = Math.sqrt(a34*a34 + d34*d34);
  const elbowOffset = Math.atan2(d34, a34);
  const Dmin = Math.abs(L1 - L2) + 0.01;
  const Dmax = L1 + L2 - 0.01;
  const Dc = Math.max(Dmin, Math.min(Dmax, D));
  const cosInner = (L1*L1 + L2*L2 - Dc*Dc) / (2*L1*L2);
  const innerAngle = Math.acos(Math.max(-1, Math.min(1, cosInner)));
  const phi = Math.atan2(dy2, dx2);
  const cosPsi = (L1*L1 + Dc*Dc - L2*L2) / (2*L1*Dc);
  const psi = Math.acos(Math.max(-1, Math.min(1, cosPsi)));
  const shoulderAngle = phi + psi;
  const j2Deg = (Math.PI/2 - shoulderAngle) * 180 / Math.PI;
  const j3Deg = (innerAngle - Math.PI/2 - elbowOffset) * 180 / Math.PI;
  const j5Deg = j2Deg - j3Deg;
  return {
    j1: theta1 * 180/Math.PI,
    j2: j2Deg,
    j3: j3Deg,
    j4: 0,
    j5: j5Deg,
    j6: 0,
  };
}
