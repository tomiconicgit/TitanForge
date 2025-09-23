// src/js/export-worker.js — Streamed GLB export with rig + textures (three@0.157)
import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';
import { GLTFExporter } from 'https://unpkg.com/three@0.157.0/examples/jsm/exporters/GLTFExporter.js';

let group = null;
let expected = 0;
let received = 0;
let aborted = false;

// Texture cache (by id sent from main thread)
const texCache = new Map();

function buildTexture(desc) {
  if (!desc) return null;
  const img = texCache.get(desc.id);
  if (!img) return null;

  const t = new THREE.Texture(img);
  t.needsUpdate = true;
  t.flipY = !!desc.flipY;
  t.colorSpace = desc.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;

  if (desc.offset) t.offset.fromArray(desc.offset);
  if (desc.repeat) t.repeat.fromArray(desc.repeat);
  if (typeof desc.rotation === 'number') t.rotation = desc.rotation;
  if (desc.center) t.center.fromArray(desc.center);
  return t;
}

function buildMaterial(md) {
  // Single material descriptor
  const m = new THREE.MeshStandardMaterial({
    name: md.name || 'Material',
    color: new THREE.Color(md.color ?? 0xffffff),
    metalness: (typeof md.metalness === 'number') ? md.metalness : 0.0,
    roughness: (typeof md.roughness === 'number') ? md.roughness : 0.9,
    transparent: !!md.transparent,
    opacity: (typeof md.opacity === 'number') ? md.opacity : 1.0,
    side: md.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    emissive: new THREE.Color(md.emissive ?? 0x000000),
    emissiveIntensity: (typeof md.emissiveIntensity === 'number') ? md.emissiveIntensity : 1.0
  });

  // Maps (if present)
  m.map           = buildTexture(md.maps?.map)           || null;
  m.normalMap     = buildTexture(md.maps?.normalMap)     || null;
  m.roughnessMap  = buildTexture(md.maps?.roughnessMap)  || null;
  m.metalnessMap  = buildTexture(md.maps?.metalnessMap)  || null;
  m.aoMap         = buildTexture(md.maps?.aoMap)         || null;
  m.emissiveMap   = buildTexture(md.maps?.emissiveMap)   || null;

  return m;
}

function attrFrom(desc) {
  if (!desc?.buffer) return null;
  const Ctor = globalThis[desc.arrayType] || Float32Array;
  const arr = new Ctor(desc.buffer); // buffer is a cloned copy from main thread
  return new THREE.BufferAttribute(arr, desc.itemSize, !!desc.normalized);
}

function buildGeometry(gd) {
  const geo = new THREE.BufferGeometry();
  if (gd.attributes) {
    for (const k of Object.keys(gd.attributes)) {
      const a = attrFrom(gd.attributes[k]);
      if (a) geo.setAttribute(k, a);
    }
  }
  if (gd.index?.buffer) {
    const IdxCtor = globalThis[gd.index.arrayType] || Uint32Array;
    const idx = new IdxCtor(gd.index.buffer);
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  if (gd.groups?.length) {
    gd.groups.forEach(g => geo.addGroup(g.start, g.count, g.materialIndex || 0));
  }
  if (gd.boundingBox) {
    geo.boundingBox = new THREE.Box3(
      new THREE.Vector3().fromArray(gd.boundingBox.min),
      new THREE.Vector3().fromArray(gd.boundingBox.max)
    );
  }
  return geo;
}

function rebuildBones(skel) {
  const bones = skel.bones.map(b => {
    const bone = new THREE.Bone();
    bone.name = b.name || '';
    bone.matrix.fromArray(b.localMatrix);
    bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);
    return bone;
  });
  skel.bones.forEach((b, i) => {
    if (b.parentIndex !== -1 && bones[b.parentIndex]) bones[b.parentIndex].add(bones[i]);
  });
  const rootIndex = skel.bones.findIndex(b => b.parentIndex === -1);
  return { bones, root: bones[rootIndex >= 0 ? rootIndex : 0] };
}

function addMesh(msg) {
  // Register any incoming textures first
  if (msg.attachments?.length) {
    for (const a of msg.attachments) {
      // a: { id, bitmap }
      texCache.set(a.id, a.bitmap);
    }
  }

  const p = msg.payload;
  const geom = buildGeometry(p.geometry);

  let material;
  if (Array.isArray(p.material)) {
    material = p.material.map(buildMaterial);
  } else {
    material = buildMaterial(p.material);
  }

  let obj;
  if (p.type === 'SkinnedMesh') {
    const { bones, root } = rebuildBones(p.skeleton);
    const boneInverses = (p.skeleton.boneInverses || []).map(m => new THREE.Matrix4().fromArray(m));
    const skeleton = new THREE.Skeleton(bones, boneInverses.length ? boneInverses : undefined);

    obj = new THREE.SkinnedMesh(geom, material);
    obj.add(root);
    if (p.skeleton.bindMatrix) {
      obj.bind(skeleton, new THREE.Matrix4().fromArray(p.skeleton.bindMatrix));
    } else {
      obj.bind(skeleton);
    }
  } else {
    obj = new THREE.Mesh(geom, material);
  }

  obj.name = p.name || '';
  if (p.matrixWorld?.length === 16) {
    obj.matrix.fromArray(p.matrixWorld);
    obj.matrixAutoUpdate = false;
  }

  group.add(obj);
}

self.onmessage = (e) => {
  const { type } = e.data || {};

  if (type === 'begin') {
    aborted = false; received = 0; expected = e.data.count || 0;
    group = new THREE.Group();
    self.postMessage({ type: 'ready' });
    return;
  }

  if (type === 'mesh') {
    if (aborted || !group) return;
    try {
      addMesh(e.data);
      received++;
      if (received % 6 === 0 || received === expected) {
        self.postMessage({ type: 'mesh:ok', received, total: expected });
      }
    } catch (err) {
      self.postMessage({ type: 'error', message: 'Add mesh failed: ' + (err?.message || err) });
    }
    return;
  }

  if (type === 'export') {
    if (aborted || !group) {
      self.postMessage({ type: 'error', message: 'Nothing to export.' });
      return;
    }
    try {
      const exporter = new GLTFExporter();
      exporter.parse(
        group,
        (glb) => {
          self.postMessage({ type: 'done', glb }, [glb]); // transfer
          group = null;
          texCache.clear();
        },
        (err) => {
          self.postMessage({ type: 'error', message: 'GLTFExporter failed: ' + (err?.message || err) });
          group = null;
          texCache.clear();
        },
        { binary: true }
      );
    } catch (err) {
      self.postMessage({ type: 'error', message: err?.message || String(err) });
      group = null;
      texCache.clear();
    }
    return;
  }

  if (type === 'abort') {
    aborted = true;
    group = null;
    texCache.clear();
    self.postMessage({ type: 'aborted' });
  }
};