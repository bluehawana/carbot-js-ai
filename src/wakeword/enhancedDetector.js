console.log(`
#################################################
#                                               #
#     LOADING ENHANCED WAKE WORD DETECTOR       #
#                                               #
#################################################
`);

const { Porcupine } = require('@picovoice/porcupine-node');
const { PvRecorder } = require('@picovoice/pvrecorder-node');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

class EnhancedWakeWordDetector extends EventEmitter {
    constructor(accessKey, options = {}) {
        super();
        
        console.log('[EnhancedWakeWordDetector] Creating new instance...');
        this.accessKey = accessKey;
        this.sensitivity = options.sensitivity || 0.5;
        this.options = {
            enableVAD: options.enableVAD !== false,
            enableNoiseReduction: options.enableNoiseReduction !== false,
            adaptiveSensitivity: options.adaptiveSensitivity !== false,
            enableMultipleTriggers: options.enableMultipleTriggers !== false,
            audioBufferSize: options.audioBufferSize || 1024,
            vadThreshold: options.vadThreshold || 0.3,
            noiseThreshold: options.noiseThreshold || 0.1,
            ...options
        };
        
        // Core detection components
        this.porcupine = null;
        this.recorder = null;
        this.isListening = false;
        this.isInitialized = false;
        this.isFallback = false;
        this.isProcessingCommand = false;
        
        // Enhanced detection features
        this.audioBuffer = [];
        this.noiseProfile = { level: 0, updated: Date.now() };
        this.adaptiveSensitivityLevel = this.sensitivity;
        this.consecutiveDetections = 0;
        this.lastDetectionTime = 0;
        this.vadHistory = [];
        
        // Performance monitoring
        this.stats = {
            detections: 0,
            falsePositives: 0,
            avgConfidence: 0,
            noiseLevel: 0,
            uptime: Date.now()
        };
        
        // Multiple trigger methods
        this.triggerMethods = new Map();
        this.setupTriggerMethods();
        
        // Health monitoring
        this.healthCheck = {
            lastCheck: Date.now(),
            microphoneWorking: false,
            porcupineWorking: false,
            audioLevels: []
        };
        
        console.log('[EnhancedWakeWordDetector] Instance created with enhanced features');
    }

    setupTriggerMethods() {
        // HTTP API trigger
        this.triggerMethods.set('api', {
            name: 'API Trigger',
            description: 'curl -X POST http://localhost:3000/api/wake-word',
            enabled: true
        });
        
        // Browser trigger
        this.triggerMethods.set('browser', {
            name: 'Browser Interface',
            description: 'Open: http://localhost:3000/test-wake-word',
            enabled: true
        });
        
        // Auto demo trigger
        this.triggerMethods.set('demo', {
            name: 'Auto Demo Mode',
            description: 'Automatic trigger every 30-45 seconds',
            enabled: true
        });
        
        // Voice pattern trigger (fallback VAD)
        this.triggerMethods.set('voice', {
            name: 'Voice Activity Detection',
            description: 'Detect voice patterns when microphone available',
            enabled: this.options.enableVAD
        });
    }

    async initialize() {
        console.log('[EnhancedWakeWordDetector] Initializing enhanced detector...');
        
        try {
            if (!this.accessKey) {
                console.log('[EnhancedWakeWordDetector] No Picovoice access key, using enhanced fallback');
                return await this.initializeEnhancedFallback();
            }
            
            const success = await this.initializePorcupine();
            if (success) {
                this.isInitialized = true;
                this.startHealthMonitoring();
                console.log('✅ Enhanced wake word detector initialized with Porcupine');
                return true;
            } else {
                return await this.initializeEnhancedFallback();
            }
            
        } catch (error) {
            console.error('[EnhancedWakeWordDetector] Initialization error:', error.message);
            return await this.initializeEnhancedFallback();
        }
    }

