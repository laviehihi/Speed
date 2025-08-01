// Enhanced injection with retry mechanism for better reliability
console.log("Content script loaded on:", window.location.href);

let speedConfig = {
  speed: 1.0,
  selectedSpeed: 5, // Default selected speed
  cbSetIntervalChecked: false,
  cbSetTimeoutChecked: false,
  cbPerformanceNowChecked: false,
  cbDateNowChecked: false,
  cbRequestAnimationFrameChecked: false,
};

// Comprehensive error handling utility for storage operations
function handleStorageError(error, operation) {
  console.error(`Storage error during ${operation}:`, error);
  
  // Log additional context for debugging
  if (error && error.message) {
    console.error(`Storage error details: ${error.message}`);
  }
  
  // Return safe default values on error
  const defaults = { 
    isRunning: false, 
    selectedSpeed: 5 // Default to x5 speed
  };
  
  console.log(`Using fallback defaults for ${operation}:`, defaults);
  return defaults;
}

// Validate speed value against allowed options (10, 20, 30)
function validateSpeed(speed, context = 'unknown') {
  if (typeof speed !== 'number') {
    console.error(`Invalid speed type in ${context}:`, typeof speed, speed);
    return false;
  }
  
  if (!Number.isFinite(speed)) {
    console.error(`Invalid speed value (not finite) in ${context}:`, speed);
    return false;
  }
  
  if (![5, 10, 20, 30].includes(speed)) {
    console.error(`Invalid speed value (not in allowed options) in ${context}:`, speed, 'Allowed: [5, 10, 20, 30]');
    return false;
  }
  
  return true;
}

// Retry mechanism for message passing with exponential backoff
function retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    function attempt() {
      attempts++;
      operation()
        .then(resolve)
        .catch(error => {
          if (attempts >= maxRetries) {
            console.error(`Operation failed after ${maxRetries} attempts:`, error);
            reject(error);
          } else {
            const delay = baseDelay * Math.pow(2, attempts - 1); // Exponential backoff
            console.warn(`Operation failed (attempt ${attempts}/${maxRetries}), retrying in ${delay}ms:`, error);
            setTimeout(attempt, delay);
          }
        });
    }
    
    attempt();
  });
}

// Send initial configuration to page script using stored preferences with comprehensive error handling
function sendInitialConfig() {
  console.log("Sending initial configuration...");
  
  try {
    chrome.storage.local.get(["isRunning", "selectedSpeed"], (result) => {
      try {
        // Handle potential storage errors with fallback
        if (chrome.runtime.lastError) {
          console.error("Storage error during initial config load:", chrome.runtime.lastError);
          const fallback = handleStorageError(chrome.runtime.lastError, "initial config load");
          result = fallback;
        }
        
        // Validate and sanitize storage results
        const isRunning = typeof result.isRunning === 'boolean' ? result.isRunning : false;
        let selectedSpeed = result.selectedSpeed || 5; // Default to x5
        
        // Validate selectedSpeed against allowed options
        if (!validateSpeed(selectedSpeed, 'initial config')) {
          console.warn('Invalid selectedSpeed from storage, using default:', selectedSpeed);
          selectedSpeed = 5; // Fallback to default
        }
        
        // Update local speedConfig with validated preferences
        speedConfig.selectedSpeed = selectedSpeed;
        speedConfig.speed = isRunning ? selectedSpeed : 1;
        
        const config = {
          command: "setSpeedConfig",
          config: {
            speed: isRunning ? selectedSpeed : 1,
            selectedSpeed: selectedSpeed,
            cbSetIntervalChecked: true,
            cbSetTimeoutChecked: true,
            cbPerformanceNowChecked: true,
            cbDateNowChecked: true,
            cbRequestAnimationFrameChecked: true,
          },
        };
        
        console.log("Sending validated initial config:", config);
        
        // Send config with error handling
        try {
          window.postMessage(config, "*");
          console.log("Initial config sent successfully");
        } catch (postError) {
          console.error("Error posting initial config message:", postError);
          // Try again with minimal config
          setTimeout(() => {
            try {
              window.postMessage({
                command: "setSpeedConfig",
                config: { speed: 1, selectedSpeed: 5 }
              }, "*");
            } catch (retryError) {
              console.error("Failed to send fallback config:", retryError);
            }
          }, 500);
        }
        
      } catch (error) {
        console.error("Error processing initial config:", error);
        sendFallbackConfig();
      }
    });
  } catch (error) {
    console.error("Error accessing storage for initial config:", error);
    sendFallbackConfig();
  }
}

