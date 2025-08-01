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
        console.log("Reloading timers with speed:", speedConfig.speed);
        
        // Reload intervals
        timers.forEach((timer, id) => {
            if (!timer.finished) {
                originalFunctions.clearInterval(timer.realId);
                if (timer.customId) {
                    originalFunctions.clearInterval(timer.customId);
                }
                
                const newTimeout = speedConfig.cbSetIntervalChecked ? 
                    Math.max(1, timer.timeout / speedConfig.speed) : timer.timeout;
                
                const newId = originalFunctions.setInterval(
                    timer.handler,
                    newTimeout,
                    ...timer.args
                );
                timer.customId = newId;
            }
        });
        
        // Note: setTimeout timers are not reloaded as they're one-time
    };

    // Enhanced message handling
    window.addEventListener("message", (e) => {
        if (e.data && e.data.command === "setSpeedConfig" && e.data.config) {
            console.log("Speed config received:", e.data.config);
            const oldSpeed = speedConfig.speed;
            speedConfig = { ...speedConfig, ...e.data.config };
            
            // Only reload timers if speed actually changed
            if (oldSpeed !== speedConfig.speed) {
                reloadTimers();
            }
        }
    });

    // Signal that page script is ready
    setTimeout(() => {
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
        if (typeof handler !== 'function') {
            return originalFunctions.setInterval(handler, timeout, ...args);
        }
        
        timeout = Math.max(0, timeout || 0);
        const adjustedTimeout = speedConfig.cbSetIntervalChecked ? 
            Math.max(1, timeout / speedConfig.speed) : timeout;
        
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
    };

    window.setTimeout = (handler, timeout, ...args) => {
        if (typeof handler !== 'function') {
            return originalFunctions.setTimeout(handler, timeout, ...args);
        }
        
        timeout = Math.max(0, timeout || 0);
        const adjustedTimeout = speedConfig.cbSetTimeoutChecked ? 
            Math.max(1, timeout / speedConfig.speed) : timeout;
        
        const realId = originalFunctions.setTimeout(handler, adjustedTimeout, ...args);
        const virtualId = nextTimerId++;
        
        timeoutTimers.set(virtualId, { realId: realId });
        
        return virtualId;
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