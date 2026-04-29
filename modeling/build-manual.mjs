// ABB 로봇 시뮬레이터 매뉴얼 PDF 생성
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';

const FONT_REG = 'C:/Windows/Fonts/malgun.ttf';
const FONT_BOLD = 'C:/Windows/Fonts/malgunbd.ttf';
const ORANGE = '#ff6b1f';
const DARK = '#21252b';
const LIGHT_BG = '#f5f5f7';
const TEXT = '#222';
const MUTED = '#666';
const ACCENT = '#a0c4ff';

const out = path.resolve('manual.pdf');
const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 50, right: 50 } });
doc.pipe(fs.createWriteStream(out));

// 한글 폰트 등록
if (fs.existsSync(FONT_REG)) {
  doc.registerFont('Reg', FONT_REG);
  if (fs.existsSync(FONT_BOLD)) doc.registerFont('Bold', FONT_BOLD);
  else doc.registerFont('Bold', FONT_REG);
} else {
  // fallback
  doc.registerFont('Reg', 'Helvetica');
  doc.registerFont('Bold', 'Helvetica-Bold');
}

// ===== 헬퍼 =====
function header(title, sub) {
  doc.font('Bold').fontSize(20).fillColor(ORANGE).text(title);
  if (sub) doc.font('Reg').fontSize(11).fillColor(MUTED).text(sub);
  doc.moveDown(0.3);
  doc.strokeColor(ORANGE).lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.6);
}
function sectionTitle(text) {
  doc.moveDown(0.6);
  doc.font('Bold').fontSize(14).fillColor(DARK).text(text);
  doc.strokeColor('#ddd').lineWidth(0.5).moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).stroke();
  doc.moveDown(0.3);
}
function subTitle(text) {
  doc.moveDown(0.3);
  doc.font('Bold').fontSize(11).fillColor(ORANGE).text(text);
  doc.moveDown(0.15);
}
function body(text) {
  doc.font('Reg').fontSize(10).fillColor(TEXT).text(text, { align: 'justify' });
  doc.moveDown(0.25);
}
function bullet(items) {
  doc.font('Reg').fontSize(10).fillColor(TEXT);
  for (const it of items) {
    doc.text('• ' + it, { indent: 14, paragraphGap: 2 });
  }
  doc.moveDown(0.2);
}
function code(text) {
  const startY = doc.y;
  const lines = text.split('\n');
  const lineHeight = 12;
  const padding = 8;
  const boxH = lines.length * lineHeight + padding * 2;
  doc.rect(50, startY, 495, boxH).fill('#1a1d23');
  doc.fillColor('#ffd166').font('Reg').fontSize(9);
  let y = startY + padding;
  for (const ln of lines) {
    doc.text(ln, 60, y, { width: 475, lineBreak: false });
    y += lineHeight;
  }
  doc.y = startY + boxH + 8;
}
function table(rows, opts = {}) {
  const colW = opts.colW || rows[0].map(() => 495 / rows[0].length);
  const startX = 50;
  const padding = 6;
  doc.font('Reg').fontSize(9);
  let y = doc.y;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const isHeader = i === 0;
    let x = startX;
    let maxH = 0;
    // measure
    for (let c = 0; c < row.length; c++) {
      const w = colW[c];
      const h = doc.heightOfString(String(row[c]), { width: w - 2*padding });
      if (h > maxH) maxH = h;
    }
    const rowH = maxH + 2*padding;
    // bg
    if (isHeader) doc.rect(startX, y, colW.reduce((a,b)=>a+b,0), rowH).fill('#e8eaee');
    else if (i % 2 === 0) doc.rect(startX, y, colW.reduce((a,b)=>a+b,0), rowH).fill('#fafafa');
    // text + border
    doc.fillColor(isHeader ? DARK : TEXT).font(isHeader ? 'Bold' : 'Reg');
    x = startX;
    for (let c = 0; c < row.length; c++) {
      doc.text(String(row[c]), x + padding, y + padding, { width: colW[c] - 2*padding });
      x += colW[c];
    }
    // borders
    doc.strokeColor('#ccc').lineWidth(0.4);
    doc.rect(startX, y, colW.reduce((a,b)=>a+b,0), rowH).stroke();
    let xBorder = startX;
    for (let c = 0; c < row.length - 1; c++) {
      xBorder += colW[c];
      doc.moveTo(xBorder, y).lineTo(xBorder, y + rowH).stroke();
    }
    y += rowH;
    doc.y = y;
  }
  doc.moveDown(0.4);
}
function note(text) {
  const startY = doc.y;
  const w = 495;
  const padding = 10;
  doc.font('Reg').fontSize(9.5).fillColor(TEXT);
  const h = doc.heightOfString('💡 ' + text, { width: w - 2*padding }) + 2*padding;
  doc.rect(50, startY, w, h).fill('#fff4e0');
  doc.strokeColor(ORANGE).lineWidth(1);
  doc.moveTo(50, startY).lineTo(50, startY + h).stroke();
  doc.fillColor(TEXT).text('💡 ' + text, 50 + padding, startY + padding, { width: w - 2*padding });
  doc.y = startY + h + 6;
}
function newPage() { doc.addPage(); }
function pageHeaderFooter(title, num) {
  // header
  doc.font('Reg').fontSize(8).fillColor(MUTED);
  doc.text(title, 50, 30, { width: 495, align: 'right' });
  // footer
  doc.text(`${num}`, 50, 800, { width: 495, align: 'center' });
}

