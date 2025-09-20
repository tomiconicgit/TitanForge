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

    const assetsToLoad = [
        'main.js'
    ];
    
    let loadedCount = 0;
    const totalAssets = assetsToLoad.length;

    logProcess('Starting asset loading...');

    const loadAsset = (url) => {
        return new Promise((resolve, reject) => {
            logProcess(`Loading ${url}...`);
            const script = document.createElement('script');
            script.src = url;
            script.type = 'module';
            script.onload = () => {
                loadedCount++;
                const progress = (loadedCount / totalAssets) * 100;
                loadingProgress.style.width = `${progress}%`;
                logProcess(`Successfully loaded ${url}.`);
                resolve();
            };
            script.onerror = () => {
                logProcess(`Failed to load ${url}.`, 'error');
                reject(new Error(`Failed to load ${url}`));
            };
            document.head.appendChild(script);
        });
    };

    Promise.all(assetsToLoad.map(loadAsset))
        .then(() => {
            loadingText.textContent = "All files loaded. Initializing...";
            logProcess("All dependencies loaded. Importing main application.");

            return import('./main.js');
        })
        .then(() => {
            logProcess("Main application initialized.");
            loadingText.textContent = "TitanForge is ready!";
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                loadingScreen.style.pointerEvents = 'none';
            }, 500);
        })
        .catch(err => {
            logProcess(`Fatal error: ${err.message}`);
            loadingText.textContent = "An error occurred during startup.";
            console.error(err);
        });
});
