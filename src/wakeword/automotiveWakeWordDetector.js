console.log(`
####################################################################
#                                                                  #
#     LOADING AUTOMOTIVE WAKE WORD DETECTION SYSTEM v3.0          #
#     Premier Car Environment Specialist - "Hello My Car"         #
#                                                                  #
####################################################################
`);

const { Porcupine } = require('@picovoice/porcupine-node');
const { PvRecorder } = require('@picovoice/pvrecorder-node');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const CarAudioProcessor = require('./carAudioProcessor');
const EnhancedWakeWordDetector = require('./enhancedDetector');

class AutomotiveWakeWordDetector extends EventEmitter {
    constructor(accessKey, options = {}) {
        super();
        
        console.log('[AutomotiveWakeWord] Initializing car-optimized wake word detection...');
        
        this.accessKey = accessKey;
        this.options = {
            // Automotive-specific settings
            baseCarSensitivity: options.baseCarSensitivity || 0.6, // Higher base for cars
            adaptiveSensitivityRange: options.adaptiveSensitivityRange || [0.3, 0.9],
            carContextAware: options.carContextAware !== false,
            highwayModeBoost: options.highwayModeBoost || 0.2,
            tunnelModeBoost: options.tunnelModeBoost || 0.25,
            
            // Confirmation and validation
            requireConfirmation: options.requireConfirmation !== false,
            multiStageConfirmation: options.multiStageConfirmation !== false,
            confirmationTimeoutMs: options.confirmationTimeoutMs || 3000,
            
            // Audio processing
            enableCarAudioProcessing: options.enableCarAudioProcessing !== false,
            enableAdvancedFiltering: options.enableAdvancedFiltering !== false,
            enableBeamforming: options.enableBeamforming || false,
            
            // Android Auto integration
            androidAutoCompatible: options.androidAutoCompatible !== false,
            bluetoothAudioAware: options.bluetoothAudioAware !== false,
            
            // Fallback system
            enableFallbackSystem: options.enableFallbackSystem !== false,
            fallbackPhrases: options.fallbackPhrases || [
                "hello my car",
                "hey car bot", 
                "car assistant",
                "ok my car"
            ],
            
            ...options
        };
        
        // Core detection components
        this.porcupine = null;
        this.recorder = null;
        this.carAudioProcessor = null;
        this.fallbackDetector = null;
        
        // Car environment state
        this.carContext = {
            speed: 0,
            engineRunning: false,
            bluetoothActive: false,
            navigationActive: false,
            drivingMode: 'parked',
            ambientNoise: 0
        };
        
        // Adaptive sensitivity system
        this.adaptiveSensitivity = {
            current: this.options.baseCarSensitivity,
            baseline: this.options.baseCarSensitivity,
            adjustmentHistory: [],
            lastAdjustment: Date.now(),
            performanceMetrics: {
                truePositives: 0,
                falsePositives: 0,
                missedDetections: 0
            }
        };
        
        // Detection state management
        this.detectionState = {
            isListening: false,
            isInitialized: false,
            isPrimaryActive: true,
            lastDetection: 0,
            consecutiveDetections: 0,
            confirmationPending: null
        };
        
        // Performance monitoring
        this.performance = {
            totalDetections: 0,
            confirmedDetections: 0,
            rejectedDetections: 0,
            avgConfidence: 0,
            environmentAdaptations: 0,
            systemUptime: Date.now()
        };
        
        // Audio quality assessment
        this.audioQuality = {
            signalToNoiseRatio: 0,
            speechClarity: 0,
            backgroundNoiseLevel: 0,
            qualityScore: 0,
            lastAssessment: Date.now()
        };
        
        this.initializeAutomotiveSystem();
    }
    
