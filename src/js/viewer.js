// src/js/viewer.js
// Top-half 3D viewer (50vh), dark studio environment, well-lit from all sides.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

(function () {
  const Task = {
    start: (id, label) => window.Debug?.task?.start?.(id, label),
    done:  (id, note)  => window.Debug?.task?.done?.(id, note),
    fail:  (id, err)   => window.Debug?.task?.fail?.(id, err),
    log:   (msg)       => window.Debug?.log?.(msg)
  };

  let renderer, scene, camera, controls, container, floor;

  // Inject minimal CSS for the viewer container
  const style = document.createElement('style');
  style.textContent = `
    #viewer3d {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 50vh;          /* exactly half the viewport height */
      touch-action: none;
      z-index: 1;
    }
    #viewer3d canvas { display:block; width:100%; height:100%; }
  `;
  document.head.appendChild(style);

  function makeContainer() {
    container = document.getElementById('viewer3d');
    if (!container) {
      container = document.createElement('div');
      container.id = 'viewer3d';
      document.getElementById('app')?.appendChild(container);
    }
    return container;
  }

  function initThree() {
    // Scene
    scene = new THREE.Scene();

    // Environment - A large sphere to act as a studio room
    const roomGeo = new THREE.SphereGeometry(100, 64, 32);
    const roomMat = new THREE.MeshStandardMaterial({
      color: 0x08080a, // Very dark grey
      side: THREE.BackSide,
      metalness: 0.1
    });
    const room = new THREE.Mesh(roomGeo, roomMat);
    scene.add(room);

    // Camera
    camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
    camera.position.set(3.5, 2.2, 5.5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    resize(); // set initial size/aspect
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    container.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 1.2;
    controls.maxDistance = 12;

    // Lighting — hemisphere + gentle three-point rig (UNCHANGED)
    const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x1a2530, 0.8);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(5, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 3;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xbfd6ff, 0.7);
    fill.position.set(-6, 5, -4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffe0bf, 0.5);
    rim.position.set(-4, 6, 8);
    scene.add(rim);

    // Floor with a visible, dark material
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a, // Dark grey, slightly lighter than room
        metalness: 0.2,
        roughness: 0.7
    });
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // Warmup log
    Task.log('Viewer lighting rig initialised (hemi + 3x dir)');
  }

  function resize() {
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  let rafId = 0;
  function animate() {
    rafId = requestAnimationFrame(animate);
    controls?.update();
    renderer?.render(scene, camera);
  }

  function startRendering() {
    stopRendering();
    animate();
  }

  function stopRendering() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function wireGlobals() {
    // Window resize + director bus resize
    window.addEventListener('resize', resize);
    window.App?.on?.('app:resize', resize);

    // Reduce work when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopRendering();
      else startRendering();
    }, { passive: true });
  }

  async function bootstrap() {
    Task.start('viewer', 'Initialising 3D viewer');
    try {
      makeContainer();
      initThree();
      wireGlobals();
      startRendering();

      // Expose a tiny API for later modules (e.g., loaders)
      window.Viewer = {
        get scene() { return scene; },
        get camera() { return camera; },
        get renderer() { return renderer; },
        get controls() { return controls; },
        container,
        add(object) { scene.add(object); return object; },
        remove(object) { scene.remove(object); },
        resize
      };

      Task.done('viewer', 'Viewer ready (50vh)');
      window.App?.emit?.('viewer:ready', { containerId: 'viewer3d' });
    } catch (e) {
      Task.fail('viewer', e);
      throw e;
    }
  }

  // Logic to initialize the viewer once the main app is ready.
  const initViewer = () => {
    // A simple guard to prevent the viewer from ever initializing more than once.
    // It checks if the `window.Viewer` API, created inside bootstrap, already exists.
    if (window.Viewer) return;
    bootstrap();
  };

  // If the app director has already booted by the time this script runs,
  // we should initialize the viewer immediately.
  if (window.App && window.App.glVersion) {
    initViewer();
  }
  // Otherwise, we listen on the App's private event bus for the 'app:booted'
  // signal to start. The `App.on` method is the correct way to do this.
  else {
    window.App?.on('app:booted', initViewer);
  }
})();
