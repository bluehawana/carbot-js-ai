const EventEmitter = require('events');

class TapToWakeService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            tapThreshold: options.tapThreshold || 0.7,
            doubleTapDelay: options.doubleTapDelay || 300,
            longPressDelay: options.longPressDelay || 800,
            steeringWheelEnabled: options.steeringWheelEnabled ?? true,
            voiceButtonEnabled: options.voiceButtonEnabled ?? true,
            accelerometerEnabled: options.accelerometerEnabled ?? true,
            sensitivityLevel: options.sensitivityLevel || 'medium',
            enableGestures: options.enableGestures ?? true,
            ...options
        };
        
        this.state = {
            isListening: false,
            isActive: false,
            lastTapTime: 0,
            tapCount: 0,
            longPressTimer: null,
            gestureSequence: [],
            currentButton: null,
            pressStartTime: 0
        };
        
        // Steering wheel button mappings
        this.buttonMappings = {
            voice: { id: 'voice', name: 'Voice Button', action: 'activate_voice' },
            prev: { id: 'prev', name: 'Previous Track', action: 'music_previous' },
            next: { id: 'next', name: 'Next Track', action: 'music_next' },
            volUp: { id: 'volUp', name: 'Volume Up', action: 'volume_up' },
            volDown: { id: 'volDown', name: 'Volume Down', action: 'volume_down' },
            phone: { id: 'phone', name: 'Phone', action: 'phone_toggle' },
            cruise: { id: 'cruise', name: 'Cruise Control', action: 'cruise_control' },
            menu: { id: 'menu', name: 'Menu', action: 'show_menu' }
        };
        
        this.accelerometerData = {
            x: 0, y: 0, z: 0,
            lastUpdate: Date.now(),
            threshold: this.getSensitivityThreshold()
        };
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        // Simulate steering wheel buttons for development
        this.simulateSteeringWheelButtons();
        
        // Listen for accelerometer data if available
        if (this.options.accelerometerEnabled) {
            this.initializeAccelerometer();
        }
    }
    
    simulateSteeringWheelButtons() {
        if (typeof document !== 'undefined') {
            // Create virtual steering wheel interface
            this.createVirtualSteeringWheel();
            
            // Listen for keyboard shortcuts (for development)
            document.addEventListener('keydown', (event) => {
                this.handleKeyboardInput(event);
            });
            
            document.addEventListener('keyup', (event) => {
                this.handleKeyboardRelease(event);
            });
        }
    }
    
    createVirtualSteeringWheel() {
        const steeringWheel = document.createElement('div');
        steeringWheel.id = 'virtual-steering-wheel';
        steeringWheel.style.cssText = 'position: fixed; bottom: 20px; left: 20px; width: 300px; height: 200px; background: rgba(0,0,0,0.8); border-radius: 15px; border: 2px solid #333; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; padding: 15px; z-index: 10000; color: white; font-family: Arial, sans-serif;';
        
        // Create buttons
        const buttons = [
            { id: 'voice', label: '🎤 Voice', key: 'Space' },
            { id: 'prev', label: '⏮️ Prev', key: 'ArrowLeft' },
            { id: 'next', label: '⏭️ Next', key: 'ArrowRight' },
            { id: 'volUp', label: '🔊 Vol+', key: 'ArrowUp' },
            { id: 'volDown', label: '🔉 Vol-', key: 'ArrowDown' },
            { id: 'phone', label: '📞 Phone', key: 'Enter' },
            { id: 'menu', label: '📋 Menu', key: 'KeyM' },
            { id: 'cruise', label: '🚗 Cruise', key: 'KeyC' }
        ];
        
        buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.id = `sw-${button.id}`;
            btn.textContent = button.label;
            btn.title = `Press ${button.key}`;
            btn.style.cssText = 'background: #333; color: white; border: 1px solid #555; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-size: 12px; transition: all 0.2s; user-select: none;';
            
            btn.addEventListener('mousedown', () => {
                this.handleButtonPress(button.id);
                btn.style.background = '#0080FF';
            });
            
            btn.addEventListener('mouseup', () => {
                this.handleButtonRelease(button.id);
                btn.style.background = '#333';
            });
            
            btn.addEventListener('mouseleave', () => {
                this.handleButtonRelease(button.id);
                btn.style.background = '#333';
            });
            
            steeringWheel.appendChild(btn);
        });
        
        // Add title
        const title = document.createElement('div');
        title.textContent = 'Virtual Steering Wheel Controls';
        title.style.cssText = 'width: 100%; text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 10px;';
        
        steeringWheel.insertBefore(title, steeringWheel.firstChild);
        document.body.appendChild(steeringWheel);
    }
    
    handleKeyboardInput(event) {
        const keyMap = {
            'Space': 'voice',
            'ArrowLeft': 'prev',
            'ArrowRight': 'next',
            'ArrowUp': 'volUp',
            'ArrowDown': 'volDown',
            'Enter': 'phone',
            'KeyM': 'menu',
            'KeyC': 'cruise'
        };
        
        const buttonId = keyMap[event.code];
        if (buttonId && !event.repeat) {
            event.preventDefault();
            this.handleButtonPress(buttonId);
            
            // Visual feedback
            const btn = document.getElementById(`sw-${buttonId}`);
            if (btn) btn.style.background = '#0080FF';
        }
    }
    
    handleKeyboardRelease(event) {
        const keyMap = {
            'Space': 'voice',
            'ArrowLeft': 'prev',
            'ArrowRight': 'next',
            'ArrowUp': 'volUp',
            'ArrowDown': 'volDown',
            'Enter': 'phone',
            'KeyM': 'menu',
            'KeyC': 'cruise'
        };
        
        const buttonId = keyMap[event.code];
        if (buttonId) {
            this.handleButtonRelease(buttonId);
            
            // Visual feedback
            const btn = document.getElementById(`sw-${buttonId}`);
            if (btn) btn.style.background = '#333';
        }
    }
    
    handleButtonPress(buttonId) {
        const now = Date.now();
        
        this.state.currentButton = buttonId;
        this.state.pressStartTime = now;
        
        // Clear any existing long press timer
        if (this.state.longPressTimer) {
            clearTimeout(this.state.longPressTimer);
        }
        
        // Set up long press detection
        this.state.longPressTimer = setTimeout(() => {
            this.handleLongPress(buttonId);
        }, this.options.longPressDelay);
        
        this.emit('buttonPress', {
            button: buttonId,
            timestamp: now,
            mapping: this.buttonMappings[buttonId]
        });
        
        console.log(`🎮 Button pressed: ${buttonId}`);
    }
    
    handleButtonRelease(buttonId) {
        const now = Date.now();
        const pressDuration = now - this.state.pressStartTime;
        
        // Clear long press timer
        if (this.state.longPressTimer) {
            clearTimeout(this.state.longPressTimer);
            this.state.longPressTimer = null;
        }
        
        if (this.state.currentButton !== buttonId) return;
        
        this.state.currentButton = null;
        
        // Determine if it was a tap, double tap, or long press
        if (pressDuration < this.options.longPressDelay) {
            this.handleTap(buttonId, now);
        }
        
        this.emit('buttonRelease', {
            button: buttonId,
            timestamp: now,
            duration: pressDuration,
            mapping: this.buttonMappings[buttonId]
        });
        
        console.log(`🎮 Button released: ${buttonId} (${pressDuration}ms)`);
    }
    
    handleTap(buttonId, timestamp) {
        const timeSinceLastTap = timestamp - this.state.lastTapTime;
        
        if (timeSinceLastTap < this.options.doubleTapDelay && this.state.tapCount > 0) {
            this.state.tapCount++;
        } else {
            this.state.tapCount = 1;
        }
        
        this.state.lastTapTime = timestamp;
        
        // Check for special patterns
        setTimeout(() => {
            if (this.state.tapCount === 1) {
                this.handleSingleTap(buttonId, timestamp);
            } else if (this.state.tapCount === 2) {
                this.handleDoubleTap(buttonId, timestamp);
            } else if (this.state.tapCount >= 3) {
                this.handleTripleTap(buttonId, timestamp);
            }
            
            this.state.tapCount = 0;
        }, this.options.doubleTapDelay + 50);
    }
    
    handleSingleTap(buttonId, timestamp) {
        const action = this.buttonMappings[buttonId]?.action;
        
        this.emit('singleTap', {
            button: buttonId,
            action: action,
            timestamp: timestamp
        });
        
        // Special handling for voice button
        if (buttonId === 'voice') {
            this.activateVoiceMode();
        } else {
            this.executeButtonAction(action);
        }
        
        console.log(`👆 Single tap: ${buttonId} -> ${action}`);
    }
    
    handleDoubleTap(buttonId, timestamp) {
        this.emit('doubleTap', {
            button: buttonId,
            timestamp: timestamp
        });
        
        // Special double-tap actions
        switch (buttonId) {
            case 'voice':
                this.activateQuickVoiceMode();
                break;
            case 'phone':
                this.redialLastNumber();
                break;
            default:
                this.handleSingleTap(buttonId, timestamp);
        }
        
        console.log(`👆👆 Double tap: ${buttonId}`);
    }
    
    handleTripleTap(buttonId, timestamp) {
        this.emit('tripleTap', {
            button: buttonId,
            timestamp: timestamp
        });
        
        // Special triple-tap actions
        switch (buttonId) {
            case 'voice':
                this.activateEmergencyMode();
                break;
            case 'phone':
                this.callEmergencyServices();
                break;
            default:
                this.handleDoubleTap(buttonId, timestamp);
        }
        
        console.log(`👆👆👆 Triple tap: ${buttonId}`);
    }
    
    handleLongPress(buttonId) {
        this.emit('longPress', {
            button: buttonId,
            timestamp: Date.now()
        });
        
        // Special long-press actions
        switch (buttonId) {
            case 'voice':
                this.activateContinuousListening();
                break;
            case 'menu':
                this.showAdvancedMenu();
                break;
            default:
                this.showButtonOptions(buttonId);
        }
        
        console.log(`👆⏰ Long press: ${buttonId}`);
    }
    
    // Voice activation methods
    activateVoiceMode() {
        this.state.isActive = true;
        this.state.isListening = true;
        
        this.emit('voiceActivated', {
            mode: 'normal',
            timestamp: Date.now()
        });
        
        console.log('🎤 Voice mode activated');
    }
    
    activateQuickVoiceMode() {
        this.state.isActive = true;
        this.state.isListening = true;
        
        this.emit('voiceActivated', {
            mode: 'quick',
            timestamp: Date.now(),
            timeout: 10000 // 10 second timeout for quick mode
        });
        
        console.log('🎤⚡ Quick voice mode activated');
    }
    
    activateContinuousListening() {
        this.state.isActive = true;
        this.state.isListening = true;
        
        this.emit('voiceActivated', {
            mode: 'continuous',
            timestamp: Date.now(),
            continuous: true
        });
        
        console.log('🎤🔄 Continuous listening activated');
    }
    
    activateEmergencyMode() {
        this.emit('emergencyActivated', {
            source: 'voice_triple_tap',
            timestamp: Date.now()
        });
        
        console.log('🚨 Emergency mode activated');
    }
    
    // Action execution methods
    executeButtonAction(action) {
        this.emit('buttonAction', {
            action: action,
            timestamp: Date.now()
        });
        
        switch (action) {
            case 'music_previous':
            case 'music_next':
            case 'volume_up':
            case 'volume_down':
            case 'phone_toggle':
            case 'cruise_control':
            case 'show_menu':
                console.log(`🎯 Executing action: ${action}`);
                break;
            default:
                console.log(`❓ Unknown action: ${action}`);
        }
    }
    
    callEmergencyServices() {
        this.emit('emergencyCall', {
            timestamp: Date.now(),
            source: 'steering_wheel'
        });
        
        console.log('🚨📞 Emergency services called');
    }
    
    redialLastNumber() {
        this.emit('phoneAction', {
            action: 'redial',
            timestamp: Date.now()
        });
        
        console.log('📞🔄 Redialing last number');
    }
    
    showAdvancedMenu() {
        this.emit('menuAction', {
            action: 'show_advanced',
            timestamp: Date.now()
        });
        
        console.log('📋⚙️ Showing advanced menu');
    }
    
    showButtonOptions(buttonId) {
        this.emit('menuAction', {
            action: 'show_button_options',
            button: buttonId,
            timestamp: Date.now()
        });
        
        console.log(`📋🎮 Showing options for ${buttonId}`);
    }
    
    // Accelerometer integration
    initializeAccelerometer() {
        if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', (event) => {
                this.handleAccelerometerData(event.accelerationIncludingGravity);
            });
        }
    }
    
    handleAccelerometerData(acceleration) {
        if (!acceleration) return;
        
        const { x, y, z } = acceleration;
        const magnitude = Math.sqrt(x*x + y*y + z*z);
        
        if (magnitude > this.accelerometerData.threshold) {
            this.handleTapGesture(magnitude);
        }
        
        this.accelerometerData = { x, y, z, lastUpdate: Date.now() };
    }
    
    handleTapGesture(magnitude) {
        const now = Date.now();
        
        // Debounce rapid taps
        if (now - this.state.lastTapTime < 200) return;
        
        this.emit('tapGesture', {
            magnitude: magnitude,
            timestamp: now,
            threshold: this.accelerometerData.threshold
        });
        
        // If no buttons are being pressed, treat as voice activation
        if (!this.state.currentButton) {
            this.activateVoiceMode();
        }
        
        console.log(`📱 Tap gesture detected (magnitude: ${magnitude.toFixed(2)})`);
    }
    
    getSensitivityThreshold() {
        const thresholds = {
            low: 15,
            medium: 12,
            high: 8
        };
        
        return thresholds[this.options.sensitivityLevel] || thresholds.medium;
    }
    
    // Configuration methods
    setSensitivity(level) {
        this.options.sensitivityLevel = level;
        this.accelerometerData.threshold = this.getSensitivityThreshold();
        
        this.emit('sensitivityChanged', {
            level: level,
            threshold: this.accelerometerData.threshold
        });
        
        console.log(`⚙️ Sensitivity set to ${level}`);
    }
    
    // State management
    deactivateVoice() {
        this.state.isActive = false;
        this.state.isListening = false;
        
        this.emit('voiceDeactivated', {
            timestamp: Date.now()
        });
        
        console.log('🎤🔇 Voice mode deactivated');
    }
    
    getState() {
        return {
            ...this.state,
            options: { ...this.options },
            accelerometer: { ...this.accelerometerData }
        };
    }
    
    destroy() {
        // Clear timers
        if (this.state.longPressTimer) {
            clearTimeout(this.state.longPressTimer);
        }
        
        // Remove virtual steering wheel
        const virtualWheel = document.getElementById('virtual-steering-wheel');
        if (virtualWheel) {
            virtualWheel.remove();
        }
        
        this.removeAllListeners();
        console.log('🗑️ Tap-to-wake service destroyed');
    }
}

module.exports = TapToWakeService;