// UI 다이어그램 (CSS 박스 스타일을 PDF에 SVG/사각형으로 표현)
function uiBox(x, y, w, h, label, fill = '#21252b', textColor = '#e6e8eb') {
  doc.rect(x, y, w, h).fillAndStroke(fill, '#3d434c');
  doc.fillColor(textColor).font('Reg').fontSize(8.5).text(label, x + 4, y + h/2 - 5, { width: w - 8, align: 'left' });
}
function uiSlider(x, y, w, label, value) {
  // label
  doc.fillColor('#b8bcc4').font('Reg').fontSize(8).text(label, x, y + 1, { width: 50 });
  // track
  doc.rect(x + 55, y + 5, w - 110, 4).fill('#3d434c');
  // thumb
  doc.circle(x + 55 + (w - 110) * 0.35, y + 7, 5).fill(ORANGE);
  // value
  doc.fillColor('#ffd166').font('Reg').fontSize(8).text(value, x + w - 50, y + 1, { width: 45, align: 'right' });
}
function uiInput(x, y, w, h, value) {
  doc.rect(x, y, w, h).fillAndStroke('#2f343c', '#3d434c');
  doc.fillColor('#ffd166').font('Reg').fontSize(8.5).text(value, x + 6, y + h/2 - 4, { width: w - 12 });
}
function uiButton(x, y, w, h, label, primary = false) {
  doc.rect(x, y, w, h).fillAndStroke(primary ? ORANGE : '#2f343c', primary ? ORANGE : '#3d434c');
  doc.fillColor(primary ? '#fff' : '#e6e8eb').font(primary ? 'Bold' : 'Reg').fontSize(8.5)
     .text(label, x, y + h/2 - 5, { width: w, align: 'center' });
}
function uiCheckbox(x, y, label, checked = true) {
  doc.rect(x, y, 10, 10).fillAndStroke('#2f343c', '#3d434c');
  if (checked) doc.fillColor(ORANGE).rect(x + 2, y + 2, 6, 6).fill();
  doc.fillColor(TEXT).font('Reg').fontSize(8.5).text(label, x + 16, y);
}

// ============== 표지 ==============
doc.font('Bold').fontSize(28).fillColor(ORANGE).text('ABB 로봇 +', 50, 200);
doc.text('A/C축 포지셔너 시뮬레이터', 50, 240);
doc.font('Reg').fontSize(14).fillColor(DARK).text('사용자 매뉴얼', 50, 290);
doc.moveDown(2);
doc.font('Reg').fontSize(11).fillColor(MUTED).text('웹 기반 산업용 로봇 셀 시뮬레이션 도구', 50, 360);
doc.text('실제 ABB CAD 모델 + IK · 적층 시뮬레이션 · 보고서 생성', 50, 380);

