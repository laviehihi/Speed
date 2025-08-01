/**
 * SpeedState class manages the speed selection, running state, and persistence
 * for the Enhanced Speed Control feature.
 */
class SpeedState {
    constructor() {
        // Default configuration
        this.isRunning = false;
        this.selectedSpeed = 5; // Default to x5 speed
        this.availableSpeeds = [5, 10, 20, 30]; // Allowed speed options
        this.speedPresets = {
            x5: 5,
            x10: 10,
            x20: 20,
            x30: 30
        };
        
        // Storage keys for persistence
        this.storageKeys = {
            isRunning: 'isRunning',
            selectedSpeed: 'selectedSpeed',
            speedPresets: 'speedPresets'
        };
    }

    /**
     * Initialize the speed state by loading from storage with comprehensive error handling
     * @returns {Promise<void>}
     */
    async initialize() {
        console.log('Initializing SpeedState...');
        
        try {
            const result = await this._getFromStorage([
                this.storageKeys.isRunning,
                this.storageKeys.selectedSpeed,
                this.storageKeys.speedPresets
            ]);

            // Load running state with validation (maintain backward compatibility)
            if (typeof result.isRunning === 'boolean') {
                this.isRunning = result.isRunning;
            } else {
                console.warn('Invalid isRunning value from storage, using default:', result.isRunning);
                this.isRunning = false;
            }

            // Load selected speed with comprehensive validation
            if (result.selectedSpeed !== undefined) {
                if (this._isValidSpeed(result.selectedSpeed)) {
                    this.selectedSpeed = result.selectedSpeed;
                    console.log('Loaded valid speed from storage:', result.selectedSpeed);
                } else {
                    console.warn('Invalid speed from storage, using default:', result.selectedSpeed);
                    this.selectedSpeed = 5; // Default to x5 speed
                    // Try to fix corrupted storage
                    await this._saveToStorage({ [this.storageKeys.selectedSpeed]: 10 }).catch(err => {
                        console.error('Failed to fix corrupted speed in storage:', err);
                    });
                }
            } else {
                console.log('No speed found in storage, using default');
                this.selectedSpeed = 5; // Default to x5 speed
            }

            // Load speed presets with validation
            if (result.speedPresets && typeof result.speedPresets === 'object') {
                // Validate each preset value
                const validPresets = {};
                for (const [key, value] of Object.entries(result.speedPresets)) {
                    if (typeof value === 'number' && value > 0) {
                        validPresets[key] = value;
                    } else {
                        console.warn('Invalid preset value, skipping:', key, value);
                    }
                }
                this.speedPresets = { ...this.speedPresets, ...validPresets };
            } else if (result.speedPresets !== undefined) {
                console.warn('Invalid speedPresets from storage, using defaults:', result.speedPresets);
            }

            console.log('SpeedState initialized successfully:', {
                isRunning: this.isRunning,
                selectedSpeed: this.selectedSpeed,
                speedPresets: this.speedPresets
            });

        } catch (error) {
            console.error('Failed to initialize SpeedState from storage:', error);
            
            // Fallback to defaults with graceful degradation
            this.isRunning = false;
            this.selectedSpeed = 5; // Default to x5 speed
            this.speedPresets = {
                x5: 5,
                x10: 10,
                x20: 20,
                x30: 30
            };
            
            console.log('SpeedState initialized with fallback defaults:', {
                isRunning: this.isRunning,
                selectedSpeed: this.selectedSpeed,
                speedPresets: this.speedPresets
            });
            
            // Try to initialize storage with defaults for future use
            try {
                await this._saveToStorage({
                    [this.storageKeys.isRunning]: this.isRunning,
                    [this.storageKeys.selectedSpeed]: this.selectedSpeed,
                    [this.storageKeys.speedPresets]: this.speedPresets
                });
                console.log('Default values saved to storage for future use');
            } catch (saveError) {
                console.error('Failed to save default values to storage:', saveError);
                // Continue without storage - extension will work with in-memory state
            }
        }
    }

    /**
     * Set the selected speed with validation
     * @param {number} speed - The speed multiplier to set
     * @returns {Promise<boolean>} - True if speed was set successfully
     */
    async setSpeed(speed) {
        if (!this._isValidSpeed(speed)) {
            console.error('Invalid speed value:', speed, 'Allowed values:', this.availableSpeeds);
            return false;
        }

        const previousSpeed = this.selectedSpeed;
        this.selectedSpeed = speed;

        try {
            await this._saveToStorage({ [this.storageKeys.selectedSpeed]: speed });
            console.log('Speed changed from', previousSpeed, 'to', speed);
            return true;
        } catch (error) {
            console.error('Failed to save speed to storage:', error);
            // Revert on storage failure
            this.selectedSpeed = previousSpeed;
            return false;
        }
    }

    /**
     * Toggle the running state of the speed hack
     * @returns {Promise<boolean>} - The new running state
     */
    async toggle() {
        const newRunningState = !this.isRunning;
        
        try {
            await this._saveToStorage({ [this.storageKeys.isRunning]: newRunningState });
            this.isRunning = newRunningState;
            console.log('Speed hack toggled:', newRunningState ? 'ON' : 'OFF', 'at speed:', this.selectedSpeed);
            return this.isRunning;
        } catch (error) {
            console.error('Failed to toggle speed state:', error);
            return this.isRunning; // Return current state on error
        }
    }

