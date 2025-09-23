// src/js/export-worker.js - Runs the GLTF export process in the background.

// UPDATED: Use full CDN paths for imports to work correctly inside a worker module.
import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';
import { GLTFExporter } from 'https://unpkg.com/three@0.157.0/examples/jsm/exporters/GLTFExporter.js';

self.onmessage = (event) => {
  const { modelJson } = event.data;

  if (!modelJson) {
    self.postMessage({ error: 'No model data received.' });
    return;
  }

  try {
    // 1. Rebuild the Three.js object from the JSON data sent from the main thread.
    const loader = new THREE.ObjectLoader();
    const objectToExport = loader.parse(modelJson);
    
    // 2. Replicate the model preparation logic:
    // Create a temporary scene to bake the object's final world transform.
    const tempScene = new THREE.Scene();
    const clone = objectToExport.clone();

    // The object's world matrix is already applied during serialization,
    // so we just need to reset the clone's local transform for a clean export.
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.set(1, 1, 1);
    
    tempScene.add(clone);

    // 3. Run the exporter. This is the heavy, blocking part.
    const exporter = new GLTFExporter();
    exporter.parse(
      tempScene,
      (glb) => {
        // 4. Success: Send the result (an ArrayBuffer) back to the main thread.
        // The second argument is a "Transferable" list, which moves memory
        // instead of copying it, making it extremely fast.
        self.postMessage({ glb }, [glb]);
      },
      (error) => {
        // Handle errors from the exporter itself.
        self.postMessage({ error: 'GLTFExporter failed during parse.' });
      },
      { binary: true } // Export as a binary .glb file
    );

  } catch (e) {
    // Handle any other errors during the process (e.g., parsing the JSON).
    self.postMessage({ error: e.message });
  }
};