    async initializeAutomotiveSystem() {
        console.log('[AutomotiveWakeWord] Setting up automotive detection pipeline...');
        
        try {
            // Initialize car audio processor first
            if (this.options.enableCarAudioProcessing) {
                await this.initializeCarAudioProcessor();
            }
            
            // Initialize primary Porcupine system
            if (this.accessKey) {
                await this.initializePorcupineSystem();
            }
            
            // Initialize fallback system
            if (this.options.enableFallbackSystem) {
                await this.initializeFallbackSystem();
            }
            
            // Start car context monitoring
            this.startCarContextMonitoring();
            
            // Start adaptive sensitivity system
            this.startAdaptiveSensitivitySystem();
            
            this.detectionState.isInitialized = true;
            console.log('✅ Automotive wake word detection system initialized');
            
            this.emit('initialized', {
                primarySystem: !!this.porcupine,
                carAudioProcessor: !!this.carAudioProcessor,
                fallbackSystem: !!this.fallbackDetector,
                adaptiveSensitivity: true
            });
            
        } catch (error) {
            console.error('[AutomotiveWakeWord] Initialization error:', error.message);
            await this.initializeEmergencyFallback();
        }
    }
    
    async initializeCarAudioProcessor() {
        console.log('🚗 Initializing car-specific audio processing...');
        
        this.carAudioProcessor = new CarAudioProcessor({
            sampleRate: 16000,
            frameSize: 512,
            aggressiveNoiseCancellation: true,
            adaptiveFiltering: true,
            cabinAcousticCompensation: true,
            drivingModeProfiles: {
                'parked': { sensitivity: 0.5, noiseReduction: 0.3 },
                'city': { sensitivity: 0.65, noiseReduction: 0.5 },
                'highway': { sensitivity: 0.8, noiseReduction: 0.8 },
                'tunnel': { sensitivity: 0.9, noiseReduction: 0.9 }
            }
        });
        
        // Set up car audio processor events
        this.carAudioProcessor.on('frameProcessed', (data) => {
            this.handleProcessedAudioFrame(data);
        });
        
        this.carAudioProcessor.on('wakeWordConfirmed', (data) => {
            this.handleCarConfirmedWakeWord(data);
        });
        
        this.carAudioProcessor.on('drivingModeChanged', (data) => {
            this.adaptToDrivingMode(data);
        });
        
        console.log('✅ Car audio processor initialized');
    }
    
    async initializePorcupineSystem() {
        console.log('🎯 Initializing Porcupine wake word engine...');
        
        const modelPath = this.findBestWakeWordModel();
        if (!modelPath) {
            throw new Error('Wake word model not found');
        }
        
        console.log(`📁 Using wake word model: ${path.basename(modelPath)}`);
        
        this.porcupine = new Porcupine(
            this.accessKey,
            [modelPath],
            [this.adaptiveSensitivity.current]
        );
        
        // Initialize recorder with car-optimized settings
        const audioDevices = PvRecorder.getAvailableDevices();
        const selectedDevice = this.selectBestCarAudioDevice(audioDevices);
        
        this.recorder = new PvRecorder(
            this.porcupine.frameLength,
            selectedDevice
        );
        
        console.log('✅ Porcupine system initialized');
        this.detectionState.isPrimaryActive = true;
    }
    
    async initializeFallbackSystem() {
        console.log('🔄 Initializing enhanced fallback system...');
        
        this.fallbackDetector = new EnhancedWakeWordDetector(null, {
            enableVAD: true,
            enableMultipleTriggers: true,
            adaptiveSensitivity: true,
            enableNoiseReduction: true
        });
        
        await this.fallbackDetector.initialize();
        
        // Set up fallback events
        this.fallbackDetector.on('wakeWordDetected', (data) => {
            this.handleFallbackDetection(data);
        });
        
        console.log('✅ Fallback system initialized');
    }
    
