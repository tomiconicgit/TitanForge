// loading.js
document.addEventListener('DOMContentLoaded', () => {
    const loadingScreen = document.getElementById('loading-screen');
    const loadingProgress = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');
    const processLog = document.getElementById('process-log');

    const logProcess = (message) => {
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        processLog.appendChild(line);
        processLog.scrollTop = processLog.scrollHeight;
    };

    logProcess('Starting asset loading...');

    let progress = 0;
    const assetsToLoad = ['main.js'];
    const totalAssets = assetsToLoad.length;
    
    const loadingInterval = setInterval(() => {
        progress += 5;
        loadingProgress.style.width = `${progress}%`;
        if (progress >= 100) {
            clearInterval(loadingInterval);
            loadingText.textContent = "All core assets loaded. Initializing...";
            
            import('./main.js')
                .then(() => {
                    logProcess("Main application initialized.");
                    loadingText.textContent = "TitanForge is ready!";
                    setTimeout(() => {
                        loadingScreen.classList.add('fade-out');
                        loadingScreen.addEventListener('animationend', () => {
                            loadingScreen.style.display = 'none';
                            loadingScreen.style.pointerEvents = 'none';
                        }, { once: true });
                    }, 1000);
                })
                .catch(err => {
                    logProcess(`Fatal error: ${err.message}`, 'error');
                    loadingText.textContent = "An error occurred during startup.";
                    console.error(err);
                });
        }
    }, 150);
});
