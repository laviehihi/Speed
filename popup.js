document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("toggleBtn");

    // Hàm cập nhật UI
    function updateUI(isRunning) {
        toggleBtn.textContent = isRunning ? "Pause" : "Start";
    }

    // Gửi cấu hình tốc độ vào tab hiện tại
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

    // Đọc trạng thái từ storage
    chrome.storage.local.get(["isRunning"], (result) => {
        const isRunning = result.isRunning === true;
        updateUI(isRunning);
    });

    // Xử lý khi click nút
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
