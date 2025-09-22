// src/js/animation.js

// ... (keep existing code above this function)

// --- UI Injection ---
function injectUI() {
    const style = document.createElement('style');
    style.textContent = `
        /* --- ADDED: Copied from model.js --- */
        .tf-modal-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.7);
            backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
            z-index: 1000; display: flex; align-items: center; justify-content: center;
            opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
        }
        .tf-modal-overlay.show { opacity: 1; pointer-events: auto; }

        /* --- ADDED: Copied from menu.js --- */
        .tf-load-modal-content {
            display: flex; flex-direction: column; gap: 15px;
            width: min(300px, 80vw);
            padding: 25px;
            background: rgba(28, 32, 38, 0.9); border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .tf-load-modal-content button {
            width: 100%;
            padding: 10px 12px;
            font-size: 15px;
            font-weight: 600;
            border: none;
            border-radius: 5px;
            background-color: rgba(255, 255, 255, 0.1);
            color: #e6eef6;
            cursor: pointer;
            text-align: center;
            transition: background-color 0.2s ease;
        }
        .tf-load-modal-content button:hover {
            background-color: rgba(255, 255, 255, 0.15);
        }
        .tf-load-modal-content button:disabled {
            color: #777;
            cursor: not-allowed;
            background-color: rgba(255, 255, 255, 0.1);
        }

        /* Floating Animation Control Panel - styled like toggles.js */
        #tf-animation-panel {
            position: fixed;
            bottom: 383px; /* Matches toggles.js */
            left: 16px;
            z-index: 24; /* Just below toggles panel */
            min-width: 220px;
            background: rgba(28, 32, 38, 0.9);
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
            padding: 0; /* No padding on container */
            display: none; /* Hidden by default */
            flex-direction: column;
            opacity: 0;
            transform: translateY(10px);
            pointer-events: none;
            transition: opacity 0.2s ease, transform 0.2s ease;
        }
        #tf-animation-panel.show {
            display: flex;
            opacity: 1;
            transform: translateY(0);
            pointer-events: auto;
        }
        #tf-animation-panel .panel-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 8px 12px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            font-size: 14px; font-weight: 600;
        }
        #tf-animation-panel .panel-header .minimize-btn {
            background: none; border: none; color: #a0a7b0;
            font-size: 20px; cursor: pointer; padding: 0 5px;
        }
        #tf-animation-panel .panel-content {
            padding: 12px; display: flex; flex-direction: column; gap: 15px;
        }
        .tf-anim-scrub-controls {
            display: flex; gap: 10px;
        }
        .tf-anim-scrub-controls button {
            flex: 1; background: rgba(255,255,255,0.1); border: none;
            color: #fff; padding: 8px; border-radius: 5px; cursor: pointer;
        }
        #tf-anim-clear-btn {
             background: #c62828; border: none; color: #fff;
             padding: 8px; border-radius: 5px; cursor: pointer; font-weight: 600;
        }

        /* --- ADDED: Self-contained toggle switch styles --- */
        .tf-toggle-row {
            display: flex; align-items: center; justify-content: space-between;
            color: #e6eef6; font-size: 15px;
        }
        .tf-switch {
            position: relative; display: inline-block;
            width: 30px; height: 16px; flex-shrink: 0;
        }
        .tf-switch input { display: none; }
        .tf-slider {
            position: absolute; cursor: pointer; inset: 0;
            background-color: rgba(255,255,255,0.2);
            transition: .4s; border-radius: 16px;
        }
        .tf-slider:before {
            position: absolute; content: "";
            height: 12px; width: 12px;
            left: 2px; bottom: 2px;
            background-color: white;
            transition: .4s; border-radius: 50%;
        }
        input:checked + .tf-slider { background-color: #00c853; }
        input:checked + .tf-slider:before { transform: translateX(14px); }
    `;
    document.head.appendChild(style);

    // 1. Initial Modal (triggered from menu)
    modal = document.createElement('div');
    modal.className = 'tf-modal-overlay';
    modal.innerHTML = `
        <div class="tf-load-modal-content">
            <button id="tf-anim-load-btn">Load Animation</button>
            <button id="tf-anim-show-panel-btn" disabled>Show Panel</button>
        </div>
    `;
    document.body.appendChild(modal);

    // 2. Floating Control Panel
    panel = document.createElement('div');
    panel.id = 'tf-animation-panel';
    panel.innerHTML = `
        <div class="panel-header">
            <span>Animation Controls</span>
            <button class="minimize-btn" title="Minimize">&minus;</button>
        </div>
        <div class="panel-content">
            <div class="tf-toggle-row">
                <label for="anim-loop-checkbox">Loop Animation</label>
                <label class="tf-switch">
                    <input type="checkbox" id="anim-loop-checkbox" checked>
                    <span class="tf-slider"></span>
                </label>
            </div>
            <div class="tf-anim-scrub-controls" style="display:none;">
                <button data-time="-0.5">&laquo; 0.5s</button>
                <button data-time="0.5">0.5s &raquo;</button>
            </div>
            <button id="tf-anim-clear-btn">Clear Animation</button>
        </div>
    `;
    document.getElementById('app')?.appendChild(panel);

    // 3. Hidden File Input
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.glb';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // --- Element References ---
    showPanelBtn = modal.querySelector('#tf-anim-show-panel-btn');
    loadAnimBtn = modal.querySelector('#tf-anim-load-btn');
    loopToggle = panel.querySelector('#anim-loop-checkbox');
    timeScrubContainer = panel.querySelector('.tf-anim-scrub-controls');
}

// ... (keep existing code below this function)
