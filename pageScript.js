function pageScript() {
    console.log("Enhanced page script executing on:", window.location.href);
    
    // Prevent multiple injections
    if (window.speedHackInjected) {
        console.log("Speed hack already injected, skipping...");
        return;
    }
    window.speedHackInjected = true;
    
    let speedConfig = {
        speed: 1.0,
        selectedSpeed: 5, // Default selected speed
        cbSetIntervalChecked: false,
        cbSetTimeoutChecked: false,
        cbPerformanceNowChecked: false,
        cbDateNowChecked: false,
        cbRequestAnimationFrameChecked: false,
    };

    // Store original functions safely
    const originalFunctions = {
        clearInterval: window.clearInterval.bind(window),
        clearTimeout: window.clearTimeout.bind(window),
        setInterval: window.setInterval.bind(window),
        setTimeout: window.setTimeout.bind(window),
        performanceNow: window.performance.now.bind(window.performance),
        dateNow: Date.now.bind(Date),
        requestAnimationFrame: window.requestAnimationFrame.bind(window),
        cancelAnimationFrame: window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : null
    };

    // Enhanced timer management
    let timers = new Map();
    let timeoutTimers = new Map();
    let nextTimerId = 1;
    
    const reloadTimers = () => {
        console.log("Reloading timers with speed:", speedConfig.speed, "selectedSpeed:", speedConfig.selectedSpeed);
        
        let reloadedCount = 0;
        let errorCount = 0;
        
        try {
            // Validate speed before reloading
            if (typeof speedConfig.speed !== 'number' || speedConfig.speed < 1) {
                throw new Error(`Invalid speed for timer reload: ${speedConfig.speed}`);
            }
            
            // Reload intervals with error handling
            timers.forEach((timer, id) => {
                try {
                    if (!timer.finished && timer.handler && typeof timer.handler === 'function') {
                        // Clear existing timer safely
                        try {
                            originalFunctions.clearInterval(timer.realId);
                            if (timer.customId && timer.customId !== timer.realId) {
                                originalFunctions.clearInterval(timer.customId);
                            }
                        } catch (clearError) {
                            console.warn(`Error clearing timer ${id}:`, clearError);
                        }
                        
                        // Calculate new timeout with current speed
                        const baseTimeout = typeof timer.timeout === 'number' ? timer.timeout : 1000;
                        const newTimeout = speedConfig.cbSetIntervalChecked ? 
                            Math.max(1, baseTimeout / speedConfig.speed) : baseTimeout;
                        
                        // Validate new timeout
                        if (!Number.isFinite(newTimeout) || newTimeout < 1) {
                            console.warn(`Invalid timeout calculated for timer ${id}: ${newTimeout}, using fallback`);
                            timer.realId = originalFunctions.setInterval(timer.handler, 1000, ...timer.args);
                        } else {
                            // Create new timer with updated speed
                            timer.realId = originalFunctions.setInterval(
                                timer.handler,
                                newTimeout,
                                ...timer.args
                            );
                        }
                        
                        // Update timer record
                        timer.customId = timer.realId;
                        reloadedCount++;
                    } else if (timer.finished) {
                        // Clean up finished timers
                        timers.delete(id);
                    }
                } catch (timerError) {
                    console.error(`Error reloading timer ${id}:`, timerError);
                    errorCount++;
                    
                    // Try to clean up problematic timer
                    try {
                        if (timer.realId) {
                            originalFunctions.clearInterval(timer.realId);
                        }
                        timers.delete(id);
                    } catch (cleanupError) {
                        console.error(`Error cleaning up problematic timer ${id}:`, cleanupError);
                    }
                }
            });
            
            console.log(`Timer reload complete: ${reloadedCount} reloaded, ${errorCount} errors, speed: ${speedConfig.speed}`);
            
            if (errorCount > 0) {
                console.warn(`${errorCount} timers failed to reload - they have been cleaned up`);
            }
            
        } catch (error) {
            console.error("Critical error during timer reload:", error);
            
            // Emergency cleanup: try to clear all timers and reset
            try {
                timers.forEach((timer, id) => {
                    try {
                        if (timer.realId) {
                            originalFunctions.clearInterval(timer.realId);
                        }
                    } catch (cleanupError) {
                        console.error(`Emergency cleanup failed for timer ${id}:`, cleanupError);
                    }
                });
                timers.clear();
                console.log("Emergency timer cleanup completed");
            } catch (emergencyError) {
                console.error("Emergency cleanup failed:", emergencyError);
            }
            
            throw error; // Re-throw to notify caller
        }
        
        // Note: setTimeout timers are not reloaded as they're one-time executions
        // They will use the new speed for any new setTimeout calls
    };

    // Enhanced message handling with comprehensive error handling and validation
    window.addEventListener("message", (e) => {
        try {
            // Validate message structure
            if (!e.data || typeof e.data !== 'object') {
                return; // Ignore invalid messages silently
            }
            
            if (e.data.command === "setSpeedConfig" && e.data.config) {
                console.log("Speed config received:", e.data.config);
                
                try {
                    const oldSpeed = speedConfig.speed;
                    const oldSelectedSpeed = speedConfig.selectedSpeed;
                    
                    // Validate and sanitize config
                    const newConfig = { ...e.data.config };
                    
                    // Validate selectedSpeed against allowed options (5, 10, 20, 30)
                    if (newConfig.selectedSpeed !== undefined) {
                        if (typeof newConfig.selectedSpeed !== 'number' || 
                            ![5, 10, 20, 30].includes(newConfig.selectedSpeed)) {
                            console.warn("Invalid selectedSpeed, defaulting to 5:", newConfig.selectedSpeed);
                            newConfig.selectedSpeed = 5;
                        }
                    }
                    
                    // Validate speed value
                    if (newConfig.speed !== undefined) {
                        if (typeof newConfig.speed !== 'number' || newConfig.speed < 1) {
                            console.warn("Invalid speed, defaulting to 1:", newConfig.speed);
                            newConfig.speed = 1;
                        }
                    }
                    
                    speedConfig = { ...speedConfig, ...newConfig };
                    
                    // Reload timers if speed actually changed
                    if (oldSpeed !== speedConfig.speed) {
                        console.log("Speed changed from", oldSpeed, "to", speedConfig.speed, "- reloading timers");
                        try {
                            reloadTimers();
                            // Send confirmation back to content script
                            window.postMessage({ command: "speedConfigApplied", speed: speedConfig.speed }, "*");
                        } catch (reloadError) {
                            console.error("Error reloading timers:", reloadError);
                            window.postMessage({ command: "speedConfigError", error: reloadError.message }, "*");
                        }
                    }
                    
                    // Log selectedSpeed changes for debugging
                    if (oldSelectedSpeed !== speedConfig.selectedSpeed) {
                        console.log("Selected speed changed from", oldSelectedSpeed, "to", speedConfig.selectedSpeed);
                    }
                    
                } catch (configError) {
                    console.error("Error processing speed config:", configError);
                    window.postMessage({ command: "speedConfigError", error: configError.message }, "*");
                }
                
            } else if (e.data.command === "setSpeedSelection") {
                console.log("Speed selection received:", e.data.selectedSpeed);
                
                try {
                    const oldSelectedSpeed = speedConfig.selectedSpeed;
                    
                    // Validate selectedSpeed against allowed options (5, 10, 20, 30)
                    const newSelectedSpeed = e.data.selectedSpeed;
                    if (typeof newSelectedSpeed !== 'number' || 
                        ![5, 10, 20, 30].includes(newSelectedSpeed)) {
                        console.warn("Invalid selectedSpeed received, ignoring:", newSelectedSpeed);
                        window.postMessage({ 
                            command: "speedConfigError", 
                            error: `Invalid speed selection: ${newSelectedSpeed}` 
                        }, "*");
                        return;
                    }
                    
                    speedConfig.selectedSpeed = newSelectedSpeed;
                    
                    // If speed hack is currently active, apply the new speed immediately
                    if (speedConfig.speed > 1) {
                        const oldSpeed = speedConfig.speed;
                        speedConfig.speed = speedConfig.selectedSpeed;
                        console.log("Applying new speed immediately from", oldSpeed, "to", speedConfig.speed);
                        
                        try {
                            reloadTimers();
                            window.postMessage({ 
                                command: "speedConfigApplied", 
                                speed: speedConfig.speed,
                                selectedSpeed: speedConfig.selectedSpeed 
                            }, "*");
                        } catch (reloadError) {
                            console.error("Error applying new speed immediately:", reloadError);
                            window.postMessage({ command: "speedConfigError", error: reloadError.message }, "*");
                        }
                    }
                    
                    // Log selectedSpeed changes for debugging
                    if (oldSelectedSpeed !== speedConfig.selectedSpeed) {
                        console.log("Selected speed changed from", oldSelectedSpeed, "to", speedConfig.selectedSpeed);
                    }
                    
                } catch (selectionError) {
                    console.error("Error processing speed selection:", selectionError);
                    window.postMessage({ command: "speedConfigError", error: selectionError.message }, "*");
                }
            }
            
        } catch (error) {
            console.error("Critical error in message handler:", error);
            // Send error notification back to content script
            try {
                window.postMessage({ command: "speedConfigError", error: error.message }, "*");
            } catch (postError) {
                console.error("Failed to send error notification:", postError);
            }
        }
    });

    // Helper function to get current speed state
    const getSpeedState = () => {
        return {
            speed: speedConfig.speed,
            selectedSpeed: speedConfig.selectedSpeed,
            isRunning: speedConfig.speed > 1,
            timersActive: timers.size,
            timeoutsActive: timeoutTimers.size
        };
    };

    // Signal that page script is ready
    setTimeout(() => {
        console.log("Page script ready, initial state:", getSpeedState());
        window.postMessage({ command: "pageScriptReady" }, "*");
        window.postMessage({ command: "getSpeedConfig" }, "*");
    }, 50);

    // Enhanced timer function overrides
    window.clearInterval = (id) => {
        const timer = timers.get(id);
        if (timer) {
            timer.finished = true;
            originalFunctions.clearInterval(timer.realId);
            if (timer.customId) {
                originalFunctions.clearInterval(timer.customId);
            }
            timers.delete(id);
        } else {
            originalFunctions.clearInterval(id);
        }
    };

    window.clearTimeout = (id) => {
        const timer = timeoutTimers.get(id);
        if (timer) {
            originalFunctions.clearTimeout(timer.realId);
            timeoutTimers.delete(id);
        } else {
            originalFunctions.clearTimeout(id);
        }
    };

    window.setInterval = (handler, timeout, ...args) => {
        try {
            // Validate handler
            if (typeof handler !== 'function') {
                console.warn("setInterval called with non-function handler, using original");
                return originalFunctions.setInterval(handler, timeout, ...args);
            }
            
            // Validate and sanitize timeout
            timeout = typeof timeout === 'number' ? Math.max(0, timeout) : 0;
            
            // Validate speed config
            if (typeof speedConfig.speed !== 'number' || speedConfig.speed < 1) {
                console.warn("Invalid speed config, using speed 1:", speedConfig.speed);
                speedConfig.speed = 1;
            }
            
            const adjustedTimeout = speedConfig.cbSetIntervalChecked ? 
                Math.max(1, timeout / speedConfig.speed) : timeout;
            
            // Validate adjusted timeout
            if (!Number.isFinite(adjustedTimeout) || adjustedTimeout < 1) {
                console.warn("Invalid adjusted timeout, using fallback:", adjustedTimeout);
                const fallbackTimeout = 1000;
                const realId = originalFunctions.setInterval(handler, fallbackTimeout, ...args);
                const virtualId = nextTimerId++;
                
                timers.set(virtualId, {
                    realId: realId,
                    handler: handler,
                    timeout: timeout,
                    args: args,
                    finished: false,
                    customId: null
                });
                
                return virtualId;
            }
            
            const realId = originalFunctions.setInterval(handler, adjustedTimeout, ...args);
            const virtualId = nextTimerId++;
            
            timers.set(virtualId, {
                realId: realId,
                handler: handler,
                timeout: timeout,
                args: args,
                finished: false,
                customId: null
            });
            
            return virtualId;
            
        } catch (error) {
            console.error("Error in setInterval override:", error);
            // Fallback to original function
            try {
                return originalFunctions.setInterval(handler, timeout, ...args);
            } catch (fallbackError) {
                console.error("Fallback setInterval also failed:", fallbackError);
                return null;
            }
        }
    };

    window.setTimeout = (handler, timeout, ...args) => {
        try {
            // Validate handler
            if (typeof handler !== 'function') {
                console.warn("setTimeout called with non-function handler, using original");
                return originalFunctions.setTimeout(handler, timeout, ...args);
            }
            
            // Validate and sanitize timeout
            timeout = typeof timeout === 'number' ? Math.max(0, timeout) : 0;
            
            // Validate speed config
            if (typeof speedConfig.speed !== 'number' || speedConfig.speed < 1) {
                console.warn("Invalid speed config for setTimeout, using speed 1:", speedConfig.speed);
                speedConfig.speed = 1;
            }
            
            const adjustedTimeout = speedConfig.cbSetTimeoutChecked ? 
                Math.max(1, timeout / speedConfig.speed) : timeout;
            
            // Validate adjusted timeout
            if (!Number.isFinite(adjustedTimeout) || adjustedTimeout < 0) {
                console.warn("Invalid adjusted timeout for setTimeout, using fallback:", adjustedTimeout);
                const fallbackTimeout = Math.max(1, timeout);
                const realId = originalFunctions.setTimeout(handler, fallbackTimeout, ...args);
                const virtualId = nextTimerId++;
                
                timeoutTimers.set(virtualId, { realId: realId });
                return virtualId;
            }
            
            const realId = originalFunctions.setTimeout(handler, adjustedTimeout, ...args);
            const virtualId = nextTimerId++;
            
            timeoutTimers.set(virtualId, { realId: realId });
            
            return virtualId;
            
        } catch (error) {
            console.error("Error in setTimeout override:", error);
            // Fallback to original function
            try {
                return originalFunctions.setTimeout(handler, timeout, ...args);
            } catch (fallbackError) {
                console.error("Fallback setTimeout also failed:", fallbackError);
                return null;
            }
        }
    };

    // Enhanced performance.now override
    (function () {
        let performanceNowValue = null;
        let previousPerformanceNowValue = null;
        let lastUpdateTime = originalFunctions.performanceNow();
        
        window.performance.now = () => {
            const originalValue = originalFunctions.performanceNow();
            
            if (performanceNowValue === null) {
                performanceNowValue = originalValue;
                previousPerformanceNowValue = originalValue;
                lastUpdateTime = originalValue;
                return performanceNowValue;
            }
            
            const deltaTime = originalValue - previousPerformanceNowValue;
            const speedMultiplier = speedConfig.cbPerformanceNowChecked ? speedConfig.speed : 1;
            
            performanceNowValue += deltaTime * speedMultiplier;
            previousPerformanceNowValue = originalValue;
            
            return performanceNowValue;
        };
    })();

    // Enhanced Date.now override
    (function () {
        let dateNowValue = null;
        let previousDateNowValue = null;
        
        Date.now = () => {
            const originalValue = originalFunctions.dateNow();
            
            if (dateNowValue === null) {
                dateNowValue = originalValue;
                previousDateNowValue = originalValue;
                return dateNowValue;
            }
            
            const deltaTime = originalValue - previousDateNowValue;
            const speedMultiplier = speedConfig.cbDateNowChecked ? speedConfig.speed : 1;
            
            dateNowValue += deltaTime * speedMultiplier;
            previousDateNowValue = originalValue;
            
            return Math.floor(dateNowValue);
        };
    })();

    // Enhanced requestAnimationFrame override
    (function () {
        let rafCallbacks = new Map();
        let rafId = 1;
        let isProcessing = false;
        
        window.requestAnimationFrame = (callback) => {
            if (typeof callback !== 'function') {
                return originalFunctions.requestAnimationFrame(callback);
            }
            
            const id = rafId++;
            
            if (!speedConfig.cbRequestAnimationFrameChecked || speedConfig.speed === 1) {
                const realId = originalFunctions.requestAnimationFrame(callback);
                rafCallbacks.set(id, { realId, callback });
                return id;
            }
            
            // For speed hacking, we need to call the callback multiple times per frame
            const realId = originalFunctions.requestAnimationFrame((timestamp) => {
                if (!rafCallbacks.has(id)) return;
                
                const callbackData = rafCallbacks.get(id);
                rafCallbacks.delete(id);
                
                if (isProcessing) {
                    callback(timestamp);
                    return;
                }
                
                isProcessing = true;
                const speed = speedConfig.speed;
                const maxCalls = Math.min(Math.ceil(speed), 10); // Limit to prevent browser freeze
                
                try {
                    for (let i = 0; i < maxCalls; i++) {
                        callback(timestamp + (i * 16.67)); // Simulate 60fps timing
                    }
                } catch (e) {
                    console.error("RAF callback error:", e);
                } finally {
                    isProcessing = false;
                }
            });
            
            rafCallbacks.set(id, { realId, callback });
            return id;
        };
        
        // Override cancelAnimationFrame if it exists
        if (originalFunctions.cancelAnimationFrame) {
            window.cancelAnimationFrame = (id) => {
                const callbackData = rafCallbacks.get(id);
                if (callbackData) {
                    originalFunctions.cancelAnimationFrame(callbackData.realId);
                    rafCallbacks.delete(id);
                } else {
                    originalFunctions.cancelAnimationFrame(id);
                }
            };
        }
    })();
    
    console.log("Enhanced speed hack injection complete");
}

pageScript();