    findBestWakeWordModel() {
        const possibleModels = [
            path.join(__dirname, '../../models/Hello-My-Car_en_mac_v3_0_0.ppn'),
            path.join(__dirname, '../../models/Hello-My-car_en_android_v3_0_0.ppn'),
            path.join(__dirname, '../../android/app/src/main/assets/Hello-My-Car_en_mac_v3_0_0.ppn'),
            path.join(__dirname, '../../android/app/src/main/assets/Hello-My-car_en_android_v3_0_0.ppn')
        ];
        
        for (const modelPath of possibleModels) {
            if (fs.existsSync(modelPath)) {
                console.log(`✅ Found wake word model: ${modelPath}`);
                return modelPath;
            }
        }
        
        console.warn('⚠️ No wake word model found in standard locations');
        return null;
    }
    
    selectBestCarAudioDevice(devices) {
        console.log(`🎤 Available audio devices: ${devices.length}`);
        
        // Prioritize car-friendly audio devices
        const carFriendlyKeywords = [
            'bluetooth', 'car', 'hands-free', 'headset', 'microphone',
            'built-in', 'internal', 'default'
        ];
        
        for (let i = 0; i < devices.length; i++) {
            const deviceName = devices[i].toLowerCase();
            
            for (const keyword of carFriendlyKeywords) {
                if (deviceName.includes(keyword)) {
                    console.log(`🚗 Selected car-optimized device: ${devices[i]}`);
                    return i;
                }
            }
        }
        
        console.log(`🎤 Using default audio device: ${devices[0] || 'system default'}`);
        return -1; // Use system default
    }
    
    async startListening() {
        if (this.detectionState.isListening) {
            console.log('[AutomotiveWakeWord] Already listening');
            return;
        }
        
        if (!this.detectionState.isInitialized) {
            console.error('[AutomotiveWakeWord] System not initialized');
            return;
        }
        
        console.log('🎤 Starting automotive wake word detection...');
        this.detectionState.isListening = true;
        this.performance.systemUptime = Date.now();
        
        // Start primary system if available
        if (this.porcupine && this.recorder && this.detectionState.isPrimaryActive) {
            try {
                this.recorder.start();
                this.startPrimaryAudioProcessing();
                console.log('✅ Primary Porcupine detection started');
            } catch (error) {
                console.error('❌ Primary system failed, switching to fallback:', error.message);
                await this.switchToFallbackMode();
            }
        }
        
        // Start fallback system
        if (this.fallbackDetector) {
            this.fallbackDetector.startListening();
            console.log('✅ Fallback detection started');
        }
        
        this.emit('listeningStarted', {
            primaryActive: this.detectionState.isPrimaryActive,
            fallbackActive: !!this.fallbackDetector,
            carContext: this.carContext
        });
    }
    
    startPrimaryAudioProcessing() {
        if (!this.recorder || !this.porcupine) return;
        
        const processAudioFrame = () => {
            if (!this.detectionState.isListening) return;
            
            try {
                const frame = this.recorder.read();
                if (!frame || frame.length === 0) {
                    setTimeout(processAudioFrame, 10);
                    return;
                }
                
                // Process frame through car audio processor
                let processedFrame = frame;
                if (this.carAudioProcessor) {
                    processedFrame = this.carAudioProcessor.processAudioFrame(frame, this.carContext);
                }
                
                // Update audio quality metrics
                this.updateAudioQualityMetrics(frame, processedFrame);
                
                // Perform wake word detection
                const keywordIndex = this.porcupine.process(processedFrame);
                
                if (keywordIndex >= 0) {
                    this.handlePrimaryWakeWordDetection(processedFrame);
                }
                
                // Continue processing
                setTimeout(processAudioFrame, 1);
                
            } catch (error) {
                console.error('[AutomotiveWakeWord] Audio processing error:', error.message);
                this.handleAudioProcessingError(error);
            }
        };
        
        processAudioFrame();
    }
    
