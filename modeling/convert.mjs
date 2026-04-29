// STEP → GLB 자동 변환 (Node.js, occt-import-js + gltf-transform)
// 사용: node modeling/convert.mjs modeling/IRB2600
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import occtImportJs from 'occt-import-js';
import { Document, NodeIO } from '@gltf-transform/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// LINK 명명 규칙은 ABB 모델별로 다름 — `_LINK1_CAD_` 또는 `_LINK01_CAD_` 모두 매칭
const NAME_MAP = [
  [/_BASE_CAD/i,        'base.glb'],
  [/_LINK0?1_CAD/i,     'link1.glb'],
  [/_LINK0?2_CAD/i,     'link2.glb'],
  [/_LINK0?3_CAD/i,     'link3.glb'],
  [/_LINK0?4_CAD/i,     'link4.glb'],
  [/_LINK0?5_CAD/i,     'link5.glb'],
  [/_LINK0?6_CAD/i,     'link6.glb'],
];

function findFiles(dir) {
  const entries = fs.readdirSync(dir);
  const out = [];
  for (const f of entries) {
    if (!/\.step$/i.test(f)) continue;
    for (const [pat, glb] of NAME_MAP) {
      if (pat.test(f)) {
        out.push({ src: path.join(dir, f), dst: path.join(dir, glb) });
        break;
      }
    }
  }
  return out;
}

async function convertOne(occt, srcPath, dstPath) {
  const buf = fs.readFileSync(srcPath);
  const result = occt.ReadStepFile(new Uint8Array(buf), null);
  if (!result.success || !result.meshes || result.meshes.length === 0) {
    throw new Error('STEP 파싱 실패 또는 메쉬 없음');
  }
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  for (let i = 0; i < result.meshes.length; i++) {
    const m = result.meshes[i];
    // m.attributes.position.array = Float32Array of vertex coords (mm by default)
    // m.index.array = Uint32Array of triangle indices
    const srcPos = m.attributes.position.array;
    const positions = new Float32Array(srcPos.length);
    // mm → m 변환 + CAD Z-up → Three.js Y-up 변환 (Rx(-π/2): (x,y,z) → (x, z, -y))
    for (let j = 0; j < srcPos.length; j += 3) {
      positions[j]     =  srcPos[j]   / 1000;          // x → x
      positions[j + 1] =  srcPos[j+2] / 1000;          // z → y (height)
      positions[j + 2] = -srcPos[j+1] / 1000;          // -y → z
    }
    const indices = new Uint32Array(m.index.array);
    let normals = null;
    if (m.attributes.normal) {
      const srcN = m.attributes.normal.array;
      normals = new Float32Array(srcN.length);
      for (let j = 0; j < srcN.length; j += 3) {
        normals[j]     =  srcN[j];
        normals[j + 1] =  srcN[j+2];
        normals[j + 2] = -srcN[j+1];
      }
    }

    const posAcc = doc.createAccessor()
      .setType('VEC3')
      .setArray(positions)
      .setBuffer(buffer);
    const idxAcc = doc.createAccessor()
      .setType('SCALAR')
      .setArray(indices)
      .setBuffer(buffer);
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', posAcc)
      .setIndices(idxAcc);
    if (normals) {
      const nAcc = doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer);
      prim.setAttribute('NORMAL', nAcc);
    }
    // 머터리얼 — ABB Orange (Pantone 158C, 약 #FF6B1F)
    const mat = doc.createMaterial(`mat_${i}`)
      .setBaseColorFactor([1.0, 0.42, 0.12, 1.0])
      .setMetallicFactor(0.2)
      .setRoughnessFactor(0.55);
    prim.setMaterial(mat);
    const mesh = doc.createMesh().addPrimitive(prim);
    const node = doc.createNode(`mesh_${i}`).setMesh(mesh);
    scene.addChild(node);
  }
  const io = new NodeIO();
  await io.write(dstPath, doc);
}

async function main() {
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  if (!fs.existsSync(dir)) {
    console.error(`[!] 폴더 없음: ${dir}`);
    process.exit(1);
  }
  const files = findFiles(dir);
  if (!files.length) {
    console.error(`[!] LINK/BASE STEP 파일을 찾지 못함: ${dir}`);
    process.exit(1);
  }
  console.log(`[+] ${dir} 에서 ${files.length}개 변환 시작`);
  const occt = await occtImportJs();
  for (const { src, dst } of files) {
    try {
      console.log(`  ${path.basename(src)} → ${path.basename(dst)}`);
      await convertOne(occt, src, dst);
    } catch (e) {
      console.error(`    실패: ${e.message}`);
    }
  }
  console.log('[+] 완료');
}

main().catch(e => { console.error(e); process.exit(1); });
