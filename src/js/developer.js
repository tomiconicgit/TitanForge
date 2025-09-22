// src/js/developer.js - A temporary tool for visually positioning UI elements.

(function () {
    'use strict';

    let panel, devButton, targetElement, copyButton, outputPre;
    let topSlider, leftSlider, bottomSlider, rightSlider;
    let topValue, leftValue, bottomValue, rightValue;

    const elementsToControl = {
        '-- Select Element --': null,
        'Rig Toggle': '#tf-rig-toggle',
        'Menu Button': '#tf-menu-container'
    };

    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-dev-button {
                position: fixed; top: 16px; right: 16px; z-index: 1000;
                background: #ff9800; color: black; font-weight: 600;
                border: none; border-radius: 20px; padding: 10px 15px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3); cursor: pointer;
            }
            #tf-dev-panel {
                position: fixed; left:0; right:0; bottom:0; height: 50vh;
                background: rgba(30,30,35,0.95); backdrop-filter: blur(10px);
                border-top: 1px solid rgba(255,255,255,0.1); z-index: 999;
                display: none; flex-direction: column; padding: 20px; gap: 15px;
                color: #fff; font-family: sans-serif;
            }
            #tf-dev-panel.show { display: flex; }
            #tf-dev-panel .dev-header { display: flex; justify-content: space-between; align-items: center; }
            #tf-dev-panel .dev-close { font-size: 24px; cursor: pointer; }
            #tf-dev-panel select, #tf-dev-panel button {
                padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid #555;
                color: #fff; border-radius: 5px;
            }
            #tf-dev-panel .slider-group { display: flex; flex-direction: column; gap: 5px; }
            #tf-dev-panel .slider-group label { font-size: 14px; color: #aaa; }
            #tf-dev-panel input[type=range] { width: 100%; }
            #tf-dev-panel pre { background: #111; padding: 10px; border-radius: 5px; font-family: monospace; }
        `;
        document.head.appendChild(style);

        devButton = document.createElement('button');
        devButton.id = 'tf-dev-button';
        devButton.textContent = 'Dev';
        document.body.appendChild(devButton);

        panel = document.createElement('div');
        panel.id = 'tf-dev-panel';
        const selectOptions = Object.keys(elementsToControl)
            .map(name => `<option value="${elementsToControl[name]}">${name}</option>`).join('');

        panel.innerHTML = `
            <div class="dev-header">
                <h3>UI Positioner</h3>
                <span class="dev-close">&times;</span>
            </div>
            <select id="dev-element-select">${selectOptions}</select>
            <div class="slider-group">
                <label>Bottom: <span id="dev-val-bottom">0px</span></label>
                <input type="range" id="dev-slider-bottom" min="0" max="1000" value="0">
            </div>
            <div class="slider-group">
                <label>Left: <span id="dev-val-left">0px</span></label>
                <input type="range" id="dev-slider-left" min="0" max="1000" value="0">
            </div>
            <pre id="dev-output-css">bottom: 0px;\nleft: 0px;</pre>
            <button id="dev-copy-css">Copy CSS</button>
        `;
        document.getElementById('app')?.appendChild(panel);

        // Assign element references
        copyButton = panel.querySelector('#dev-copy-css');
        outputPre = panel.querySelector('#dev-output-css');
        bottomSlider = panel.querySelector('#dev-slider-bottom');
        leftSlider = panel.querySelector('#dev-slider-left');
        bottomValue = panel.querySelector('#dev-val-bottom');
        leftValue = panel.querySelector('#dev-val-left');
    }

    // --- Core Logic ---
    function updateTargetElement(selector) {
        if (!selector || selector === 'null') {
            targetElement = null;
            return;
        }
        targetElement = document.querySelector(selector);
        if (targetElement) {
            const style = window.getComputedStyle(targetElement);
            const bottom = parseInt(style.bottom, 10);
            const left = parseInt(style.left, 10);
            
            bottomSlider.value = bottom;
            leftSlider.value = left;
            bottomValue.textContent = `${bottom}px`;
            leftValue.textContent = `${left}px`;
            updateCopyOutput();
        }
    }

    function applyStyles() {
        if (!targetElement) return;
        const bottom = `${bottomSlider.value}px`;
        const left = `${leftSlider.value}px`;

        targetElement.style.bottom = bottom;
        targetElement.style.left = left;
        targetElement.style.top = 'auto';
        targetElement.style.right = 'auto';
        targetElement.style.transform = 'none'; // Override transform for precise positioning

        bottomValue.textContent = bottom;
        leftValue.textContent = left;
        updateCopyOutput();
    }

    function updateCopyOutput() {
        if (!targetElement) {
            outputPre.textContent = 'Select an element to position.';
            return;
        }
        outputPre.textContent = `bottom: ${bottomSlider.value}px;\nleft: ${leftSlider.value}px;`;
    }

    // --- Event Handlers ---
    function wireEvents() {
        devButton.addEventListener('click', () => panel.classList.toggle('show'));
        panel.querySelector('.dev-close').addEventListener('click', () => panel.classList.remove('show'));
        panel.querySelector('#dev-element-select').addEventListener('change', (e) => updateTargetElement(e.target.value));
        
        bottomSlider.addEventListener('input', applyStyles);
        leftSlider.addEventListener('input', applyStyles);

        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(outputPre.textContent).then(() => {
                copyButton.textContent = 'Copied!';
                setTimeout(() => { copyButton.textContent = 'Copy CSS'; }, 1500);
            });
        });
    }

    // --- Bootstrap ---
    function bootstrap() {
        if (window.Developer) return;
        injectUI();
        wireEvents();
        window.Developer = {};
        window.Debug?.log('Developer tool ready.');
    }

    if (window.App?.glVersion) {
        bootstrap();
    } else {
        window.App?.on('app:booted', bootstrap);
    }

})();
