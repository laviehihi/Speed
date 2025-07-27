document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("toggleBtn");

    function updateUI(isRunning) {
        toggleBtn.textContent = isRunning ? "Pause" : "Start";
    }

    function sendSpeedConfig(isRunning) {
        const config = {
            command: "setSpeedConfig",
            config: {
                speed: isRunning ? 5 : 1,
                cbSetIntervalChecked: true,
                cbSetTimeoutChecked: true,
                cbPerformanceNowChecked: true,
                cbDateNowChecked: true,
                cbRequestAnimationFrameChecked: true
            }
        };

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) return;

            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (cfg) => window.postMessage(cfg, "*"),
                args: [config]
            });
        });
    }

    chrome.storage.local.get(["isRunning"], (result) => {
        const isRunning = result.isRunning === true;
        updateUI(isRunning);
    });

    toggleBtn.addEventListener("click", () => {
        chrome.storage.local.get(["isRunning"], (result) => {
            const isRunning = result.isRunning === true;
            const newStatus = !isRunning;

            chrome.storage.local.set({ isRunning: newStatus }, () => {
                updateUI(newStatus);
                sendSpeedConfig(newStatus);
            });
        });
    });
});