    handlePrimaryWakeWordDetection(audioFrame) {
        const confidence = this.calculateDetectionConfidence(audioFrame);
        const detectionData = {
            confidence: confidence,
            timestamp: Date.now(),
            source: 'porcupine',
            carContext: { ...this.carContext },
            audioQuality: this.audioQuality.qualityScore,
            adaptiveSensitivity: this.adaptiveSensitivity.current
        };
        
        console.log(`🎯 Primary wake word detected (confidence: ${confidence.toFixed(3)}, mode: ${this.carContext.drivingMode})`);
        
        this.performance.totalDetections++;
        this.detectionState.consecutiveDetections++;
        this.detectionState.lastDetection = Date.now();
        
        if (this.options.requireConfirmation) {
            this.requestWakeWordConfirmation(detectionData);
        } else {
            this.confirmWakeWordDetection(detectionData);
        }
    }
    
    calculateDetectionConfidence(audioFrame) {
        // Calculate confidence based on multiple factors
        let baseConfidence = 0.8; // Base Porcupine confidence
        
        // Adjust for car context
        const contextAdjustment = this.calculateCarContextAdjustment();
        
        // Adjust for audio quality
        const qualityAdjustment = this.audioQuality.qualityScore * 0.2;
        
        // Adjust for adaptive sensitivity performance
        const adaptiveAdjustment = this.calculateAdaptiveAdjustment();
        
        const finalConfidence = Math.max(0.1, Math.min(1.0, 
            baseConfidence + contextAdjustment + qualityAdjustment + adaptiveAdjustment
        ));
        
        return finalConfidence;
    }
    
    calculateCarContextAdjustment() {
        let adjustment = 0;
        
        // Driving mode adjustments
        switch (this.carContext.drivingMode) {
            case 'parked':
                adjustment += 0.1; // Easier detection when parked
                break;
            case 'city':
                adjustment -= 0.05; // Slight penalty for city noise
                break;
            case 'highway':
                adjustment -= 0.1; // Higher penalty for highway noise
                break;
            case 'tunnel':
                adjustment -= 0.15; // Highest penalty for tunnel acoustics
                break;
        }
        
        // Speed adjustment
        if (this.carContext.speed > 60) {
            adjustment -= Math.min(0.1, (this.carContext.speed - 60) / 1000);
        }
        
        // Audio interference adjustments
        if (this.carContext.bluetoothActive) adjustment -= 0.05;
        if (this.carContext.navigationActive) adjustment -= 0.03;
        
        return adjustment;
    }
    
    calculateAdaptiveAdjustment() {
        const metrics = this.adaptiveSensitivity.performanceMetrics;
        const totalDetections = metrics.truePositives + metrics.falsePositives;
        
        if (totalDetections < 10) return 0; // Need more data
        
        const accuracy = metrics.truePositives / totalDetections;
        
        // Boost confidence if system is performing well
        if (accuracy > 0.9) return 0.05;
        if (accuracy > 0.8) return 0.02;
        if (accuracy < 0.6) return -0.05;
        
        return 0;
    }
    
    async requestWakeWordConfirmation(detectionData) {
        console.log('🔍 Requesting wake word confirmation...');
        
        if (this.detectionState.confirmationPending) {
            console.log('⏳ Confirmation already pending, ignoring new detection');
            return;
        }
        
        this.detectionState.confirmationPending = detectionData;
        
        // Use car audio processor for advanced confirmation
        if (this.carAudioProcessor) {
            const confirmed = this.carAudioProcessor.confirmWakeWordDetection(
                detectionData.confidence,
                detectionData
            );
            
            if (confirmed) {
                this.confirmWakeWordDetection(detectionData);
            } else {
                this.rejectWakeWordDetection(detectionData, 'car_audio_processor');
            }
        } else {
            // Fallback confirmation logic
            await this.performBasicConfirmation(detectionData);
        }
        
        // Clear confirmation after timeout
        setTimeout(() => {
            if (this.detectionState.confirmationPending === detectionData) {
                this.rejectWakeWordDetection(detectionData, 'timeout');
                this.detectionState.confirmationPending = null;
            }
        }, this.options.confirmationTimeoutMs);
    }
    
    async performBasicConfirmation(detectionData) {
        // Basic confirmation without car audio processor
        const minimumConfidence = this.getContextualMinimumConfidence();
        
        if (detectionData.confidence >= minimumConfidence && 
            this.audioQuality.qualityScore > 0.5) {
            this.confirmWakeWordDetection(detectionData);
        } else {
            this.rejectWakeWordDetection(detectionData, 'low_confidence');
        }
    }
    