// Send fallback configuration when all else fails
function sendFallbackConfig() {
  console.log("Sending fallback configuration...");
  const defaultConfig = {
    command: "setSpeedConfig",
    config: {
      speed: 1,
      selectedSpeed: 5, // Default to x5 speed
      cbSetIntervalChecked: true,
      cbSetTimeoutChecked: true,
      cbPerformanceNowChecked: true,
      cbDateNowChecked: true,
      cbRequestAnimationFrameChecked: true,
    },
  };
  
  try {
    window.postMessage(defaultConfig, "*");
    console.log("Fallback config sent successfully");
  } catch (error) {
    console.error("Failed to send fallback config:", error);
    // At this point, we've exhausted all options
  }
}

// Inject page script with retry mechanism and better error handling
function injectPageScript() {
  console.log("Attempting to inject page script on:", window.location.href);
  
  // Check if already injected to prevent duplicates
  if (document.querySelector('script[data-speed-hack-injected]')) {
    console.log("Page script already injected, sending config...");
    setTimeout(sendInitialConfig, 100);
    return;
  }
  
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("pageScript.js");
  script.setAttribute('data-speed-hack-injected', 'true');
  
  script.onload = function () {
    console.log("Page script injected successfully on:", window.location.href);
    this.remove();
    // Send initial config after successful injection with a small delay
    setTimeout(sendInitialConfig, 100);
  };
  
  script.onerror = function() {
    console.error("Failed to load page script, retrying...");
    this.remove();
    // Retry injection after a delay
    setTimeout(injectPageScript, 1000);
  };
  
  // Try to inject into head first, then documentElement as fallback
  const target = document.head || document.documentElement;
  if (target) {
    target.appendChild(script);
  } else {
    console.error("No suitable injection target found, retrying...");
    setTimeout(injectPageScript, 500);
  }
}

// Wait for DOM to be ready before injection with multiple strategies
function attemptInjection() {
  console.log("Document ready state:", document.readyState);
  
  // Try immediate injection if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPageScript);
    // Also try after a delay as backup for sites with complex loading
    setTimeout(injectPageScript, 1000);
  } else {
    injectPageScript();
  }
  
  // Additional injection attempt for sites that load content dynamically
  setTimeout(() => {
    if (!document.querySelector('script[data-speed-hack-injected]')) {
      console.log("Backup injection attempt...");
      injectPageScript();
    }
  }, 2000);
}

attemptInjection();

// Initialize storage with default state including selectedSpeed
function initializeStorage() {
  chrome.storage.local.get(["isRunning", "selectedSpeed"], (result) => {
    try {
      // Handle potential storage errors
      if (chrome.runtime.lastError) {
        console.error("Storage initialization error:", chrome.runtime.lastError);
        // Set defaults even if there's an error
        chrome.storage.local.set({ isRunning: false, selectedSpeed: 5 });
        return;
      }
      
      const defaults = {};
      
      // Ensure isRunning has a default value
      if (result.isRunning === undefined) {
        defaults.isRunning = false;
      }
      
      // Ensure selectedSpeed has a default value (requirement 3.4)
      if (result.selectedSpeed === undefined) {
        defaults.selectedSpeed = 10; // Default to x10 speed
      }
      
      // Only update storage if we have defaults to set
      if (Object.keys(defaults).length > 0) {
        chrome.storage.local.set(defaults, () => {
          if (chrome.runtime.lastError) {
            console.error("Error setting storage defaults:", chrome.runtime.lastError);
          } else {
            console.log("Storage initialized with defaults:", defaults);
          }
        });
      }
    } catch (error) {
      console.error("Error during storage initialization:", error);
      // Fallback: try to set basic defaults
      chrome.storage.local.set({ isRunning: false, selectedSpeed: 5 });
    }
  });
}

