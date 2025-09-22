// src/js/developer.js - A temporary tool for visually positioning UI elements.

(function () {
    'use strict';

    let panel, devButton, targetElement, targetIsContainer, copyButton, outputPre;
    let bottomSlider, leftSlider, fontSizeSlider, paddingXSlider, paddingYSlider;
    let bottomValue, leftValue, fontSizeValue, paddingXValue, paddingYValue;

    const elementsToControl = {
        '-- Select Element --': null,
        'Rig Toggle': '#tf-rig-toggle',
        'Hide Toggle': '#tf-hide-toggle',
        'Menu Button': '#tf-menu-container' // We target the container for position
    };

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
                position: fixed; top: calc(50vh + 54px); bottom: 0; left: 0; right: 0;
                background: rgba(30,30,35,0.95); backdrop-filter: blur(10px);
                border-top: 1px solid rgba(255,255,255,0.1); z-index: 999;
                display: none; flex-direction: column; padding: 10px 20px; gap: 10px;
                color: #fff; font-family: sans-serif; overflow-y: auto;
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
            #tf-dev-panel pre { background: #111; padding: 10px; border-radius: 5px; font-family: monospace; white-space: pre-wrap; }
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

        // **UPDATED**: Renamed sliders
        panel.innerHTML = `
            <div class="dev-header">
                <h3>UI Positioner</h3>
                <span class="dev-close">&times;</span>
            </div>
            <select id="dev-element-select">${selectOptions}</select>
            <div class="slider-group">
                <label>Font Size: <span id="dev-val-font-size">0px</span></label>
                <input type="range" id="dev-slider-font-size" min="8" max="40" value="15">
            </div>
            <div class="slider-group">
                <label>Padding (Y): <span id="dev-val-padding-y">0px</span></label>
                <input type="range" id="dev-slider-padding-y" min="0" max="50" value="10">
            </div>
            <div class="slider-group">
                <label>Padding (X): <span id="dev-val-padding-x">0px</span></label>
                <input type="range" id="dev-slider-padding-x" min="0" max="50" value="20">
            </div>
             <div class="slider-group">
                <label>Y Position (from bottom): <span id="dev-val-bottom">0px</span></label>
                <input type="range" id="dev-slider-bottom" min="0" max="1000" value="0">
            </div>
            <div class="slider-group">
                <label>X Position (from left): <span id="dev-val-left">0px</span></label>
                <input type="range" id="dev-slider-left" min="0" max="1000" value="0">
            </div>
            <pre id="dev-output-css">Select an element to position.</pre>
            <button id="dev-copy-css">Copy CSS</button>
        `;
        document.getElementById('app')?.appendChild(panel);

        copyButton = panel.querySelector('#dev-copy-css');
        outputPre = panel.querySelector('#dev-output-css');
        fontSizeSlider = panel.querySelector('#dev-slider-font-size');
        paddingXSlider = panel.querySelector('#dev-slider-padding-x');
        paddingYSlider = panel.querySelector('#dev-slider-padding-y');
        bottomSlider = panel.querySelector('#dev-slider-bottom');
        leftSlider = panel.querySelector('#dev-slider-left');
        fontSizeValue = panel.querySelector('#dev-val-font-size');
        paddingXValue = panel.querySelector('#dev-val-padding-x');
        paddingYValue = panel.querySelector('#dev-val-padding-y');
        bottomValue = panel.querySelector('#dev-val-bottom');
        leftValue = panel.querySelector('#dev-val-left');
    }

    function getStyleTarget(mainTarget) {
        // **FIXED**: Logic to get the correct element for STYLING vs POSITIONING
        // For the Menu, we position the container but style the button inside.
        if (mainTarget && mainTarget.id === 'tf-menu-container') {
            return mainTarget.querySelector('#tf-menu-button');
        }
        // For the toggles, the container is positioned but the text label is styled.
        if (mainTarget && (mainTarget.id === 'tf-rig-toggle' || mainTarget.id === 'tf-hide-toggle')) {
            return mainTarget.querySelector('label:first-child');
        }
        return mainTarget;
    }

    function updateTargetElement(selector) {
        targetIsContainer = false;
        if (!selector || selector === 'null') {
            targetElement = null;
            updateCopyOutput();
            return;
        }
        targetElement = document.querySelector(selector);
        
        if (targetElement) {
            const styleTarget = getStyleTarget(targetElement) || targetElement;
            const posStyle = window.getComputedStyle(targetElement); // for position
            const style = window.getComputedStyle(styleTarget);    // for style
            
            const fontSize = parseInt(style.fontSize, 10);
            const paddingY = parseInt(style.paddingTop, 10);
            const paddingX = parseInt(style.paddingLeft, 10);
            const bottom = parseInt(posStyle.bottom, 10);
            const left = parseInt(posStyle.left, 10);
            
            fontSizeSlider.value = isNaN(fontSize) ? 14 : fontSize;
            paddingYSlider.value = isNaN(paddingY) ? 10 : paddingY;
            paddingXSlider.value = isNaN(paddingX) ? 20 : paddingX;
            bottomSlider.value = isNaN(bottom) ? 0 : bottom;
            leftSlider.value = isNaN(left) ? 0 : left;
            
            applyStyles(); // Sync UI
        }
    }

    function applyStyles() {
        if (!targetElement) return;

        const styleTarget = getStyleTarget(targetElement) || targetElement;

        const fontSize = `${fontSizeSlider.value}px`;
        const padding = `${paddingYSlider.value}px ${paddingXSlider.value}px`;
        const bottom = `${bottomSlider.value}px`;
        const left = `${leftSlider.value}px`;

        // Apply styles to the appropriate element
        styleTarget.style.fontSize = fontSize;
        if(styleTarget.style.padding !== undefined) styleTarget.style.padding = padding;

        targetElement.style.bottom = bottom;
        targetElement.style.left = left;
        targetElement.style.top = 'auto';
        targetElement.style.right = 'auto';
        
        // Update text values
        fontSizeValue.textContent = fontSize;
        paddingYValue.textContent = `${paddingYSlider.value}px`;
        paddingXValue.textContent = `${paddingXSlider.value}px`;
        bottomValue.textContent = bottom;
        leftValue.textContent = left;
        updateCopyOutput();
    }

    function updateCopyOutput() {
        if (!targetElement) {
            outputPre.textContent = 'Select an element to position.';
            return;
        }
        const styleTarget = getStyleTarget(targetElement) || targetElement;

        let output = `/* For ${targetElement.id} */\n`;
        output += `bottom: ${bottomSlider.value}px;\nleft: ${leftSlider.value}px;\n`;
        output += `\n/* For ${styleTarget.id || 'inner element'} */\n`;
        output += `font-size: ${fontSizeSlider.value}px;\npadding: ${paddingYSlider.value}px ${paddingXSlider.value}px;`;

        outputPre.textContent = output;
    }

    function wireEvents() {
        devButton.addEventListener('click', () => panel.classList.toggle('show'));
        panel.querySelector('.dev-close').addEventListener('click', () => panel.classList.remove('show'));
        panel.querySelector('#dev-element-select').addEventListener('change', (e) => updateTargetElement(e.target.value));
        
        fontSizeSlider.addEventListener('input', applyStyles);
        paddingXSlider.addEventListener('input', applyStyles);
        paddingYSlider.addEventListener('input', applyStyles);
        bottomSlider.addEventListener('input', applyStyles);
        leftSlider.addEventListener('input', applyStyles);

        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(outputPre.textContent).then(() => {
                copyButton.textContent = 'Copied!';
                setTimeout(() => { copyButton.textContent = 'Copy CSS'; }, 1500);
            });
        });
    }

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
