"""
Blender Python 스크립트 — LINK STEP → GLB 일괄 변환.

전제 조건:
  - Blender 4.2+ 설치
  - STEP 임포트 애드온 활성화 (예: "STEPper", "Free CAD STEP import")

사용:
  blender --background --python modeling/convert.py -- modeling/IRB2600

위 명령은 modeling/IRB2600/ 폴더의 *_BASE_CAD_*.STEP, *_LINK[1-6]_CAD_*.STEP 을
같은 폴더에 base.glb, link1.glb ~ link6.glb 으로 저장합니다.
"""
import bpy
import os
import sys
import re

# 인자 파싱: blender --python script.py -- <input_dir>
argv = sys.argv
if "--" in argv:
    argv = argv[argv.index("--") + 1:]
else:
    argv = []
target_dir = argv[0] if argv else "."
target_dir = os.path.abspath(target_dir)

NAME_MAP = {
    r"_BASE_CAD_": "base.glb",
    r"_LINK1_CAD_": "link1.glb",
    r"_LINK2_CAD_": "link2.glb",
    r"_LINK3_CAD_": "link3.glb",
    r"_LINK4_CAD_": "link4.glb",
    r"_LINK5_CAD_": "link5.glb",
    r"_LINK6_CAD_": "link6.glb",
}

def find_step_files(folder):
    out = []
    for f in os.listdir(folder):
        if not f.upper().endswith(".STEP"):
            continue
        for pat, glb in NAME_MAP.items():
            if re.search(pat, f, re.IGNORECASE):
                out.append((os.path.join(folder, f), os.path.join(folder, glb)))
                break
    return out

def import_step(path):
    # 다양한 STEP 임포트 애드온 시도
    if hasattr(bpy.ops, "import_step"):
        bpy.ops.import_step.step(filepath=path)
        return True
    if hasattr(bpy.ops.import_mesh, "step"):
        bpy.ops.import_mesh.step(filepath=path)
        return True
    if hasattr(bpy.ops.wm, "step_import"):
        bpy.ops.wm.step_import(filepath=path)
        return True
    raise RuntimeError("STEP 임포트 애드온이 없습니다. STEPper 또는 Free CAD STEP import를 활성화하세요.")

def main():
    files = find_step_files(target_dir)
    if not files:
        print(f"[!] {target_dir} 에서 LINK/BASE STEP 파일을 찾지 못함")
        return
    print(f"[+] {len(files)} 개 변환 예정")
    for src, dst in files:
        print(f"  {os.path.basename(src)} -> {os.path.basename(dst)}")
        bpy.ops.wm.read_factory_settings(use_empty=True)
        try:
            import_step(src)
        except Exception as e:
            print(f"    임포트 실패: {e}")
            continue
        # 단위 m, 모든 객체 선택
        bpy.ops.object.select_all(action="SELECT")
        # GLB export (Y-up = Three.js 기본)
        bpy.ops.export_scene.gltf(
            filepath=dst,
            export_format="GLB",
            export_apply=True,
            export_yup=True,
        )
    print("[+] 완료")

if __name__ == "__main__":
    main()