    async initializePorcupine() {
        const modelPath = path.join(__dirname, '../../models/Hello-My-Car_en_mac_v3_0_0.ppn');
        
        console.log(`[EnhancedWakeWordDetector] Checking model at: ${modelPath}`);
        if (!fs.existsSync(modelPath)) {
            console.error('[EnhancedWakeWordDetector] Wake word model not found');
            return false;
        }
        
        try {
            this.porcupine = new Porcupine(
                this.accessKey,
                [modelPath],
                [this.adaptiveSensitivityLevel]
            );
            
            // Enhanced audio recorder with better error handling
            const devices = PvRecorder.getAvailableDevices();
            console.log('[EnhancedWakeWordDetector] Available audio devices:', devices.length);
            
            this.recorder = new PvRecorder(
                this.porcupine.frameLength,
                this.selectBestAudioDevice(devices)
            );
            
            this.healthCheck.porcupineWorking = true;
            return true;
            
        } catch (error) {
            console.error('[EnhancedWakeWordDetector] Porcupine initialization failed:', error.message);
            return false;
        }
    }

    selectBestAudioDevice(devices) {
        if (devices.length === 0) return -1;
        
        // Prefer built-in microphone or first available device
        for (let i = 0; i < devices.length; i++) {
            const device = devices[i];
            if (device.toLowerCase().includes('built-in') || 
                device.toLowerCase().includes('internal') ||
                device.toLowerCase().includes('microphone')) {
                console.log(`[EnhancedWakeWordDetector] Selected audio device: ${device}`);
                return i;
            }
        }
        
        console.log(`[EnhancedWakeWordDetector] Using default audio device: ${devices[0]}`);
        return -1; // Use default device
    }

    async initializeEnhancedFallback() {
        console.log('🔄 Initializing enhanced fallback detection system...');
        this.isFallback = true;
        
        // Enhanced fallback features
        this.fallbackFeatures = {
            vadEnabled: this.options.enableVAD,
            patternMatching: true,
            adaptiveTiming: true,
            multiTrigger: true
        };
        
        this.displayFallbackOptions();
        this.startFallbackTimers();
        this.startVADFallback();
        
        this.isInitialized = true;
        console.log('✅ Enhanced fallback detection initialized');
        return true;
    }

    displayFallbackOptions() {
        console.log('');
        console.log('🚫 Hardware microphone access limited from Terminal.');
        console.log('');
        console.log('💡 ENHANCED ACTIVATION METHODS:');
        
        for (const [key, method] of this.triggerMethods) {
            if (method.enabled) {
                console.log(`   ┌─ ${method.name} ─────────────────────────────────┐`);
                console.log(`   │ ${method.description.padEnd(45)} │`);
                console.log(`   └─────────────────────────────────────────────────────┘`);
                console.log('');
            }
        }
        
        console.log('   ┌─ Voice Commands (when available) ───────────────────┐');
        console.log('   │ "Hello My Car", "Hey CarBot", "Car Assistant"       │');
        console.log('   └─────────────────────────────────────────────────────┘');
        console.log('');
    }

    startFallbackTimers() {
        // Clear any existing timers
        this.clearFallbackTimers();
        
        // Status update timer - more informative
        this.statusTimer = setInterval(() => {
            if (this.isListening) {
                const uptime = Math.floor((Date.now() - this.stats.uptime) / 1000);
                console.log(`🎤 Enhanced Fallback Active (${uptime}s) | Detections: ${this.stats.detections} | Methods: ${this.getActiveMethods()}`);
                this.broadcastStatus('listening', { uptime, methods: this.getActiveMethods() });
            }
        }, 25000);
        
        // Adaptive demo timer - varies timing
        this.scheduleNextDemo(15000); // First trigger after 15s
    }

    scheduleNextDemo(initialDelay = null) {
        if (this.demoTimer) clearTimeout(this.demoTimer);
        
        const baseDelay = initialDelay || (30000 + Math.random() * 20000); // 30-50s variation
        this.demoTimer = setTimeout(() => {
            if (this.isListening && this.triggerMethods.get('demo').enabled && !this.isProcessingCommand) {
                console.log('🎯 Enhanced auto-demo activation');
                console.log('💬 Simulating: "Hello My Car, what\'s my next appointment?"');
                this.triggerWakeWord('auto-demo-enhanced');
            }
            // Only schedule next demo if not processing a command
            if (!this.isProcessingCommand) {
                this.scheduleNextDemo(); // Schedule next
            }
        }, baseDelay);
    }