    /**
     * Get the current effective speed (1 if stopped, selectedSpeed if running)
     * @returns {number} - The current effective speed multiplier
     */
    getCurrentSpeed() {
        return this.isRunning ? this.selectedSpeed : 1;
    }

    /**
     * Get the current state as an object
     * @returns {Object} - Current state object
     */
    getState() {
        return {
            isRunning: this.isRunning,
            selectedSpeed: this.selectedSpeed,
            currentSpeed: this.getCurrentSpeed(),
            availableSpeeds: [...this.availableSpeeds],
            speedPresets: { ...this.speedPresets }
        };
    }

    /**
     * Set the running state without toggling
     * @param {boolean} isRunning - The running state to set
     * @returns {Promise<boolean>} - True if state was set successfully
     */
    async setRunning(isRunning) {
        if (typeof isRunning !== 'boolean') {
            console.error('Invalid running state:', isRunning);
            return false;
        }

        try {
            await this._saveToStorage({ [this.storageKeys.isRunning]: isRunning });
            this.isRunning = isRunning;
            console.log('Running state set to:', isRunning);
            return true;
        } catch (error) {
            console.error('Failed to set running state:', error);
            return false;
        }
    }

    /**
     * Persist the current state to storage
     * @returns {Promise<boolean>} - True if persistence was successful
     */
    async persist() {
        try {
            const stateToSave = {
                [this.storageKeys.isRunning]: this.isRunning,
                [this.storageKeys.selectedSpeed]: this.selectedSpeed,
                [this.storageKeys.speedPresets]: this.speedPresets
            };

            await this._saveToStorage(stateToSave);
            console.log('SpeedState persisted successfully');
            return true;
        } catch (error) {
            console.error('Failed to persist SpeedState:', error);
            return false;
        }
    }

    /**
     * Validate if a speed value is allowed
     * @param {number} speed - The speed value to validate
     * @returns {boolean} - True if speed is valid
     * @private
     */
    _isValidSpeed(speed) {
        // Comprehensive validation against allowed options (10, 20, 30)
        if (typeof speed !== 'number') {
            console.warn('Speed validation failed: not a number', speed);
            return false;
        }
        
        if (!Number.isFinite(speed)) {
            console.warn('Speed validation failed: not finite', speed);
            return false;
        }
        
        if (speed <= 0) {
            console.warn('Speed validation failed: not positive', speed);
            return false;
        }
        
        if (!this.availableSpeeds.includes(speed)) {
            console.warn('Speed validation failed: not in allowed options', speed, 'Allowed:', this.availableSpeeds);
            return false;
        }
        
        return true;
    }

    /**
     * Get data from Chrome storage with comprehensive error handling
     * @param {string|string[]} keys - Storage keys to retrieve
     * @returns {Promise<Object>} - Storage data
     * @private
     */
    _getFromStorage(keys) {
        return new Promise((resolve, reject) => {
            // Check if Chrome storage API is available
            if (typeof chrome === 'undefined') {
                const error = new Error('Chrome extension API not available');
                console.error('Storage error:', error.message);
                reject(error);
                return;
            }
            
            if (!chrome.storage || !chrome.storage.local) {
                const error = new Error('Chrome storage API not available');
                console.error('Storage error:', error.message);
                reject(error);
                return;
            }
            
            try {
                chrome.storage.local.get(keys, (result) => {
                    if (chrome.runtime.lastError) {
                        const error = new Error(`Storage get failed: ${chrome.runtime.lastError.message}`);
                        console.error('Storage error:', error.message);
                        reject(error);
                    } else {
                        console.log('Storage get successful:', keys, result);
                        resolve(result || {});
                    }
                });
            } catch (error) {
                console.error('Storage get exception:', error);
                reject(new Error(`Storage get exception: ${error.message}`));
            }
        });
    }

    /**
     * Save data to Chrome storage with comprehensive error handling
     * @param {Object} data - Data to save
     * @returns {Promise<void>}
     * @private
     */
    _saveToStorage(data) {
        return new Promise((resolve, reject) => {
            // Check if Chrome storage API is available
            if (typeof chrome === 'undefined') {
                const error = new Error('Chrome extension API not available');
                console.error('Storage error:', error.message);
                reject(error);
                return;
            }
            
            if (!chrome.storage || !chrome.storage.local) {
                const error = new Error('Chrome storage API not available');
                console.error('Storage error:', error.message);
                reject(error);
                return;
            }
            
            // Validate data before saving
            if (!data || typeof data !== 'object') {
                const error = new Error('Invalid data for storage: must be an object');
                console.error('Storage error:', error.message);
                reject(error);
                return;
            }
            
            try {
                chrome.storage.local.set(data, () => {
                    if (chrome.runtime.lastError) {
                        const error = new Error(`Storage set failed: ${chrome.runtime.lastError.message}`);
                        console.error('Storage error:', error.message);
                        reject(error);
                    } else {
                        console.log('Storage set successful:', data);
                        resolve();
                    }
                });
            } catch (error) {
                console.error('Storage set exception:', error);
                reject(new Error(`Storage set exception: ${error.message}`));
            }
        });
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpeedState;
}