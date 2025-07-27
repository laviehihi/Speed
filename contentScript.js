let speedConfig = {
    speed: 1.0,
    cbSetIntervalChecked: false,
    cbSetTimeoutChecked: false,
    cbPerformanceNowChecked: false,
    cbDateNowChecked: false,
    cbRequestAnimationFrameChecked: false,
};

chrome.storage.local.set({ isRunning: false }, () => {
    const resetConfig = {
        command: "setSpeedConfig",
        config: {
            speed: 1,
            cbSetIntervalChecked: true,
            cbSetTimeoutChecked: true,
            cbPerformanceNowChecked: true,
            cbDateNowChecked: true,
            cbRequestAnimationFrameChecked: true
        }
    };

    window.postMessage(resetConfig, "*");
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.command == "setSpeedConfig") {
        speedConfig = request.config;
        window.postMessage(request);
    } else if (request.command == "getSpeedConfig") {
        sendResponse(speedConfig);
    }
});

window.addEventListener("message", (e) => {
    if (e.data.command === "getSpeedConfig") {
        window.postMessage({
            command: "setSpeedConfig",
            config: speedConfig,
        });
    }
});