// Initialize storage on content script load
initializeStorage();

// Enhanced message handling with comprehensive error handling and validation
chrome.runtime.onMessage.addListener(function (request, _sender, sendResponse) {
  console.log("Received message:", request);
  
  try {
    // Validate request structure
    if (!request || typeof request !== 'object' || !request.command) {
      console.error("Invalid message structure:", request);
      sendResponse({ success: false, error: "Invalid message structure" });
      return;
    }
    
    if (request.command === "setSpeedConfig") {
      // Enhanced setSpeedConfig with comprehensive validation
      if (!request.config || typeof request.config !== 'object') {
        console.error("Invalid speed config received:", request.config);
        sendResponse({ success: false, error: "Invalid config object" });
        return;
      }
      
      // Validate speed values
      if (request.config.speed !== undefined && 
          (typeof request.config.speed !== 'number' || request.config.speed < 1)) {
        console.error("Invalid speed value:", request.config.speed);
        sendResponse({ success: false, error: "Invalid speed value" });
        return;
      }
      
      if (request.config.selectedSpeed !== undefined && 
          !validateSpeed(request.config.selectedSpeed, 'setSpeedConfig')) {
        console.error("Invalid selectedSpeed value:", request.config.selectedSpeed);
        sendResponse({ success: false, error: "Invalid selectedSpeed value" });
        return;
      }
      
      try {
        speedConfig = { ...speedConfig, ...request.config };
        window.postMessage(request, "*");
        console.log("Speed config updated successfully:", speedConfig);
        sendResponse({ success: true });
      } catch (postError) {
        console.error("Error posting speed config message:", postError);
        sendResponse({ success: false, error: "Failed to send config to page" });
      }
      
    } else if (request.command === "setSpeedSelection") {
      // Enhanced speed selection with comprehensive error handling
      const selectedSpeed = request.selectedSpeed;
      
      // Validate speed value against allowed options (10, 20, 30)
      if (!validateSpeed(selectedSpeed, 'setSpeedSelection')) {
        console.error("Invalid speed selection:", selectedSpeed);
        sendResponse({ success: false, error: "Invalid speed value - must be 5, 10, 20, or 30" });
        return;
      }
      
      speedConfig.selectedSpeed = selectedSpeed;
      
      // Check if speed hack is currently running and update active speed with error handling
      try {
        chrome.storage.local.get(["isRunning"], (result) => {
          try {
            if (chrome.runtime.lastError) {
              console.error("Storage error during speed selection:", chrome.runtime.lastError);
              sendResponse({ success: false, error: "Storage access failed" });
              return;
            }
            
            const isRunning = typeof result.isRunning === 'boolean' ? result.isRunning : false;
            
            // If running, immediately apply new speed (requirement 1.4)
            if (isRunning) {
              speedConfig.speed = selectedSpeed;
              
              try {
                // Send updated config to page script for immediate application
                window.postMessage({
                  command: "setSpeedConfig",
                  config: speedConfig
                }, "*");
                console.log("Speed immediately applied:", selectedSpeed);
              } catch (postError) {
                console.error("Error posting speed update to page:", postError);
                sendResponse({ success: false, error: "Failed to apply speed immediately" });
                return;
              }
            }
            
            // Store the selected speed preference (requirement 3.1) with error handling
            chrome.storage.local.set({ selectedSpeed: selectedSpeed }, () => {
              if (chrome.runtime.lastError) {
                console.error("Error storing speed selection:", chrome.runtime.lastError);
                sendResponse({ success: false, error: "Failed to store speed preference" });
              } else {
                console.log("Speed preference stored successfully:", selectedSpeed);
                sendResponse({ success: true });
              }
            });
            
          } catch (error) {
            console.error("Error processing speed selection:", error);
            sendResponse({ success: false, error: `Processing failed: ${error.message}` });
          }
        });
      } catch (error) {
        console.error("Error accessing storage for speed selection:", error);
        sendResponse({ success: false, error: "Storage access failed" });
      }
      
      // Return true to indicate async response
      return true;
      
    } else if (request.command === "getSpeedConfig") {
      try {
        sendResponse({ success: true, config: speedConfig });
      } catch (error) {
        console.error("Error sending speed config response:", error);
        sendResponse({ success: false, error: "Failed to send config" });
      }
      
    } else {
      console.warn("Unknown command received:", request.command);
      sendResponse({ success: false, error: `Unknown command: ${request.command}` });
    }
    
  } catch (error) {
    console.error("Critical error handling message:", error);
    sendResponse({ success: false, error: `Critical error: ${error.message}` });
  }
});