    getContextualMinimumConfidence() {
        let minConfidence = 0.6; // Base minimum
        
        // Adjust based on car context
        const profile = this.getProfileForDrivingMode(this.carContext.drivingMode);
        if (profile) {
            minConfidence = Math.max(minConfidence, profile.sensitivity);
        }
        
        // Adjust for noise level
        if (this.carContext.ambientNoise > 0.7) {
            minConfidence += 0.1;
        }
        
        return Math.min(0.95, minConfidence);
    }
    
    confirmWakeWordDetection(detectionData) {
        console.log(`✅ Wake word CONFIRMED in ${this.carContext.drivingMode} mode!`);
        
        this.performance.confirmedDetections++;
        this.adaptiveSensitivity.performanceMetrics.truePositives++;
        this.detectionState.confirmationPending = null;
        this.detectionState.consecutiveDetections = 0;
        
        // Update adaptive sensitivity based on success
        this.updateAdaptiveSensitivity(true, detectionData);
        
        // Emit confirmation event with rich context
        this.emit('wakeWordDetected', {
            ...detectionData,
            confirmed: true,
            confirmationMethod: this.carAudioProcessor ? 'car_processor' : 'basic',
            carOptimized: true,
            drivingContext: {
                mode: this.carContext.drivingMode,
                speed: this.carContext.speed,
                noiseLevel: this.carContext.ambientNoise
            }
        });
        
        // Provide feedback about detection quality
        this.provideFeedbackToUser(detectionData);
    }
    
    rejectWakeWordDetection(detectionData, reason) {
        console.log(`🚫 Wake word REJECTED: ${reason} (confidence: ${detectionData.confidence.toFixed(3)})`);
        
        this.performance.rejectedDetections++;
        this.adaptiveSensitivity.performanceMetrics.falsePositives++;
        this.detectionState.confirmationPending = null;
        
        // Update adaptive sensitivity based on rejection
        this.updateAdaptiveSensitivity(false, detectionData);
        
        this.emit('wakeWordRejected', {
            ...detectionData,
            reason: reason,
            carContext: this.carContext
        });
    }
    
    updateAdaptiveSensitivity(success, detectionData) {
        const now = Date.now();
        const timeSinceLastAdjustment = now - this.adaptiveSensitivity.lastAdjustment;
        
        // Don't adjust too frequently
        if (timeSinceLastAdjustment < 10000) return; // 10 seconds minimum
        
        const currentSensitivity = this.adaptiveSensitivity.current;
        let adjustment = 0;
        
        if (success) {
            // Success - we can potentially reduce sensitivity to avoid false positives
            if (detectionData.confidence > 0.9 && this.performance.confirmedDetections > 5) {
                adjustment = -0.02; // Small reduction
            }
        } else {
            // Failure - increase sensitivity to catch more detections
            if (detectionData.confidence > 0.7) {
                adjustment = 0.03; // Moderate increase
            } else {
                adjustment = 0.05; // Larger increase for very low confidence
            }
        }
        
        // Apply driving mode modifiers
        const modeModifier = this.getDrivingModeAdjustment();
        adjustment *= modeModifier;
        
        // Apply adjustment within limits
        const newSensitivity = Math.max(
            this.options.adaptiveSensitivityRange[0],
            Math.min(
                this.options.adaptiveSensitivityRange[1],
                currentSensitivity + adjustment
            )
        );
        
        if (Math.abs(newSensitivity - currentSensitivity) > 0.01) {
            console.log(`🔧 Adaptive sensitivity: ${currentSensitivity.toFixed(3)} → ${newSensitivity.toFixed(3)} (${this.carContext.drivingMode})`);
            
            this.adaptiveSensitivity.current = newSensitivity;
            this.adaptiveSensitivity.lastAdjustment = now;
            this.adaptiveSensitivity.adjustmentHistory.push({
                timestamp: now,
                oldValue: currentSensitivity,
                newValue: newSensitivity,
                reason: success ? 'success_optimization' : 'failure_compensation',
                drivingMode: this.carContext.drivingMode
            });
            
            // Update Porcupine sensitivity if available
            if (this.porcupine && this.detectionState.isPrimaryActive) {
                try {
                    // Note: Porcupine doesn't support runtime sensitivity changes
                    // This would require recreating the instance
                    // For now, we track the desired sensitivity for next initialization
                    this.emit('sensitivityChanged', {
                        oldSensitivity: currentSensitivity,
                        newSensitivity: newSensitivity,
                        reason: success ? 'optimization' : 'compensation'
                    });
                } catch (error) {
                    console.warn('⚠️ Could not update Porcupine sensitivity:', error.message);
                }
            }
        }
    }
    
