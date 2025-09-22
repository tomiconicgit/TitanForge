// navigation.js - Main UI navigation bar

(function () {
    'use strict';

    // --- Private state ---
    let container;
    const bus = new EventTarget(); // Private event bus for this module

    // --- DOM & CSS Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-nav {
                position: fixed;
                top: 50vh; /* Positioned right below the 50vh viewer */
                left: 0;
                right: 0;
                height: 54px;
                background: rgba(22, 26, 33, 0.8); /* Dark, semi-transparent */
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                justify-content: space-around;
                align-items: center;
                padding: 0 10px;
                box-sizing: border-box;
                z-index: 10;
            }
            .tf-nav-btn {
                background: none;
                border: none;
                color: #a0a7b0; /* Muted text color */
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 15px;
                font-weight: 500;
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                transition: color 0.2s ease, background-color 0.2s ease;
            }
            .tf-nav-btn:hover {
                color: #ffffff;
            }
            .tf-nav-btn.active {
                color: #ffffff;
                background-color: rgba(255, 255, 255, 0.1);
            }
        `;
        document.head.appendChild(style);

        container = document.createElement('nav');
        container.id = 'tf-nav';
        container.innerHTML = `
            <button class="tf-nav-btn active" data-tab="transform">Transform</button>
            <button class="tf-nav-btn" data-tab="meshes">Meshes</button>
            <button class="tf-nav-btn" data-tab="textures">Textures</button>
            <button class="tf-nav-btn" data-tab="tabs">Tabs</button>
        `;
        document.getElementById('app')?.appendChild(container);
    }

    // --- Event Handling ---
    function handleNavClick(event) {
        const target = event.target;
        if (!target.matches('.tf-nav-btn')) return;

        // Remove active class from all buttons
        container.querySelectorAll('.tf-nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to the clicked button
        target.classList.add('active');
        
        const tabId = target.dataset.tab;
        
        // Emit an event that other modules can listen to
        bus.dispatchEvent(new CustomEvent('change', { detail: { tab: tabId } }));
    }

    function wireEvents() {
        container.addEventListener('click', handleNavClick);
    }

    // --- Public API & Initialization ---
    function bootstrap() {
        if (window.Navigation) return; // Guard against double-init

        injectUI();
        wireEvents();

        window.Navigation = {
            on: (type, fn) => bus.addEventListener(type, fn),
        };

        window.App?.emit('navigation:ready');
        window.Debug?.log('Navigation UI ready.');
    }

    // Wait for the main app to be booted before initializing
    if (window.App?.glVersion) {
        bootstrap();
    } else {
        window.App?.on('app:booted', bootstrap);
    }

})();
