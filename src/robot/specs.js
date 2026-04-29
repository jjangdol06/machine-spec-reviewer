// ABB 로봇 사양 — 공식 데이터시트 기반 (단위: m, °)
//   링크 길이: 공식 도면(Robot dimensions) 기준
//   조인트 한계: datasheet의 Working range
//   색상: ABB Orange (Pantone 158C ≈ #ff6b1f)
//   reference: https://new.abb.com/products/robotics/industrial-robots
//
// 필드 의미:
//   d1: J2 높이 (J1 base 위)
//   a1: J1→J2 X 오프셋
//   a2: J2→J3 거리 (상박 길이)
//   d4: J3→J5 직선 거리 (구식 단일 forearm 표현; reach 계산용)
//   d6: J5/J6 끝→플랜지 오프셋
//   a3, d3: J3→J4 elbow X·Y 오프셋 (CAD 측정)
//   a4: J4→J5 forearm
//   a5: J5→J6
//   limits: { jN: [min, max] } 데이터시트 working range (deg)

export const ABB_ORANGE = 0xff6b1f;

export const ROBOT_SPECS = {
  IRB2600: {
    name: 'IRB 2600-12/1.65', payload: 12, reach: 1.65,
    d1: 0.445, a1: 0.150, a2: 0.700, d4: 0.795, d6: 0.085,
    a3: 0.297, d3: 0.115, a4: 0.498, a5: 0.054,
    limits: { j1:[-180,180], j2:[-95,155], j3:[-180,75], j4:[-400,400], j5:[-120,120], j6:[-400,400] },
    color: ABB_ORANGE,
  },
  IRB4600: {
    name: 'IRB 4600-60/2.05', payload: 60, reach: 2.05,
    d1: 0.495, a1: 0.175, a2: 0.900, d4: 0.960, d6: 0.135,
    a3: 0.343, d3: 0.175, a4: 0.617, a5: 0.073,
    limits: { j1:[-180,180], j2:[-90,150], j3:[-180,75], j4:[-400,400], j5:[-125,120], j6:[-400,400] },
    color: ABB_ORANGE,
  },
  IRB6700: {
    name: 'IRB 6700-200/2.60', payload: 200, reach: 2.60,
    d1: 0.780, a1: 0.320, a2: 1.125, d4: 1.142, d6: 0.200,
    a3: 0.235, d3: 0.355, a4: 0.946, a5: 0.166,
    limits: { j1:[-170,170], j2:[-65,85], j3:[-180,70], j4:[-300,300], j5:[-130,130], j6:[-360,360] },
    color: ABB_ORANGE,
  },
  IRB7600: {
    name: 'IRB 7600-500/2.55', payload: 500, reach: 2.55,
    d1: 0.780, a1: 0.410, a2: 1.075, d4: 1.392, d6: 0.250,
    a3: 0.300, d3: 0.200, a4: 0.900, a5: 0.180,
    limits: { j1:[-180,180], j2:[-60,85], j3:[-180,60], j4:[-300,300], j5:[-100,100], j6:[-360,360] },
    color: ABB_ORANGE,
  },
};
