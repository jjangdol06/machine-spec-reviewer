# 로봇 GLB 모델 적용 가이드

시뮬레이터는 `modeling/<MODEL>/` 폴더에서 GLB 파일을 자동 로드합니다.

## 폴더 구조

```
modeling/
├── IRB2600/  ← STEP 파일 추출 완료
│   ├── *_BASE_CAD_*.STEP   → base.glb 으로 변환·저장
│   ├── *_LINK1_CAD_*.STEP  → link1.glb
│   ├── *_LINK2_CAD_*.STEP  → link2.glb
│   ├── *_LINK3_CAD_*.STEP  → link3.glb
│   ├── *_LINK4_CAD_*.STEP  → link4.glb
│   ├── *_LINK5_CAD_*.STEP  → link5.glb
│   └── *_LINK6_CAD_*.STEP  → link6.glb
├── IRB6700/  ← 동일
├── IRB7600/  ← 동일
└── IRB4600/  ← 별도 다운로드 필요 (현재 폴더 비어 있음)
```

`base.glb`, `link1.glb` ~ `link6.glb` 7개 파일이 핵심.
CABLES, WORKING-SPACE는 변환하지 않아도 됨.

## 변환 방법

### 옵션 1: CAD Assistant (권장, 무료, GUI)

1. https://www.opencascade.com/products/cad-assistant 다운로드
2. 각 LINK STEP 파일을 열기 (예: `IRB2600-..._LINK1_CAD_*.STEP`)
3. **File → Save As → Format: glTF Binary (.glb)** 로 저장
4. 파일명을 위 표대로 (`base.glb`, `link1.glb` 등) 지정
5. 저장 위치: `modeling/<MODEL>/` 폴더 안

### 옵션 2: Blender (STEP 애드온 필요)

Blender 4.2+ 에 "STEPper" 또는 "Free CAD" STEP 애드온 설치 후
`convert.py` 스크립트 실행:

```bash
blender --background --python modeling/convert.py -- modeling/IRB2600
```

### 옵션 3: 온라인 변환

- https://imagetostl.com/convert/file/step/to/glb
- https://anyconv.com/step-to-glb-converter/

각 LINK 파일을 업로드 → GLB 다운로드 → 폴더에 저장.

## 단위 (mm vs m)

- 변환 시 **단위를 m(meter)로 export** 권장. CAD 원본은 mm지만 시뮬레이터는 m 단위 사용.
- CAD Assistant → glTF export 시 단위 옵션 확인.
- 변환된 GLB가 비정상적으로 크면 (1000배), 다시 export 시 mm→m 스케일 적용.

## 좌표 원점

- 각 LINK는 **자기 조인트 회전축이 원점(0,0,0)에 오도록** export.
- ABB 공식 LINK CAD 파일은 보통 이 컨벤션을 따르므로 추가 작업 불필요.
- 만약 위치가 이상하게 보이면 Blender에서 `Object → Set Origin → Origin to 3D Cursor` 로 조정 후 재 export.

## 적용 확인

GLB 파일을 폴더에 넣고 시뮬레이터 새로고침 (`Ctrl+R`).
- 파일이 있으면 → 파라메트릭 메쉬가 숨겨지고 실제 GLB 모델 표시.
- 토글: 패널 우측 "표시 옵션 → 실제 모델(GLB) 사용" 체크박스로 온/오프 가능.
- 파일이 없으면 → 기존 파라메트릭 모델 그대로.

## IRB4600 관련

현재 modeling/ 폴더의 `660 OmniCore...step` 파일은 컨트롤러 캐비닛 CAD 이지
로봇 본체가 아닙니다. ABB Library에서 `IRB4600 IRC5 STEP` 으로 별도 다운로드 필요.
