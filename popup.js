document.addEventListener("DOMContentLoaded", async () => {
    // Initialize SpeedState instance
    const speedState = new SpeedState();
    await speedState.initialize();

    // Get DOM elements
    const toggleBtn = document.getElementById("toggleBtn");
    const speedButtons = document.querySelectorAll(".speed-btn");

    /**
     * Update the UI to reflect current state
     * @param {boolean} isRunning - Whether speed hack is running
     * @param {number} selectedSpeed - Currently selected speed
     */
    function updateUI(isRunning, selectedSpeed) {
        // Update toggle button text and styling
        const speedText = `x${selectedSpeed}`;
        toggleBtn.textContent = isRunning ? `Stop (${speedText})` : `Start (${speedText})`;
        
        // Update toggle button class for styling
        if (isRunning) {
            toggleBtn.classList.add("running");
        } else {
            toggleBtn.classList.remove("running");
        }

        // Update speed button active states
        updateSpeedButtonStates(selectedSpeed);
    }

    /**
     * Update visual states of speed selection buttons
     * @param {number} selectedSpeed - Currently selected speed
     */
    function updateSpeedButtonStates(selectedSpeed) {
        speedButtons.forEach(button => {
            const buttonSpeed = parseInt(button.dataset.speed);
            if (buttonSpeed === selectedSpeed) {
                button.classList.add("active");
            } else {
                button.classList.remove("active");
            }
        });
    }

    /**
     * Send speed configuration to content script with comprehensive error handling
     * @param {boolean} isRunning - Whether speed hack should be running
     * @param {number} selectedSpeed - Speed multiplier to use
     */
    function sendSpeedConfig(isRunning, selectedSpeed) {
        // Validate inputs
        if (typeof isRunning !== 'boolean') {
            console.error('Invalid isRunning parameter:', isRunning);
            return;
        }
        
        if (typeof selectedSpeed !== 'number' || ![5, 10, 20, 30].includes(selectedSpeed)) {
            console.error('Invalid selectedSpeed parameter:', selectedSpeed);
            return;
        }
        
        const effectiveSpeed = isRunning ? selectedSpeed : 1;
        const config = {
            command: "setSpeedConfig",
            config: {
                speed: effectiveSpeed,
                selectedSpeed: selectedSpeed,
                cbSetIntervalChecked: true,
                cbSetTimeoutChecked: true,
                cbPerformanceNowChecked: true,
                cbDateNowChecked: true,
                cbRequestAnimationFrameChecked: true
            }
        };

        try {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (chrome.runtime.lastError) {
                    console.error("Error querying tabs:", chrome.runtime.lastError.message);
                    return;
                }
                
                if (!tabs || tabs.length === 0) {
                    console.error("No active tab found");
                    return;
                }

                try {
                    chrome.runtime.sendMessage(config, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error("Error sending speed config:", chrome.runtime.lastError.message);
                            // Implement retry mechanism
                            setTimeout(() => {
                                console.log("Retrying speed config send...");
                                chrome.runtime.sendMessage(config);
                            }, 1000);
                        } else {
                            console.log("Speed config sent successfully:", config);
                        }
                    });
                } catch (error) {
                    console.error("Exception sending speed config:", error);
                }
            });
        } catch (error) {
            console.error("Exception querying tabs:", error);
        }
    }

    /**
     * Send speed selection to content script without toggling with error handling
     * @param {number} selectedSpeed - Speed multiplier to select
     */
    function sendSpeedSelection(selectedSpeed) {
        // Validate speed value against allowed options
        if (typeof selectedSpeed !== 'number' || ![5, 10, 20, 30].includes(selectedSpeed)) {
            console.error('Invalid speed selection:', selectedSpeed, 'Allowed values: [5, 10, 20, 30]');
            return;
        }
        
        const config = {
            command: "setSpeedSelection",
            selectedSpeed: selectedSpeed
        };

        try {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (chrome.runtime.lastError) {
                    console.error("Error querying tabs for speed selection:", chrome.runtime.lastError.message);
                    return;
                }
                
                if (!tabs || tabs.length === 0) {
                    console.error("No active tab found for speed selection");
                    return;
                }

                try {
                    chrome.runtime.sendMessage(config, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error("Error sending speed selection:", chrome.runtime.lastError.message);
                            // Implement retry mechanism with exponential backoff
                            setTimeout(() => {
                                console.log("Retrying speed selection send...");
                                chrome.runtime.sendMessage(config);
                            }, 1000);
                        } else if (response && !response.success) {
                            console.error("Speed selection failed:", response.error);
                        } else {
                            console.log("Speed selection sent successfully:", selectedSpeed);
                        }
                    });
                } catch (error) {
                    console.error("Exception sending speed selection:", error);
                }
            });
        } catch (error) {
            console.error("Exception querying tabs for speed selection:", error);
        }
    }

    /**
     * Handle speed selection button clicks with comprehensive error handling
     * @param {number} speed - Selected speed value
     */
    async function handleSpeedSelection(speed) {
        // Validate speed value against allowed options (5, 10, 20, 30)
        if (typeof speed !== 'number' || ![5, 10, 20, 30].includes(speed)) {
            console.error('Invalid speed selection:', speed, 'Allowed values: [5, 10, 20, 30]');
            // Show user feedback for invalid selection
            showErrorFeedback(`Invalid speed: ${speed}`);
            return;
        }
        
        try {
            const success = await speedState.setSpeed(speed);
            if (success) {
                const currentState = speedState.getState();
                updateUI(currentState.isRunning, currentState.selectedSpeed);
                
                // Use new setSpeedSelection command for speed changes without toggle
                sendSpeedSelection(currentState.selectedSpeed);
                console.log('Speed selection handled successfully:', speed);
            } else {
                console.error("Failed to set speed in SpeedState:", speed);
                // Graceful degradation: try to update UI with current state
                const currentState = speedState.getState();
                updateUI(currentState.isRunning, currentState.selectedSpeed);
                showErrorFeedback(`Failed to set speed to ${speed}x`);
            }
        } catch (error) {
            console.error("Exception during speed selection:", error);
            // Graceful degradation: maintain current state
            const currentState = speedState.getState();
            updateUI(currentState.isRunning, currentState.selectedSpeed);
            showErrorFeedback('Speed selection failed');
        }
    }

    /**
     * Handle toggle button clicks with comprehensive error handling
     */
    async function handleToggle() {
        try {
            const newRunningState = await speedState.toggle();
            const currentState = speedState.getState();
            
            // Validate current state before proceeding
            if (typeof currentState.isRunning !== 'boolean' || 
                typeof currentState.selectedSpeed !== 'number' ||
                ![5, 10, 20, 30].includes(currentState.selectedSpeed)) {
                console.error('Invalid state after toggle:', currentState);
                showErrorFeedback('Invalid state after toggle');
                return;
            }
            
            updateUI(currentState.isRunning, currentState.selectedSpeed);
            sendSpeedConfig(currentState.isRunning, currentState.selectedSpeed);
            
            // Visual feedback animation
            addButtonFeedback(toggleBtn);
            console.log('Toggle handled successfully:', currentState);
        } catch (error) {
            console.error("Exception during toggle:", error);
            
            // Graceful degradation: try to maintain current state
            try {
                const currentState = speedState.getState();
                updateUI(currentState.isRunning, currentState.selectedSpeed);
                showErrorFeedback('Toggle failed');
            } catch (stateError) {
                console.error("Failed to get state after toggle error:", stateError);
                // Last resort: reset to safe defaults
                updateUI(false, 10);
                showErrorFeedback('Toggle failed - reset to defaults');
            }
        }
    }

    /**
     * Show error feedback to user
     * @param {string} message - Error message to display
     */
    function showErrorFeedback(message) {
        console.error('User feedback:', message);
        // Visual feedback through button styling
        toggleBtn.style.backgroundColor = '#ff4444';
        toggleBtn.textContent = `Error: ${message}`;
        
        // Reset after 2 seconds
        setTimeout(() => {
            const currentState = speedState.getState();
            updateUI(currentState.isRunning, currentState.selectedSpeed);
        }, 2000);
    }

    // Initialize UI with current state after loading from storage with error handling
    try {
        const initialState = speedState.getState();
        
        // Validate initial state
        if (typeof initialState.isRunning !== 'boolean' || 
            typeof initialState.selectedSpeed !== 'number' ||
            ![5, 10, 20, 30].includes(initialState.selectedSpeed)) {
            console.error('Invalid initial state:', initialState);
            // Use safe defaults
            updateUI(false, 5);
            sendSpeedConfig(false, 5);
            showErrorFeedback('Invalid initial state - using defaults');
        } else {
            updateUI(initialState.isRunning, initialState.selectedSpeed);
            sendSpeedConfig(initialState.isRunning, initialState.selectedSpeed);
            console.log('Popup initialized successfully with state:', initialState);
        }
    } catch (error) {
        console.error('Error during popup initialization:', error);
        // Fallback to safe defaults
        updateUI(false, 5);
        sendSpeedConfig(false, 5);
        showErrorFeedback('Initialization failed');
    }

    // Add event listeners for speed selection buttons
    speedButtons.forEach(button => {
        button.addEventListener("click", async (e) => {
            const speed = parseInt(button.dataset.speed);
            await handleSpeedSelection(speed);
            
            // Visual feedback animation
            addButtonFeedback(button);
        });
    });

    // Enhanced toggle functionality
    toggleBtn.addEventListener("click", handleToggle);

    /**
     * Add visual feedback animation to a button
     * @param {HTMLElement} button - Button element to animate
     */
    function addButtonFeedback(button) {
        button.style.transform = "scale(0.95)";
        setTimeout(() => {
            button.style.transform = "scale(1)";
        }, 100);
    }

    /**
     * Find speed button by speed value
     * @param {number} speed - Speed value to find button for
     * @returns {HTMLElement|null} - Speed button element or null
     */
    function findSpeedButton(speed) {
        return Array.from(speedButtons).find(btn => parseInt(btn.dataset.speed) === speed);
    }

    // Enhanced keyboard shortcut support with error handling
    document.addEventListener("keydown", async (e) => {
        try {
            // Toggle functionality (Space/Enter)
            if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                await handleToggle();
            }
            // Speed selection shortcuts (1, 2, 3, 4)
            else if (e.key === "1") {
                e.preventDefault();
                await handleSpeedSelection(5);
                // Add visual feedback to corresponding button
                const speedBtn = findSpeedButton(5);
                if (speedBtn) addButtonFeedback(speedBtn);
            }
            else if (e.key === "2") {
                e.preventDefault();
                await handleSpeedSelection(10);
                // Add visual feedback to corresponding button
                const speedBtn = findSpeedButton(10);
                if (speedBtn) addButtonFeedback(speedBtn);
            }
            else if (e.key === "3") {
                e.preventDefault();
                await handleSpeedSelection(20);
                // Add visual feedback to corresponding button
                const speedBtn = findSpeedButton(20);
                if (speedBtn) addButtonFeedback(speedBtn);
            }
            else if (e.key === "4") {
                e.preventDefault();
                await handleSpeedSelection(30);
                // Add visual feedback to corresponding button
                const speedBtn = findSpeedButton(30);
                if (speedBtn) addButtonFeedback(speedBtn);
            }
        } catch (error) {
            console.error('Error handling keyboard shortcut:', e.key, error);
            showErrorFeedback(`Keyboard shortcut failed: ${e.key}`);
        }
    });
});