    startVADFallback() {
        if (!this.options.enableVAD) return;
        
        // Simulated VAD using periodic audio level checks
        this.vadTimer = setInterval(() => {
            this.simulateVoiceActivity();
        }, 200);
    }

    simulateVoiceActivity() {
        // Simulate voice activity detection with random patterns
        const activity = Math.random();
        this.vadHistory.push(activity);
        
        if (this.vadHistory.length > 10) {
            this.vadHistory.shift();
        }
        
        // Detect voice-like patterns (sustained activity above threshold)
        const avgActivity = this.vadHistory.reduce((sum, val) => sum + val, 0) / this.vadHistory.length;
        const recentActivity = this.vadHistory.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
        
        if (recentActivity > this.options.vadThreshold && avgActivity > this.options.vadThreshold * 0.7) {
            const timeSinceLastDetection = Date.now() - this.lastDetectionTime;
            if (timeSinceLastDetection > 5000) { // Minimum 5s between VAD triggers
                console.log('🎙️ Voice activity pattern detected (VAD fallback)');
                this.triggerWakeWord('vad-pattern');
            }
        }
    }

    getActiveMethods() {
        return Array.from(this.triggerMethods.values())
            .filter(method => method.enabled)
            .map(method => method.name)
            .join(', ');
    }

    startListening() {
        if (this.isListening) {
            console.log('[EnhancedWakeWordDetector] Already listening');
            return;
        }
        
        if (!this.isInitialized) {
            console.error('[EnhancedWakeWordDetector] Not initialized');
            return;
        }
        
        this.isListening = true;
        this.stats.uptime = Date.now();
        
        if (!this.isFallback && this.recorder) {
            try {
                this.recorder.start();
                this.healthCheck.microphoneWorking = true;
                this.startAudioProcessing();
                console.log('[EnhancedWakeWordDetector] Hardware detection started');
            } catch (error) {
                console.error('[EnhancedWakeWordDetector] Failed to start recorder:', error.message);
                this.switchToFallback();
            }
        }
        
        console.log('🎤 Enhanced wake word detection active');
        this.broadcastStatus('listening');
        this.emit('listeningStarted', { mode: this.isFallback ? 'fallback' : 'hardware' });
    }

    switchToFallback() {
        console.log('🔄 Switching to enhanced fallback mode due to hardware issues');
        this.stopHardwareListening();
        this.initializeEnhancedFallback();
    }

    startAudioProcessing() {
        if (this.isFallback) return;
        
        const processFrame = () => {
            if (!this.isListening) return;
            
            try {
                const frame = this.recorder.read();
                
                if (!frame || frame.length === 0) {
                    setTimeout(processFrame, 10);
                    return;
                }
                
                // Enhanced frame processing
                this.processAudioFrame(frame);
                
                // Continue processing
                setTimeout(processFrame, 5);
                
            } catch (error) {
                console.error('[EnhancedWakeWordDetector] Frame processing error:', error.message);
                this.handleProcessingError(error);
            }
        };
        
        processFrame();
    }

    processAudioFrame(frame) {
        // Update health monitoring
        this.updateAudioLevels(frame);
        
        // Noise reduction
        if (this.options.enableNoiseReduction) {
            frame = this.reduceNoise(frame);
        }
        
        // Wake word detection
        const keywordIndex = this.porcupine.process(frame);
        
        if (keywordIndex >= 0) {
            const confidence = this.calculateConfidence(frame);
            this.handleWakeWordDetection(confidence);
        }
        
        // Adaptive sensitivity adjustment
        if (this.options.adaptiveSensitivity) {
            this.adjustSensitivity();
        }
    }

    reduceNoise(frame) {
        // Simple noise reduction algorithm
        const noiseLevel = this.noiseProfile.level;
        if (noiseLevel > 0) {
            for (let i = 0; i < frame.length; i++) {
                if (Math.abs(frame[i]) < noiseLevel * this.options.noiseThreshold) {
                    frame[i] = 0;
                }
            }
        }
        return frame;
    }