    getDrivingModeAdjustment() {
        // Driving modes need different sensitivity adjustment rates
        const adjustments = {
            'parked': 1.0,     // Normal adjustment
            'city': 1.2,       // Slightly more aggressive
            'highway': 1.5,    // More aggressive due to noise
            'tunnel': 2.0      // Most aggressive due to acoustics
        };
        
        return adjustments[this.carContext.drivingMode] || 1.0;
    }
    
    startCarContextMonitoring() {
        console.log('🚗 Starting car context monitoring...');
        
        // Monitor car context every 3 seconds
        this.contextTimer = setInterval(() => {
            this.updateCarContext();
            this.adaptToCarConditions();
        }, 3000);
        
        // Set up external context updates (from Android Auto, OBD, etc.)
        this.setupExternalContextSources();
    }
    
    updateCarContext() {
        // This would integrate with actual car systems
        // For now, simulate based on audio analysis
        
        if (this.carAudioProcessor) {
            const metrics = this.carAudioProcessor.getCarOptimizedMetrics();
            
            this.carContext.drivingMode = metrics.drivingMode || 'parked';
            this.carContext.ambientNoise = metrics.ambientNoiseLevel || 0;
            
            // Infer other context from audio patterns
            this.carContext.speed = this.inferSpeedFromAudio(metrics);
            this.carContext.engineRunning = metrics.dominantNoiseType === 'engine' || 
                                           metrics.ambientNoiseLevel > 0.3;
        }
        
        this.emit('carContextUpdated', this.carContext);
    }
    
    inferSpeedFromAudio(audioMetrics) {
        // Rough speed estimation from audio characteristics
        const noiseLevel = audioMetrics.ambientNoiseLevel || 0;
        const noiseType = audioMetrics.dominantNoiseType || 'none';
        
        if (noiseLevel < 0.2) return 0; // Parked
        if (noiseType === 'road' && noiseLevel > 0.6) return 80; // Highway
        if (noiseType === 'road' && noiseLevel > 0.4) return 50; // City
        if (noiseLevel > 0.3) return 20; // Low speed
        
        return 0;
    }
    
    adaptToCarConditions() {
        // Adapt detection parameters to current car conditions
        
        // Update car audio processor context
        if (this.carAudioProcessor) {
            this.carAudioProcessor.setCarContext(this.carContext);
        }
        
        // Adjust overall system behavior
        this.adjustSystemForCarConditions();
    }
    
    adjustSystemForCarConditions() {
        const profile = this.getProfileForDrivingMode(this.carContext.drivingMode);
        if (!profile) return;
        
        // Dynamic sensitivity adjustment based on conditions
        const targetSensitivity = this.calculateTargetSensitivity(profile);
        
        if (Math.abs(targetSensitivity - this.adaptiveSensitivity.current) > 0.05) {
            console.log(`🎛️ Adjusting for ${this.carContext.drivingMode} conditions: ${this.adaptiveSensitivity.current.toFixed(3)} → ${targetSensitivity.toFixed(3)}`);
            
            this.adaptiveSensitivity.current = targetSensitivity;
            this.performance.environmentAdaptations++;
        }
    }
    