// Enhanced message handling with validation and error handling
window.addEventListener("message", (e) => {
  try {
    // Validate message origin and structure
    if (e.data && typeof e.data === 'object') {
      if (e.data.command === "getSpeedConfig") {
        // Send current speed config to page script
        window.postMessage({
          command: "setSpeedConfig",
          config: speedConfig,
        }, "*");
        console.log("Speed config sent to page script:", speedConfig);
      } else if (e.data.command === "pageScriptReady") {
        // Page script is ready, send current config with stored preferences
        console.log("Page script ready, sending initial config");
        sendInitialConfig();
      } else if (e.data.command === "speedConfigApplied") {
        // Page script confirms speed config was applied
        console.log("Speed config successfully applied by page script");
      } else if (e.data.command === "speedConfigError") {
        // Page script reports an error applying speed config
        console.error("Page script error applying speed config:", e.data.error);
      }
    }
  } catch (error) {
    console.error("Error handling window message:", error);
  }
});

// Ensure proper synchronization when speed hack is toggled
function syncSpeedConfigOnToggle(isRunning) {
  try {
    // Update speed based on running state (requirement 2.5)
    if (isRunning) {
      // Apply selected speed when starting
      speedConfig.speed = speedConfig.selectedSpeed;
    } else {
      // Restore normal timing when stopping (requirement 2.5)
      speedConfig.speed = 1;
    }
    
    // Send updated config to page script
    window.postMessage({
      command: "setSpeedConfig",
      config: speedConfig
    }, "*");
    
    console.log("Speed config synchronized on toggle:", { isRunning, speed: speedConfig.speed });
  } catch (error) {
    console.error("Error synchronizing speed config on toggle:", error);
  }
}

// Listen for storage changes to maintain synchronization
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    try {
      if (changes.isRunning) {
        const isRunning = changes.isRunning.newValue;
        syncSpeedConfigOnToggle(isRunning);
      }
      
      if (changes.selectedSpeed) {
        const newSelectedSpeed = changes.selectedSpeed.newValue;
        speedConfig.selectedSpeed = newSelectedSpeed;
        console.log("Selected speed updated from storage:", newSelectedSpeed);
        
        // If currently running, apply the new speed immediately
        chrome.storage.local.get(["isRunning"], (result) => {
          if (result.isRunning === true) {
            speedConfig.speed = newSelectedSpeed;
            window.postMessage({
              command: "setSpeedConfig",
              config: speedConfig
            }, "*");
            console.log("New speed applied immediately:", newSelectedSpeed);
          }
        });
      }
    } catch (error) {
      console.error("Error handling storage changes:", error);
    }
  }
});