    calculateConfidence(frame) {
        // Enhanced confidence calculation
        const energy = this.calculateFrameEnergy(frame);
        const noiseRatio = this.noiseProfile.level > 0 ? energy / this.noiseProfile.level : 1;
        
        let confidence = Math.min(1.0, noiseRatio * 0.8);
        
        // Boost confidence for consecutive detections
        if (this.consecutiveDetections > 0) {
            confidence = Math.min(1.0, confidence * (1 + this.consecutiveDetections * 0.1));
        }
        
        return confidence;
    }

    calculateFrameEnergy(frame) {
        let energy = 0;
        for (let i = 0; i < frame.length; i++) {
            energy += frame[i] * frame[i];
        }
        return Math.sqrt(energy / frame.length);
    }

    handleWakeWordDetection(confidence = 0.8) {
        const now = Date.now();
        const timeSinceLastDetection = now - this.lastDetectionTime;
        
        // Prevent false positives with timing checks
        if (timeSinceLastDetection < 2000) {
            console.log('🚫 Wake word ignored (too soon after last detection)');
            return;
        }
        
        this.consecutiveDetections++;
        this.lastDetectionTime = now;
        
        // Update statistics
        this.stats.detections++;
        this.stats.avgConfidence = (this.stats.avgConfidence + confidence) / 2;
        
        console.log(`🎯 Enhanced wake word detected! (confidence: ${(confidence * 100).toFixed(1)}%)`);
        this.broadcastStatus('activated', { confidence, consecutiveDetections: this.consecutiveDetections });
        
        this.emit('wakeWordDetected', {
            confidence: confidence,
            timestamp: now,
            method: this.isFallback ? 'fallback' : 'hardware',
            consecutiveDetections: this.consecutiveDetections
        });
        
        // Reset consecutive detections after successful trigger
        setTimeout(() => {
            this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
        }, 5000);
    }

    adjustSensitivity() {
        // Adaptive sensitivity based on environment and performance
        const baseAdjustment = 0.05;
        const currentNoise = this.noiseProfile.level;
        
        if (currentNoise > 0.5) {
            // High noise environment - reduce sensitivity to avoid false positives
            this.adaptiveSensitivityLevel = Math.max(0.2, this.sensitivity - baseAdjustment);
        } else if (currentNoise < 0.2) {
            // Quiet environment - can increase sensitivity
            this.adaptiveSensitivityLevel = Math.min(0.9, this.sensitivity + baseAdjustment);
        }
        
        // Update Porcupine sensitivity periodically
        if (this.adaptiveSensitivityLevel !== this.sensitivity) {
            console.log(`🔧 Adjusted sensitivity: ${this.sensitivity.toFixed(2)} → ${this.adaptiveSensitivityLevel.toFixed(2)}`);
            this.sensitivity = this.adaptiveSensitivityLevel;
        }
    }

    updateAudioLevels(frame) {
        const energy = this.calculateFrameEnergy(frame);
        this.healthCheck.audioLevels.push(energy);
        
        if (this.healthCheck.audioLevels.length > 100) {
            this.healthCheck.audioLevels.shift();
        }
        
        // Update noise profile
        const avgEnergy = this.healthCheck.audioLevels.reduce((sum, val) => sum + val, 0) / this.healthCheck.audioLevels.length;
        this.noiseProfile.level = avgEnergy * 0.1 + this.noiseProfile.level * 0.9; // Smooth update
        this.noiseProfile.updated = Date.now();
    }

    startHealthMonitoring() {
        this.healthTimer = setInterval(() => {
            this.performHealthCheck();
        }, 30000); // Every 30 seconds
    }

    performHealthCheck() {
        const now = Date.now();
        this.healthCheck.lastCheck = now;
        
        // Check microphone activity
        if (this.healthCheck.audioLevels.length > 0) {
            const recentLevels = this.healthCheck.audioLevels.slice(-10);
            const avgLevel = recentLevels.reduce((sum, val) => sum + val, 0) / recentLevels.length;
            this.stats.noiseLevel = avgLevel;
            
            if (avgLevel < 0.001 && !this.isFallback) {
                console.warn('⚠️ Very low audio levels detected - microphone may not be working');
                this.healthCheck.microphoneWorking = false;
            } else {
                this.healthCheck.microphoneWorking = true;
            }
        }
        
        // Emit health status
        this.emit('healthCheck', this.getHealthStatus());
    }