// 로봇 아이콘 (단순 스케치)
const cx = 400, cy = 420;
doc.rect(cx - 30, cy + 100, 60, 30).fill('#3a4250');                  // base
doc.rect(cx - 8, cy + 30, 16, 70).fill(ORANGE);                       // column
doc.rect(cx - 5, cy + 30, 10, 5).fill(ORANGE);                        // shoulder
doc.rect(cx, cy - 30, 70, 16).fill(ORANGE);                           // forearm (after rotation)
doc.rect(cx + 65, cy - 25, 8, 8).fill('#404448');                     // wrist
doc.rect(cx + 70, cy - 18, 10, 40).fill('#404448');                   // module
doc.circle(cx + 75, cy + 25, 4).fill('#ffd166');                      // tcp tip

doc.font('Reg').fontSize(9).fillColor(MUTED).text(`생성일: ${new Date().toLocaleString('ko-KR')}`, 50, 760);
doc.text('Version 1.0', 50, 775);

// ============== 목차 ==============
newPage();
header('목차');
const toc = [
  ['1.', '시뮬레이터 소개', '3'],
  ['2.', '기본 화면 구성', '3'],
  ['3.', '장비 설정', '4'],
  ['4.', '로봇 축 제어 (J1~J6)', '5'],
  ['5.', '포지셔너 (A/C 축)', '6'],
  ['6.', 'TCP 위치 표시', '6'],
  ['7.', '표시 옵션', '7'],
  ['8.', '프로젝트 (저장/불러오기/보고서)', '8'],
  ['9.', '워크오브젝트 적층 시뮬레이션', '9'],
  ['10.', '경로 시뮬레이션', '10'],
  ['11.', '실제 로봇 GLB 모델 + 모듈', '11'],
  ['12.', '단축키', '12'],
  ['13.', '트러블슈팅', '12'],
];
doc.font('Reg').fontSize(11).fillColor(TEXT);
for (const [n, t, p] of toc) {
  doc.text(`${n}  ${t}`, 70, doc.y, { continued: true });
  doc.text(`${'.'.repeat(60 - t.length * 2)}  ${p}`, { align: 'left' });
  doc.moveDown(0.4);
}

// ============== 1. 소개 ==============
newPage();
header('1. 시뮬레이터 소개');
body('ABB 산업용 로봇(IRB 2600/4600/6700)과 A/C축 트러니언 포지셔너로 구성된 ' +
     '용접·적층 셀을 웹 브라우저에서 시뮬레이션하는 도구입니다. 실제 ABB CAD STEP 파일을 ' +
     'GLB로 변환하여 로봇 형상을 표시하고, 데이터시트 기반 조인트 한계와 운동학을 적용합니다.');
sectionTitle('주요 기능');
bullet([
  '실제 ABB IRB 2600/4600/6700 CAD 모델 (GLB) 적용',
  '데이터시트 기반 조인트 한계 (working range)',
  '인버스 키네매틱(IK) — 타깃 좌표로 TCP 자동 정렬',
  'A/C축 포지셔너 (베드형 + 턴테이블)',
  'C-테이블 지름 / 작업 스트로크 박스 가시화',
  '워크오브젝트 적층 시뮬레이션 (직육면체/원기둥)',
  '로봇·포지셔너 페더스털 높이 설정',
  '설정 저장/불러오기 (JSON)',
  '월드 좌표 위치 + 스펙 포함 보고서 생성 (HTML 인쇄)',
  'STL 모듈(welding torch) J6 끝단 부착',
]);

// ============== 2. 화면 구성 ==============
sectionTitle('2. 기본 화면 구성');
body('화면은 좌측 3D 뷰포트와 우측 컨트롤 패널(360px)로 구성됩니다.');