    calculateTargetSensitivity(profile) {
        let targetSensitivity = profile.sensitivity;
        
        // Adjust for specific conditions
        if (this.carContext.bluetoothActive) targetSensitivity += 0.05;
        if (this.carContext.navigationActive) targetSensitivity += 0.03;
        
        // Adjust for noise level
        const noiseAdjustment = Math.min(0.2, this.carContext.ambientNoise * 0.3);
        targetSensitivity += noiseAdjustment;
        
        return Math.max(
            this.options.adaptiveSensitivityRange[0],
            Math.min(
                this.options.adaptiveSensitivityRange[1],
                targetSensitivity
            )
        );
    }
    
    getProfileForDrivingMode(mode) {
        if (this.carAudioProcessor && this.carAudioProcessor.options.drivingModeProfiles) {
            return this.carAudioProcessor.options.drivingModeProfiles[mode];
        }
        return null;
    }
    
    startAdaptiveSensitivitySystem() {
        console.log('🧠 Starting adaptive sensitivity system...');
        
        // Monitor system performance every 30 seconds
        this.adaptiveTimer = setInterval(() => {
            this.evaluateSystemPerformance();
            this.optimizeAdaptiveSensitivity();
        }, 30000);
    }
    
    evaluateSystemPerformance() {
        const metrics = this.adaptiveSensitivity.performanceMetrics;
        const totalDetections = metrics.truePositives + metrics.falsePositives;
        
        if (totalDetections < 5) return; // Need more data
        
        const accuracy = metrics.truePositives / totalDetections;
        const falsePositiveRate = metrics.falsePositives / totalDetections;
        
        console.log(`📊 System performance: ${(accuracy * 100).toFixed(1)}% accuracy, ${(falsePositiveRate * 100).toFixed(1)}% false positives`);
        
        this.emit('performanceUpdate', {
            accuracy: accuracy,
            falsePositiveRate: falsePositiveRate,
            totalDetections: totalDetections,
            confirmedDetections: this.performance.confirmedDetections,
            adaptiveSensitivity: this.adaptiveSensitivity.current
        });
    }
    
    updateAudioQualityMetrics(originalFrame, processedFrame) {
        // Calculate signal-to-noise ratio
        const originalEnergy = this.calculateFrameEnergy(originalFrame);
        const processedEnergy = this.calculateFrameEnergy(processedFrame);
        
        const snr = processedEnergy > 0 ? originalEnergy / processedEnergy : 0;
        this.audioQuality.signalToNoiseRatio = snr * 0.1 + this.audioQuality.signalToNoiseRatio * 0.9;
        
        // Calculate overall quality score
        this.audioQuality.qualityScore = Math.min(1.0, 
            this.audioQuality.signalToNoiseRatio * 0.4 + 
            this.audioQuality.speechClarity * 0.4 +
            (1 - this.audioQuality.backgroundNoiseLevel) * 0.2
        );
        
        this.audioQuality.lastAssessment = Date.now();
    }
    
    calculateFrameEnergy(frame) {
        let energy = 0;
        for (let i = 0; i < frame.length; i++) {
            energy += frame[i] * frame[i];
        }
        return Math.sqrt(energy / frame.length);
    }
    
    provideFeedbackToUser(detectionData) {
        // Provide context-aware feedback about detection
        const quality = detectionData.confidence > 0.9 ? 'excellent' : 
                       detectionData.confidence > 0.7 ? 'good' : 'acceptable';
        
        const context = `${this.carContext.drivingMode} mode, ${Math.round(this.carContext.speed)}km/h`;
        
        console.log(`💬 Detection quality: ${quality} (${context})`);
        
        this.emit('detectionFeedback', {
            quality: quality,
            confidence: detectionData.confidence,
            context: context,
            suggestions: this.generatePerformanceSuggestions()
        });
    }
    