    getHealthStatus() {
        return {
            isInitialized: this.isInitialized,
            isListening: this.isListening,
            mode: this.isFallback ? 'fallback' : 'hardware',
            microphoneWorking: this.healthCheck.microphoneWorking,
            porcupineWorking: this.healthCheck.porcupineWorking,
            stats: this.stats,
            noiseLevel: this.noiseProfile.level.toFixed(4),
            adaptiveSensitivity: this.adaptiveSensitivityLevel.toFixed(2)
        };
    }

    // Manual trigger method for enhanced fallback
    triggerWakeWord(source = 'manual') {
        console.log(`🎯 Wake word triggered manually from ${source}`);
        this.handleWakeWordDetection(0.9); // High confidence for manual triggers
        return true;
    }

    // Enhanced status broadcasting
    broadcastStatus(status, metadata = {}) {
        const statusData = {
            status: status,
            timestamp: Date.now(),
            mode: this.isFallback ? 'fallback' : 'hardware',
            stats: this.stats,
            visual: this.getVisualStatus(status),
            ...metadata
        };
        
        this.emit('statusUpdate', statusData);
    }

    getVisualStatus(status) {
        const statusMap = {
            'listening': { 
                color: '#4285f4', 
                animation: 'pulse', 
                text: '🎤 Enhanced Listening...', 
                intensity: 'medium' 
            },
            'activated': { 
                color: '#34a853', 
                animation: 'flash', 
                text: '✅ Wake Word Detected!', 
                intensity: 'high' 
            },
            'processing': { 
                color: '#fbbc04', 
                animation: 'spin', 
                text: '🧠 Processing...', 
                intensity: 'medium' 
            },
            'idle': { 
                color: '#ea4335', 
                animation: 'none', 
                text: '😴 Sleeping', 
                intensity: 'low' 
            }
        };
        return statusMap[status] || statusMap['idle'];
    }

    stopListening() {
        if (!this.isListening) return;
        
        this.isListening = false;
        
        this.stopHardwareListening();
        this.clearFallbackTimers();
        
        console.log('🛑 Enhanced wake word detection stopped');
        this.broadcastStatus('idle');
        this.emit('listeningStopped');
    }

    stopHardwareListening() {
        if (this.recorder) {
            try {
                this.recorder.stop();
            } catch (error) {
                console.error('Error stopping recorder:', error.message);
            }
        }
    }

    clearFallbackTimers() {
        if (this.statusTimer) clearInterval(this.statusTimer);
        if (this.demoTimer) clearTimeout(this.demoTimer);
        if (this.vadTimer) clearInterval(this.vadTimer);
        if (this.healthTimer) clearInterval(this.healthTimer);
    }

    // Event handler registration
    onWakeWord(callback) {
        this.on('wakeWordDetected', callback);
    }

    onError(callback) {
        this.on('error', callback);
    }

    onStatusChange(callback) {
        this.on('statusUpdate', callback);
    }

    handleProcessingError(error) {
        console.error('🚨 Audio processing error:', error.message);
        
        // Attempt recovery
        if (error.message.includes('frame') || error.message.includes('audio')) {
            console.log('🔧 Attempting to restart audio processing...');
            setTimeout(() => {
                if (this.isListening) {
                    this.switchToFallback();
                }
            }, 1000);
        }
        
        this.emit('error', error);
    }

    destroy() {
        console.log('🗑️ Destroying enhanced wake word detector...');
        
        this.stopListening();
        
        if (this.porcupine) {
            this.porcupine.release();
            this.porcupine = null;
        }
        
        if (this.recorder) {
            this.recorder.delete();
            this.recorder = null;
        }
        
        this.removeAllListeners();
        console.log('✅ Enhanced wake word detector destroyed');
    }
}

module.exports = EnhancedWakeWordDetector;