// UI layout diagram
const diagY = doc.y;
doc.rect(50, diagY, 495, 200).fillAndStroke(DARK, '#3d434c');
doc.rect(50, diagY, 350, 200).fill('#0e1015');     // viewport area
doc.rect(400, diagY, 145, 200).fill('#21252b');    // panel
doc.fillColor('#a0c4ff').font('Bold').fontSize(11)
   .text('3D 뷰포트', 50, diagY + 15, { width: 350, align: 'center' });
doc.fillColor('#ffd166').fontSize(8).font('Reg').text('상태바', 60, diagY + 35);
doc.fillColor('#ffd166').text('범례', 60, diagY + 175);

// panel preview
doc.fillColor(ORANGE).font('Bold').fontSize(8).text('ABB 로봇 + A/C축 포지셔너', 410, diagY + 10);
doc.fillColor(ACCENT).fontSize(7).text('장비 설정', 410, diagY + 30);
doc.fillColor(ACCENT).text('로봇 축 (J1~J6)', 410, diagY + 60);
doc.fillColor(ACCENT).text('포지셔너 (A/C축)', 410, diagY + 95);
doc.fillColor(ACCENT).text('TCP 위치', 410, diagY + 120);
doc.fillColor(ACCENT).text('표시 옵션', 410, diagY + 145);
doc.fillColor(ACCENT).text('프로젝트', 410, diagY + 165);
doc.fillColor(ACCENT).text('워크오브젝트 적층', 410, diagY + 180);

doc.y = diagY + 210;
doc.moveDown(0.5);

note('마우스 좌클릭 드래그: 카메라 회전 / 휠: 줌 / 우클릭(또는 Shift+드래그): 패닝');

// ============== 3. 장비 설정 ==============
newPage();
header('3. 장비 설정');
body('우측 패널 최상단의 "장비 설정" 섹션에서 로봇 모델, 거리, 테이블, 스트로크, 페더스털 높이를 지정합니다.');
sectionTitle('항목');
table([
  ['항목', '단위', '범위', '설명'],
  ['로봇', '-', '드롭다운', 'IRB 2600 / 4600 / 6700 (각 모델별 데이터시트 적용)'],
  ['거리', 'mm', '500–5000', '로봇 베이스(J1축)와 포지셔너 중심 사이 X축 거리'],
  ['C 테이블', 'mm', '100–3000', 'C축 턴테이블 디스크 지름. 100mm 단위로 베어링 서포트 자동 확장'],
  ['스트로크', 'mm', '100×3', 'X / Y / Z 작업 스트로크 박스 (C-테이블 중심 기준)'],
  ['로봇 H', 'mm', '0–2000', '로봇 페더스털 높이. 원기둥 기둥 추가 표시'],
  ['포지셔너 H', 'mm', '0–2000', '포지셔너 페더스털 높이. 박스 기둥 추가 표시'],
], { colW: [70, 45, 75, 305] });

note('mm 입력 박스는 타이핑 중 부분 값 보존, Enter/blur 시 한계 초과 자동 클램프 후 표시.');

