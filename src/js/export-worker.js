// Import the necessary Three.js components inside the worker
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

self.onmessage = (event) => {
    const sceneJson = event.data;

    if (!sceneJson) {
        // Handle potential errors
        self.postMessage({ error: 'No scene data received.' });
        return;
    }

    // 1. Deserialize the JSON back into a THREE.Scene
    const loader = new THREE.ObjectLoader();
    const scene = loader.parse(sceneJson);

    // 2. Run the GLTFExporter
    const exporter = new GLTFExporter();
    exporter.parse(
        scene,
        (glb) => {
            // 3. Success: Send the binary data (GLB) back to the main thread
            // The second argument is a list of "Transferable" objects to move memory, not copy.
            self.postMessage({ glb }, [glb]);
        },
        (error) => {
            // 4. Error: Send an error message back
            self.postMessage({ error: 'Export failed within the worker.' });
        },
        { binary: true }
    );
};
