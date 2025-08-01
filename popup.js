document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("toggleBtn");

    function updateUI(isRunning) {
        toggleBtn.textContent = isRunning ? "Stop (5x)" : "Start (5x)";
        toggleBtn.style.backgroundColor = isRunning ? "#ff4444" : "#4CAF50";
    }

    function sendSpeedConfig(isRunning, customSpeed = null) {
        const speed = customSpeed || (isRunning ? 5 : 1);
        const config = {
            command: "setSpeedConfig",
            config: {
                speed: speed,
                cbSetIntervalChecked: true,
                cbSetTimeoutChecked: true,
                cbPerformanceNowChecked: true,
                cbDateNowChecked: true,
                cbRequestAnimationFrameChecked: true
            }
        };

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                console.error("No active tab found");
                return;
            }

            const executeScript = (tabId, config) => {
                // Try the modern scripting API first
                if (chrome.scripting && chrome.scripting.executeScript) {
                    chrome.scripting.executeScript({
                        target: { tabId: tabId, allFrames: true },
                        func: (cfg) => {
                            window.postMessage(cfg, "*");
                            console.log("Speed config sent:", cfg);
                        },
                        args: [config]
                    }).catch(error => {
                        console.error("Script execution failed:", error);
                        // Fallback to older API
                        if (chrome.tabs.executeScript) {
                            chrome.tabs.executeScript(tabId, {
                                code: `window.postMessage(${JSON.stringify(config)}, "*"); console.log("Speed config sent (fallback):", ${JSON.stringify(config)});`,
                                allFrames: true
                            });
                        }
                    });
                } else if (chrome.tabs.executeScript) {
                    // Fallback for older Edge versions
                    chrome.tabs.executeScript(tabId, {
                        code: `window.postMessage(${JSON.stringify(config)}, "*"); console.log("Speed config sent (fallback):", ${JSON.stringify(config)});`,
                        allFrames: true
                    });
                }
            };

            executeScript(tabs[0].id, config);
        });
    }

    // Initialize UI state
    chrome.storage.local.get(["isRunning"], (result) => {
        const isRunning = result.isRunning === true;
        updateUI(isRunning);
    });

    // Enhanced toggle functionality
    toggleBtn.addEventListener("click", () => {
        chrome.storage.local.get(["isRunning"], (result) => {
            const isRunning = result.isRunning === true;
            const newStatus = !isRunning;

            chrome.storage.local.set({ isRunning: newStatus }, () => {
                updateUI(newStatus);
                sendSpeedConfig(newStatus);
                
                // Visual feedback
                toggleBtn.style.transform = "scale(0.95)";
                setTimeout(() => {
                    toggleBtn.style.transform = "scale(1)";
                }, 100);
            });
        });
    });

    // Add keyboard shortcut support
    document.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            toggleBtn.click();
        }
    });
});