sectionTitle('UI 미리보기');
const equipY = doc.y;
doc.rect(50, equipY, 360, 220).fillAndStroke('#21252b', '#3d434c');
doc.fillColor(ACCENT).font('Bold').fontSize(10).text('장비 설정', 60, equipY + 10);
let ey = equipY + 32;
// 로봇
doc.fillColor('#b8bcc4').font('Reg').fontSize(8).text('로봇', 60, ey);
doc.rect(110, ey - 2, 290, 16).fillAndStroke('#2f343c', '#3d434c');
doc.fillColor('#e6e8eb').text('IRB 4600-60/2.05 (60kg, 2.05m) ▼', 116, ey);
ey += 22;
// 거리
doc.fillColor('#b8bcc4').text('거리', 60, ey);
uiInput(110, ey - 2, 240, 16, '2200');
doc.fillColor('#ffd166').fontSize(7).text('mm', 360, ey);
doc.text('(2.20m)', 380, ey);
ey += 22;
// 테이블
doc.fillColor('#b8bcc4').fontSize(8).text('C 테이블', 60, ey);
uiInput(110, ey - 2, 240, 16, '1000');
doc.fillColor('#ffd166').fontSize(7).text('mm', 360, ey);
doc.text('(1.000m)', 380, ey);
ey += 22;
// 스트로크
doc.fillColor('#b8bcc4').fontSize(8).text('스트로크', 60, ey);
uiInput(110, ey - 2, 78, 16, '1500');
uiInput(192, ey - 2, 78, 16, '1500');
uiInput(274, ey - 2, 78, 16, '1500');
ey += 17;
doc.fillColor(MUTED).fontSize(6.5).text('X × Y × Z (mm), C-테이블 중심 (0,0,0)', 110, ey);
ey += 12;
// 로봇 H
doc.fillColor('#b8bcc4').fontSize(8).text('로봇 H', 60, ey);
uiInput(110, ey - 2, 240, 16, '0');
doc.fillColor('#ffd166').fontSize(7).text('mm', 360, ey);
ey += 22;
// 포지셔너 H
doc.fillColor('#b8bcc4').fontSize(8).text('포지셔너 H', 60, ey);
uiInput(110, ey - 2, 240, 16, '0');
doc.fillColor('#ffd166').fontSize(7).text('mm', 360, ey);
doc.y = equipY + 230;

// ============== 4. 로봇 축 ==============
newPage();
header('4. 로봇 축 제어 (J1~J6)');
body('J1~J6 각 조인트는 슬라이더와 텍스트 입력 박스로 동시 제어됩니다. ' +
     '슬라이더 min/max는 선택된 로봇 모델의 데이터시트 working range가 자동 적용됩니다.');

sectionTitle('조인트 한계 (데이터시트)');
table([
  ['모델', 'J1 (°)', 'J2 (°)', 'J3 (°)', 'J4 (°)', 'J5 (°)', 'J6 (°)'],
  ['IRB 2600-12/1.65', '±180', '-95~+155', '-180~+75', '±400', '±120', '±400'],
  ['IRB 4600-60/2.05', '±180', '-90~+150', '-180~+75', '±400', '-125~+120', '±400'],
  ['IRB 6700-200/2.60', '±170', '-65~+85', '-180~+70', '±300', '±130', '±360'],
]);

sectionTitle('홈 자세 (Calibration Pose)');
body('"홈 자세" 버튼을 누르면 모든 조인트가 0°로 초기화되며 ABB 표준 캘리브레이션 자세가 됩니다:');
bullet([
  '상박(upper arm) 수직 위 방향',
  '전박(forearm) 수평 forward 방향',
  '손목 수평 (TCP 모듈은 -Y 방향으로 매달림)',
]);

sectionTitle('입력 동작');
bullet([
  '슬라이더 드래그: 즉시 반영',
  '텍스트 박스 입력: Enter/blur 시 반영, 한계 초과 시 자동 클램프',
  '단위(°) 자동 표시',
  '모델 변경 시 한계 자동 갱신, 현재 값이 신규 한계 밖이면 자동 클램프',
]);

note('상박 UP / 전박 forward 컨벤션은 applyState에서 J2에 +π/2, J3에 -π/2 오프셋을 적용해 구현됩니다. ' +
     'J3+ = 전박이 위로 들리는 방향(ABB 표준).');

// ============== 5. 포지셔너 ==============
newPage();
header('5. 포지셔너 (A/C 축)');
body('베드형 A축 + 상단 C축 턴테이블로 구성된 트러니언 포지셔너입니다.');
sectionTitle('구조');
bullet([
  '바닥 베이스 (사각 블록, 동적 폭 조절)',
  '좌우 베어링 서포트 (X 양 끝, A축 회전봉 지지)',
  'A축 회전봉 (X 방향, 양 서포트 관통)',
  'A축 베드 (사각 평판, X축 주위로 틸트)',
  'C축 디스크 (베드 상단, 베드 노멀 방향 회전)',
  'C-테이블 지름 변경 시 서포트·베드·봉 자동 확장',
]);

