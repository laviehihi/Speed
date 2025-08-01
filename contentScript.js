// Enhanced injection with retry mechanism for better reliability
console.log("Content script loaded on:", window.location.href);

let speedConfig = {
  speed: 1.0,
  cbSetIntervalChecked: false,
  cbSetTimeoutChecked: false,
  cbPerformanceNowChecked: false,
  cbDateNowChecked: false,
  cbRequestAnimationFrameChecked: false,
};

// Inject page script with retry mechanism
function injectPageScript() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("pageScript.js");
  script.onload = function () {
    console.log("Page script injected successfully");
    this.remove();
    // Send initial config after successful injection
    setTimeout(() => {
      chrome.storage.local.get(["isRunning"], (result) => {
        const isRunning = result.isRunning === true;
        const config = {
          command: "setSpeedConfig",
          config: {
            speed: isRunning ? 5 : 1,
            cbSetIntervalChecked: true,
            cbSetTimeoutChecked: true,
            cbPerformanceNowChecked: true,
            cbDateNowChecked: true,
            cbRequestAnimationFrameChecked: true,
          },
        };
        window.postMessage(config, "*");
      });
    }, 100);
  };
  script.onerror = function() {
    console.error("Failed to load page script, retrying...");
    // Retry injection after a delay
    setTimeout(injectPageScript, 500);
  };
  (document.head || document.documentElement).appendChild(script);
}

// Wait for DOM to be ready before injection
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectPageScript);
} else {
  injectPageScript();
}

// Initialize storage with default state
chrome.storage.local.set({ isRunning: false });

chrome.runtime.onMessage.addListener(function (request, _sender, sendResponse) {
  if (request.command == "setSpeedConfig") {
    speedConfig = request.config;
    window.postMessage(request, "*");
  } else if (request.command == "getSpeedConfig") {
    sendResponse(speedConfig);
  }
});

// Enhanced message handling with validation
window.addEventListener("message", (e) => {
  // Validate message origin and structure
  if (e.data && typeof e.data === 'object') {
    if (e.data.command === "getSpeedConfig") {
      window.postMessage({
        command: "setSpeedConfig",
        config: speedConfig,
      }, "*");
    } else if (e.data.command === "pageScriptReady") {
      // Page script is ready, send current config
      chrome.storage.local.get(["isRunning"], (result) => {
        const isRunning = result.isRunning === true;
        const config = {
          command: "setSpeedConfig",
          config: {
            speed: isRunning ? 5 : 1,
            cbSetIntervalChecked: true,
            cbSetTimeoutChecked: true,
            cbPerformanceNowChecked: true,
            cbDateNowChecked: true,
            cbRequestAnimationFrameChecked: true,
          },
        };
        window.postMessage(config, "*");
      });
    }
  }
});