    generatePerformanceSuggestions() {
        const suggestions = [];
        
        if (this.audioQuality.qualityScore < 0.6) {
            suggestions.push('Consider adjusting microphone position for better audio quality');
        }
        
        if (this.carContext.bluetoothActive && this.performance.confirmedDetections < 5) {
            suggestions.push('Bluetooth audio may interfere with wake word detection');
        }
        
        if (this.carContext.drivingMode === 'highway' && this.adaptiveSensitivity.current < 0.7) {
            suggestions.push('Highway driving detected - system automatically increasing sensitivity');
        }
        
        return suggestions;
    }
    
    // Public API methods for external integration
    
    setCarContext(context) {
        console.log('🚗 Updating car context:', context);
        
        Object.assign(this.carContext, context);
        this.adaptToCarConditions();
        
        this.emit('carContextSet', this.carContext);
    }
    
    getAutomotiveMetrics() {
        return {
            performance: this.performance,
            adaptiveSensitivity: this.adaptiveSensitivity,
            carContext: this.carContext,
            audioQuality: this.audioQuality,
            detectionState: this.detectionState,
            systemInfo: {
                primaryActive: this.detectionState.isPrimaryActive,
                fallbackActive: !!this.fallbackDetector,
                carProcessorActive: !!this.carAudioProcessor
            }
        };
    }
    
    forceSensitivityAdjustment(newSensitivity, reason = 'manual') {
        if (newSensitivity >= this.options.adaptiveSensitivityRange[0] && 
            newSensitivity <= this.options.adaptiveSensitivityRange[1]) {
            
            const oldSensitivity = this.adaptiveSensitivity.current;
            this.adaptiveSensitivity.current = newSensitivity;
            
            console.log(`🔧 Manual sensitivity adjustment: ${oldSensitivity.toFixed(3)} → ${newSensitivity.toFixed(3)}`);
            
            this.emit('sensitivityChanged', {
                oldSensitivity: oldSensitivity,
                newSensitivity: newSensitivity,
                reason: reason
            });
        }
    }
    
    async switchToFallbackMode() {
        console.log('🔄 Switching to fallback mode due to primary system issues');
        
        this.detectionState.isPrimaryActive = false;
        
        if (this.recorder) {
            try {
                this.recorder.stop();
            } catch (error) {
                console.warn('Warning stopping recorder:', error.message);
            }
        }
        
        // Ensure fallback is running
        if (this.fallbackDetector) {
            this.fallbackDetector.startListening();
        }
        
        this.emit('systemModeChanged', {
            mode: 'fallback',
            reason: 'primary_system_failure'
        });
    }
    
    stopListening() {
        if (!this.detectionState.isListening) return;
        
        console.log('🛑 Stopping automotive wake word detection...');
        this.detectionState.isListening = false;
        
        // Stop primary system
        if (this.recorder && this.detectionState.isPrimaryActive) {
            try {
                this.recorder.stop();
            } catch (error) {
                console.warn('Warning stopping recorder:', error.message);
            }
        }
        
        // Stop fallback system
        if (this.fallbackDetector) {
            this.fallbackDetector.stopListening();
        }
        
        // Clear timers
        if (this.contextTimer) clearInterval(this.contextTimer);
        if (this.adaptiveTimer) clearInterval(this.adaptiveTimer);
        
        this.emit('listeningStopped');
    }
    
    destroy() {
        console.log('🗑️ Destroying automotive wake word detector...');
        
        this.stopListening();
        
        if (this.porcupine) {
            this.porcupine.release();
            this.porcupine = null;
        }
        
        if (this.recorder) {
            this.recorder.delete();
            this.recorder = null;
        }
        
        if (this.carAudioProcessor) {
            this.carAudioProcessor.destroy();
            this.carAudioProcessor = null;
        }
        
        if (this.fallbackDetector) {
            this.fallbackDetector.destroy();
            this.fallbackDetector = null;
        }
        
        this.removeAllListeners();
        console.log('✅ Automotive wake word detector destroyed');
    }
}

module.exports = AutomotiveWakeWordDetector;