sectionTitle('축 한계');
table([
  ['축', '최소', '최대', '스트로크', '회전 방향'],
  ['A축 (틸트)', '-120°', '+120°', '240°', 'X축 회전'],
  ['C축 (회전)', '-360°', '+360°', '720°', '베드 로컬 Y축 회전'],
]);

sectionTitle('베드 클리어런스');
body('베드와 좌우 서포트 사이 양쪽 10mm 클리어런스가 자동 유지됩니다. C-테이블 지름이 커져도 ' +
     '베어링 서포트가 디스크 반지름 + 150mm 여유까지 자동 확장됩니다.');

// ============== 6. TCP ==============
sectionTitle('6. TCP 위치 표시');
body('TCP(Tool Center Point) 정보는 패널 중간 "TCP 위치 (월드 좌표)" 섹션에 실시간 표시됩니다.');
table([
  ['필드', '의미'],
  ['X / Y / Z', '월드 좌표 위치 (m, Three.js Y-up). Z(=industrial Z) = 높이'],
  ['RX / RY / RZ', 'TCP 자세 (Euler XYZ, °)'],
  ['D', '월드 원점에서 TCP까지 직선 거리 (m)'],
], { colW: [80, 415] });

note('상태 표시줄(좌상단)은 도달 가능 여부를 자동 진단합니다: 정상/근접/초과/충돌 가능.');

// ============== 7. 표시 옵션 ==============
newPage();
header('7. 표시 옵션');
body('각 시각화 요소를 체크박스로 켜고 끌 수 있습니다.');
table([
  ['옵션', '색상', '내용'],
  ['작업 영역 (도달 가능 반경)', '하늘색 와이어프레임', '로봇 J2축 중심의 reach 반경 구'],
  ['TCP 좌표계 표시', 'X(빨)/Y(초)/Z(파) 축', 'TCP 위치에 좌표축 헬퍼'],
  ['TCP 궤적 표시', '노란 라인', 'TCP 이동 경로 트레일 (최대 500점)'],
  ['충돌 경고 영역 (포지셔너)', '반투명 빨강 구', '포지셔너 주변 0.95m 충돌 경고 영역'],
  ['작업 스트로크 박스', '시안 와이어프레임', 'C-테이블 중심 기준 X×Y×Z 박스'],
], { colW: [165, 130, 200] });

sectionTitle('범례 (좌하단)');
body('뷰포트 좌하단에 항상 표시되는 범례:');
bullet([
  'X축 빨강 / Y축 초록 / Z축 파랑 (Three.js 월드 좌표 기준)',
  'TCP 노란색',
  '작업 영역 하늘색',
]);

// ============== 8. 프로젝트 ==============
sectionTitle('8. 프로젝트 (저장/불러오기/보고서)');
body('현재 셋업을 JSON 파일로 저장·복원하거나 HTML 보고서를 생성합니다.');

subTitle('설정 저장');
body('"설정 저장" 버튼 → robot-stage-YYYY-MM-DD.json 다운로드. 저장 항목:');
bullet([
  'robotModel, robotDistanceMm, robotHeightMm, positionerHeightMm',
  'tableDiaMm, strokeMm.{x, y, z}',
  'joints {j1, j2, j3, j4, j5, j6}, axes {axisA, axisC}',
  'version (호환성), timestamp',
]);

subTitle('설정 불러오기');
body('"설정 불러오기" → JSON 파일 선택. 모델 변경 → 거리·높이·테이블·스트로크·조인트 순서로 일괄 적용.');

subTitle('보고서 생성');
body('"보고서 생성" 버튼 → 새 창에 HTML 보고서. 프린트(Ctrl+P) → PDF 저장 가능. 포함 내용:');
bullet([
  '장비 사양 (모델/페이로드/도달거리/거리/높이/테이블 지름)',
  '조인트 한계 + 현재 값 (J1~J6, °)',
  '포지셔너 한계 (A/C, 최소·최대·스트로크)',
  '월드 좌표 위치 (Robot Base / J1~J6 axis / TCP / Positioner / C-table, mm)',
  '작업 스트로크 (X·Y·Z, mm)',
]);

// ============== 9. 적층 ==============
newPage();
header('9. 워크오브젝트 적층 시뮬레이션');
body('직육면체 또는 원기둥 워크오브젝트 위에 툴패스를 따라 재료를 층층이 쌓는 적층 시뮬레이션입니다.');

sectionTitle('워크오브젝트 형상');
table([
  ['형상', '치수 입력', '패스 생성 방식'],
  ['직육면체', 'X × Y × Z (mm)', '각 층마다 zigzag 채움 (track 폭 단위)'],
  ['원기둥', '⌀ × H (mm)', '외곽 둘레만, 로봇 고정 + C축 회전으로 적층'],
], { colW: [70, 130, 295] });

sectionTitle('파라미터');
table([
  ['항목', '단위', '기본값', '설명'],
  ['층 높이', 'mm', '10', '각 층의 Y 두께'],
  ['패스 폭', 'mm', '10', 'zigzag 트랙 간격 / 원기둥 둘레 분할 거리'],
], { colW: [70, 50, 60, 315] });

sectionTitle('실행 흐름');
bullet([
  '1) 형상 + 치수 + 층/패스 폭 설정',
  '2) "패스 생성" 버튼 → 포인트 수 표시',
  '3) "▶ 적층 재생" → TCP가 IK로 패스를 따라 이동, 각 포인트에 박스 적층',
  '재생 속도: 1포인트당 250ms (4 deposits/sec)',
  '"초기화"로 적층 메쉬 비우기',
]);

sectionTitle('원기둥 모드 (로봇 고정)');
body('원기둥 적층 시 로봇 TCP는 월드 고정 위치(원기둥 외곽 한 점)에 멈추고 C축이 회전하면서 ' +
     '실린더가 TCP 아래를 지나갑니다. 적층은 cAxis local의 보정 좌표에 가공 → 결과적으로 ' +
     '실린더 외주에 한 바퀴씩 둘러쌓이는 모습.');

note('적층 색: 주황 (ABB Orange). 최대 8000개 포인트까지 적층 가능 (초과 시 알림).');

// ============== 10. 경로 시뮬레이션 ==============
sectionTitle('10. 경로 시뮬레이션');
body('수동으로 자세를 기록하고 보간 재생하는 기존 경로 시뮬레이션 기능:');
bullet([
  '"홈 자세" 버튼: 모든 조인트 0° 초기화',
  '"현재 자세 저장": path 배열에 추가',
  '"경로 초기화": 저장된 path 비우기',
  '"▶ 경로 재생" / "■ 정지": 자세 사이를 1.5초/세그먼트 보간 재생',
  '재생 속도 슬라이더: 0.2× ~ 3.0×',
]);

// ============== 11. 실제 GLB ==============
newPage();
header('11. 실제 로봇 GLB 모델 + 모듈');
body('ABB Library에서 다운로드한 STEP CAD 파일을 GLB로 변환하여 실제 로봇 형상을 표시합니다.');

sectionTitle('변환 파이프라인');
code(`# STEP → GLB 변환 (Node.js)
node modeling/convert.mjs modeling/IRB2600
node modeling/convert.mjs modeling/IRB4600
node modeling/convert.mjs modeling/IRB6700`);
body('convert.mjs는 occt-import-js (WASM) + @gltf-transform/core를 이용해 ' +
     'STEP의 BREP 메쉬를 BASE/LINK1~6 단위로 GLB(Y-up, 미터, ABB Orange)로 export합니다.');

sectionTitle('파일 구조');
code(`modeling/
├── IRB2600/
│   ├── *_BASE_CAD_*.STEP   → base.glb
│   ├── *_LINK1_CAD_*.STEP  → link1.glb
│   └── ... LINK2~6
├── IRB4600/   (동일)
├── IRB6700/   (동일)
├── module/
│   └── module.stl   ← welding torch
└── convert.mjs`);

sectionTitle('자동 부착');
body('로봇 모델 변경 시 applyRobotGLBs가 호출되어 calibration pose의 j*Group 역행렬을 ' +
     '계산하고 각 LINK GLB를 정확한 위치로 매핑. 파라메트릭 메쉬는 즉시 숨김(반짝거림 방지).');

sectionTitle('관절 위치 보정');
body('각 모델의 ROBOT_SPECS에 a3, d3, a4, a5 (J3→J4 X·Y, J4→J5 X, J5→J6 X) 추가하여 ' +
     'CAD에 있는 elbow bend를 j*Group 위치에 반영. IK는 elbow offset = atan2(d3, a3+a4) 보정.');

sectionTitle('STL 모듈 (welding torch)');
bullet([
  'modeling/module/module.stl (~11MB, 232k 삼각형) 로드',
  '시작 시 미리 비동기 로드, bbox 측정으로 MODULE_HALF_Y 자동 계산',
  '바닥 5% 정점의 X/Z 평균 = MODULE_TIP_OFFSET (TCP 중심)',
  'mesh.position.y = -MODULE_HALF_Y/3 → 모듈 1/3 지점이 j6 회전축에 정렬',
  'GLB의 LINK6 bbox max.x로 flangeX 자동 측정 → 모듈 X 위치를 플랜지 면에 정렬',
  '모듈은 GLB 토글과 무관하게 항상 visible',
]);

// ============== 12. 단축키 ==============
newPage();
header('12. 단축키');
table([
  ['단축키', '동작'],
  ['좌클릭 드래그', '카메라 회전 (orbit)'],
  ['휠 (스크롤)', '줌 인/아웃'],
  ['우클릭 드래그 (또는 Shift+드래그)', '카메라 패닝'],
  ['Enter (입력박스)', '값 확정 + 클램프'],
  ['Tab (입력박스)', '다음 필드로 이동 + 자동 확정'],
], { colW: [200, 295] });

// ============== 13. 트러블슈팅 ==============
sectionTitle('13. 트러블슈팅');
table([
  ['증상', '원인 / 해결'],
  ['로봇 도달 한계 초과', '거리 슬라이더를 줄이거나 페더스털 높이 조정'],
  ['STL 모듈이 안 보임', 'modeling/module/module.stl 파일 확인. 콘솔에 로드 실패 메시지 확인'],
  ['GLB 모델 안 뜨고 파라메트릭만 표시', 'modeling/<MODEL>/{base,link1..link6}.glb 파일 확인'],
  ['모델 변경 시 일시적 빈 화면', 'GLB 비동기 로드 중. 1~2초 후 자동 표시'],
  ['IK가 한계에 걸림', '거리·높이 조정으로 도달 가능 영역 확보. 한계는 데이터시트 working range'],
], { colW: [165, 330] });

sectionTitle('실행 환경');
bullet([
  '브라우저: Chrome/Edge 90+ (importmap, ES modules, WebGL 필요)',
  '서버: 정적 파일 서버면 OK (e.g., node modeling/server.js)',
  'Three.js: 0.160.0 (CDN 로드)',
  'GLTFLoader / STLLoader: three/addons CDN',
]);

note('GitHub Pages 배포 시: index.html이 루트, modeling/ 폴더 함께 푸시. ' +
     'COOP/COEP 헤더는 dev에서만 필요(SharedArrayBuffer 미사용).');

// ============== 마무리 ==============
doc.moveDown(2);
doc.font('Bold').fontSize(11).fillColor(ORANGE).text('-- 매뉴얼 끝 --', { align: 'center' });
doc.moveDown(0.5);
doc.font('Reg').fontSize(8).fillColor(MUTED)
   .text('이 매뉴얼은 시뮬레이터 코드(index.html, modeling/convert.mjs)를 기준으로 자동 생성되었습니다.', { align: 'center' });

doc.end();

// 완료 메시지
doc.on('end', () => console.log(`PDF 생성 완료: ${out}`));
