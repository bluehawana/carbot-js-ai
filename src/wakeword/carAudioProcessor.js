console.log(`
##########################################################
#                                                        #
#     LOADING CAR-OPTIMIZED AUDIO PROCESSOR v2.1        #
#     Premier Automotive Wake Word Specialist           #
#                                                        #
##########################################################
`);

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class CarAudioProcessor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        console.log('[CarAudioProcessor] Initializing automotive-grade audio processing...');
        
        this.options = {
            // Car-specific audio parameters
            roadNoiseFreqRange: options.roadNoiseFreqRange || [50, 800], // Hz
            engineNoiseFreqRange: options.engineNoiseFreqRange || [20, 150], // Hz
            windNoiseFreqRange: options.windNoiseFreqRange || [800, 4000], // Hz
            humanVoiceRange: options.humanVoiceRange || [85, 3400], // Hz
            
            // Noise cancellation settings
            aggressiveNoiseCancellation: options.aggressiveNoiseCancellation !== false,
            adaptiveFiltering: options.adaptiveFiltering !== false,
            spectralSubtraction: options.spectralSubtraction !== false,
            wienerFiltering: options.wienerFiltering !== false,
            
            // Car environment adaptation
            cabinAcousticCompensation: options.cabinAcousticCompensation !== false,
            multiMicArrayProcessing: options.multiMicArrayProcessing || false,
            beamforming: options.beamforming || false,
            echoSuppression: options.echoSuppression !== false,
            
            // Wake word optimization
            sensitivityBoostInNoise: options.sensitivityBoostInNoise || 0.15,
            confirmationThreshold: options.confirmationThreshold || 0.7,
            falsePositiveReduction: options.falsePositiveReduction !== false,
            consecutiveDetectionRequired: options.consecutiveDetectionRequired || 2,
            
            // Audio quality settings
            sampleRate: options.sampleRate || 16000,
            frameSize: options.frameSize || 512,
            hopSize: options.hopSize || 256,
            windowType: options.windowType || 'hann',
            
            // Car-specific tuning
            drivingModeProfiles: options.drivingModeProfiles || {
                'parked': { sensitivity: 0.5, noiseReduction: 0.3 },
                'city': { sensitivity: 0.6, noiseReduction: 0.5 },
                'highway': { sensitivity: 0.8, noiseReduction: 0.8 },
                'tunnel': { sensitivity: 0.9, noiseReduction: 0.9 }
            },
            
            ...options
        };
        
        // Current driving environment state
        this.drivingMode = 'parked';
        this.ambientNoiseLevel = 0;
        this.dominantNoiseType = 'none';
        this.isEngineRunning = false;
        this.currentSpeed = 0; // km/h
        this.bluetoothAudioActive = false;
        this.navigationAudioActive = false;
        
        // Audio processing state
        this.noiseProfile = {
            road: new Float32Array(this.options.frameSize / 2),
            engine: new Float32Array(this.options.frameSize / 2),
            wind: new Float32Array(this.options.frameSize / 2),
            ambient: new Float32Array(this.options.frameSize / 2),
            lastUpdate: Date.now()
        };
        
        // Advanced filtering components
        this.filters = {
            highpass: null,
            lowpass: null,
            bandstop: [],
            adaptive: null,
            wiener: null
        };
        
        // Multi-frame analysis for better accuracy
        this.frameBuffer = [];
        this.maxFrameBuffer = 10;
        this.spectralHistory = [];
        this.maxSpectralHistory = 20;
        
        // Performance metrics
        this.metrics = {
            totalFramesProcessed: 0,
            noiseReductionEffectiveness: 0,
            wakeWordConfidence: 0,
            falsePositivesBlocked: 0,
            adaptiveAdjustments: 0,
            processingLatency: 0,
            carEnvironmentAccuracy: 0
        };
        
        // Wake word confirmation system
        this.confirmationBuffer = [];
        this.confirmationWindowSize = 5;
        this.lastConfirmedDetection = 0;
        
        this.initializeCarAudioFilters();
        this.startEnvironmentMonitoring();
        
        console.log('✅ Car-optimized audio processor initialized');
        console.log(`🚗 Configured for automotive environments with ${Object.keys(this.options.drivingModeProfiles).length} driving profiles`);
    }
    
    initializeCarAudioFilters() {
        console.log('🔧 Initializing automotive-specific audio filters...');
        
        // Initialize frequency-domain filters for car noise
        this.initializeNoiseSpecificFilters();
        
        // Setup adaptive algorithms
        this.initializeAdaptiveFilters();
        
        // Car cabin acoustic compensation
        this.initializeCabinAcoustics();
        
        console.log('✅ Car audio filters initialized');
    }
    
    initializeNoiseSpecificFilters() {
        const nyquist = this.options.sampleRate / 2;
        
        // Road noise filter (low-frequency rumble)
        this.filters.roadNoise = this.createBandstopFilter(
            this.options.roadNoiseFreqRange[0] / nyquist,
            this.options.roadNoiseFreqRange[1] / nyquist
        );
        
        // Engine noise filter (very low frequency)
        this.filters.engineNoise = this.createBandstopFilter(
            this.options.engineNoiseFreqRange[0] / nyquist,
            this.options.engineNoiseFreqRange[1] / nyquist
        );
        
        // Wind noise filter (high-frequency)
        this.filters.windNoise = this.createHighpassFilter(
            this.options.windNoiseFreqRange[0] / nyquist
        );
        
        // Human voice preservation filter
        this.filters.voicePreservation = this.createBandpassFilter(
            this.options.humanVoiceRange[0] / nyquist,
            this.options.humanVoiceRange[1] / nyquist
        );
    }
    
    initializeAdaptiveFilters() {
        // Wiener filter for optimal noise reduction
        this.filters.wiener = {
            noiseSpectrum: new Float32Array(this.options.frameSize / 2),
            signalSpectrum: new Float32Array(this.options.frameSize / 2),
            adaptationRate: 0.1,
            initialized: false
        };
        
        // Adaptive noise cancellation
        this.filters.adaptive = {
            weights: new Float32Array(64), // FIR filter weights
            error: 0,
            stepSize: 0.001,
            leakage: 0.9999
        };
    }
    
    initializeCabinAcoustics() {
        // Car cabin acoustic modeling
        this.cabinModel = {
            reverbTime: 0.3, // seconds - typical car cabin
            absorption: 0.7, // typical car interior absorption
            dimensions: { length: 4.5, width: 1.8, height: 1.4 }, // meters
            resonantFrequencies: [60, 120, 240, 480] // Hz - typical car resonances
        };
        
        // Compensation filters for cabin acoustics
        this.cabinCompensation = this.createCabinCompensationFilter();
    }
    
    processAudioFrame(audioFrame, metadata = {}) {
        const startTime = process.hrtime.bigint();
        
        try {
            // Update car environment context
            this.updateCarEnvironmentContext(metadata);
            
            // Step 1: Car-specific noise reduction
            let processedFrame = this.applyCarNoiseReduction(audioFrame);
            
            // Step 2: Cabin acoustic compensation
            if (this.options.cabinAcousticCompensation) {
                processedFrame = this.applyCabinCompensation(processedFrame);
            }
            
            // Step 3: Adaptive filtering based on driving conditions
            processedFrame = this.applyAdaptiveFiltering(processedFrame);
            
            // Step 4: Spectral enhancement for voice clarity
            processedFrame = this.enhanceVoiceClarity(processedFrame);
            
            // Step 5: Multi-frame analysis for better accuracy
            this.updateFrameBuffer(processedFrame);
            processedFrame = this.applyMultiFrameAnalysis();
            
            // Update processing metrics
            const endTime = process.hrtime.bigint();
            this.updateProcessingMetrics(startTime, endTime);
            
            this.emit('frameProcessed', {
                originalFrame: audioFrame,
                processedFrame: processedFrame,
                noiseReduction: this.calculateNoiseReduction(audioFrame, processedFrame),
                drivingMode: this.drivingMode,
                noiseLevel: this.ambientNoiseLevel
            });
            
            return processedFrame;
            
        } catch (error) {
            console.error('[CarAudioProcessor] Frame processing error:', error);
            this.emit('error', error);
            return audioFrame; // Return original on error
        }
    }
    
    updateCarEnvironmentContext(metadata) {
        // Extract car environment information
        if (metadata.speed !== undefined) {
            this.currentSpeed = metadata.speed;
            this.updateDrivingMode();
        }
        
        if (metadata.engineRunning !== undefined) {
            this.isEngineRunning = metadata.engineRunning;
        }
        
        if (metadata.bluetoothAudio !== undefined) {
            this.bluetoothAudioActive = metadata.bluetoothAudio;
        }
        
        if (metadata.navigationAudio !== undefined) {
            this.navigationAudioActive = metadata.navigationAudio;
        }
        
        // Update noise profile based on context
        this.updateNoiseProfile(metadata);
    }
    
    updateDrivingMode() {
        const previousMode = this.drivingMode;
        
        if (this.currentSpeed < 5) {
            this.drivingMode = 'parked';
        } else if (this.currentSpeed < 60) {
            this.drivingMode = 'city';
        } else if (this.currentSpeed < 120) {
            this.drivingMode = 'highway';
        } else {
            this.drivingMode = 'highway'; // High-speed highway
        }
        
        // Check for tunnel conditions (high echo/reverb)
        if (this.detectTunnelConditions()) {
            this.drivingMode = 'tunnel';
        }
        
        if (previousMode !== this.drivingMode) {
            console.log(`🚗 Driving mode changed: ${previousMode} → ${this.drivingMode}`);
            this.adaptToNewDrivingMode();
            this.metrics.adaptiveAdjustments++;
        }
    }
    
    applyCarNoiseReduction(frame) {
        let processedFrame = new Float32Array(frame);
        
        // Apply road noise reduction based on speed
        if (this.currentSpeed > 30) {
            const roadNoiseIntensity = Math.min(1.0, this.currentSpeed / 120);
            processedFrame = this.applySpectralSubtraction(processedFrame, 'road', roadNoiseIntensity);
        }
        
        // Apply engine noise reduction
        if (this.isEngineRunning) {
            const engineNoiseIntensity = Math.min(1.0, (this.currentSpeed + 30) / 150);
            processedFrame = this.applySpectralSubtraction(processedFrame, 'engine', engineNoiseIntensity);
        }
        
        // Apply wind noise reduction at high speeds
        if (this.currentSpeed > 80) {
            const windNoiseIntensity = Math.min(1.0, (this.currentSpeed - 80) / 120);
            processedFrame = this.applySpectralSubtraction(processedFrame, 'wind', windNoiseIntensity);
        }
        
        return processedFrame;
    }
    
    applySpectralSubtraction(frame, noiseType, intensity) {
        if (!this.options.spectralSubtraction) return frame;
        
        const spectrum = this.computeSpectrum(frame);
        const noiseSpectrum = this.noiseProfile[noiseType];
        
        // Spectral subtraction algorithm
        for (let i = 0; i < spectrum.length; i++) {
            const noisePower = noiseSpectrum[i] * intensity;
            const signalPower = Math.max(spectrum[i], noisePower * 0.1); // Prevent over-subtraction
            spectrum[i] = signalPower - noisePower * 2.0; // Aggressive subtraction for car noise
            spectrum[i] = Math.max(spectrum[i], signalPower * 0.1); // Minimum residual
        }
        
        return this.computeInverseSpectrum(spectrum);
    }
    
    applyCabinCompensation(frame) {
        // Compensate for car cabin acoustics
        let compensatedFrame = new Float32Array(frame);
        
        // Apply cabin resonance compensation
        for (const freq of this.cabinModel.resonantFrequencies) {
            compensatedFrame = this.applyNotchFilter(compensatedFrame, freq);
        }
        
        // Reverberation reduction
        compensatedFrame = this.reduceReverberation(compensatedFrame);
        
        return compensatedFrame;
    }
    
    applyAdaptiveFiltering(frame) {
        const profile = this.options.drivingModeProfiles[this.drivingMode];
        if (!profile) return frame;
        
        // Apply Wiener filtering for optimal noise reduction
        if (this.options.wienerFiltering) {
            frame = this.applyWienerFilter(frame, profile.noiseReduction);
        }
        
        // Apply adaptive noise cancellation
        frame = this.applyAdaptiveNoiseCancellation(frame);
        
        return frame;
    }
    
    applyWienerFilter(frame, noiseReductionStrength) {
        const spectrum = this.computeSpectrum(frame);
        const wiener = this.filters.wiener;
        
        if (!wiener.initialized) {
            // Initialize with current spectrum
            wiener.noiseSpectrum.set(spectrum);
            wiener.signalSpectrum.set(spectrum);
            wiener.initialized = true;
            return frame;
        }
        
        // Update noise and signal spectra
        for (let i = 0; i < spectrum.length; i++) {
            const alpha = wiener.adaptationRate;
            
            // Estimate noise spectrum (when speech is not present)
            if (this.isSpeechAbsent(spectrum, i)) {
                wiener.noiseSpectrum[i] = alpha * spectrum[i] + (1 - alpha) * wiener.noiseSpectrum[i];
            }
            
            // Update signal spectrum
            wiener.signalSpectrum[i] = alpha * spectrum[i] + (1 - alpha) * wiener.signalSpectrum[i];
            
            // Apply Wiener filtering
            const snr = wiener.signalSpectrum[i] / (wiener.noiseSpectrum[i] + 1e-10);
            const gain = snr / (snr + 1);
            spectrum[i] *= gain * noiseReductionStrength;
        }
        
        return this.computeInverseSpectrum(spectrum);
    }
    
    enhanceVoiceClarity(frame) {
        // Enhance frequencies important for wake word detection
        const spectrum = this.computeSpectrum(frame);
        const nyquist = this.options.sampleRate / 2;
        
        // Boost human voice frequencies
        const voiceStart = Math.floor(this.options.humanVoiceRange[0] / nyquist * spectrum.length);
        const voiceEnd = Math.floor(this.options.humanVoiceRange[1] / nyquist * spectrum.length);
        
        for (let i = voiceStart; i < voiceEnd; i++) {
            spectrum[i] *= 1.2; // 20% boost for voice frequencies
        }
        
        // Apply formant enhancement for better speech recognition
        spectrum = this.enhanceFormants(spectrum);
        
        return this.computeInverseSpectrum(spectrum);
    }
    
    enhanceFormants(spectrum) {
        // Enhance typical formant frequencies for better speech clarity
        const formantFreqs = [700, 1220, 2600]; // Hz - typical male voice formants
        const nyquist = this.options.sampleRate / 2;
        
        formantFreqs.forEach(freq => {
            const binIndex = Math.floor(freq / nyquist * spectrum.length);
            const bandwidth = Math.floor(100 / nyquist * spectrum.length); // 100 Hz bandwidth
            
            for (let i = Math.max(0, binIndex - bandwidth); 
                 i < Math.min(spectrum.length, binIndex + bandwidth); i++) {
                const distance = Math.abs(i - binIndex) / bandwidth;
                const gain = 1.0 + (0.3 * Math.exp(-distance * distance)); // Gaussian boost
                spectrum[i] *= gain;
            }
        });
        
        return spectrum;
    }
    
    confirmWakeWordDetection(confidence, audioContext) {
        // Advanced wake word confirmation for automotive environments
        this.confirmationBuffer.push({
            confidence: confidence,
            timestamp: Date.now(),
            noiseLevel: this.ambientNoiseLevel,
            drivingMode: this.drivingMode,
            context: audioContext
        });
        
        // Keep only recent confirmations
        if (this.confirmationBuffer.length > this.confirmationWindowSize) {
            this.confirmationBuffer.shift();
        }
        
        // Analyze confirmation buffer for patterns
        const analysis = this.analyzeConfirmationPattern();
        
        if (analysis.shouldConfirm) {
            const timeSinceLastConfirmed = Date.now() - this.lastConfirmedDetection;
            
            // Prevent too frequent confirmations
            if (timeSinceLastConfirmed < 2000) {
                console.log('🚫 Wake word confirmation blocked (too recent)');
                return false;
            }
            
            // Apply car-specific confirmation logic
            if (this.isCarSpecificConfirmationValid(analysis)) {
                this.lastConfirmedDetection = Date.now();
                console.log(`✅ Wake word CONFIRMED in ${this.drivingMode} mode (confidence: ${analysis.avgConfidence.toFixed(2)})`);
                
                this.emit('wakeWordConfirmed', {
                    confidence: analysis.avgConfidence,
                    drivingMode: this.drivingMode,
                    noiseLevel: this.ambientNoiseLevel,
                    confirmationMethod: 'car-optimized',
                    analysis: analysis
                });
                
                return true;
            }
        }
        
        // Log why confirmation failed
        console.log(`🚫 Wake word confirmation failed: ${analysis.failureReason}`);
        this.metrics.falsePositivesBlocked++;
        
        return false;
    }
    
    analyzeConfirmationPattern() {
        if (this.confirmationBuffer.length < this.options.consecutiveDetectionRequired) {
            return {
                shouldConfirm: false,
                failureReason: 'Insufficient confirmations',
                avgConfidence: 0
            };
        }
        
        const recentConfirmations = this.confirmationBuffer.slice(-this.options.consecutiveDetectionRequired);
        const avgConfidence = recentConfirmations.reduce((sum, c) => sum + c.confidence, 0) / recentConfirmations.length;
        const minConfidence = Math.min(...recentConfirmations.map(c => c.confidence));
        const maxTimeDiff = Math.max(...recentConfirmations.map(c => c.timestamp)) - 
                           Math.min(...recentConfirmations.map(c => c.timestamp));
        
        // Confirmation criteria
        const confidenceThreshold = this.getAdaptiveConfidenceThreshold();
        const timeWindowValid = maxTimeDiff < 1500; // 1.5 seconds max
        const confidenceValid = avgConfidence >= confidenceThreshold && minConfidence >= confidenceThreshold * 0.8;
        
        return {
            shouldConfirm: confidenceValid && timeWindowValid,
            avgConfidence: avgConfidence,
            minConfidence: minConfidence,
            timeWindow: maxTimeDiff,
            failureReason: !confidenceValid ? 'Low confidence' : 
                          !timeWindowValid ? 'Time window too large' : 'Unknown'
        };
    }
    
    getAdaptiveConfidenceThreshold() {
        const profile = this.options.drivingModeProfiles[this.drivingMode];
        let threshold = this.options.confirmationThreshold;
        
        // Adjust based on driving conditions
        if (this.drivingMode === 'highway') {
            threshold += 0.1; // Higher threshold for highway noise
        } else if (this.drivingMode === 'tunnel') {
            threshold += 0.15; // Even higher for tunnel conditions
        }
        
        // Adjust for ambient noise level
        const noiseAdjustment = Math.min(0.2, this.ambientNoiseLevel * 0.1);
        threshold += noiseAdjustment;
        
        // Adjust for concurrent audio (music, navigation)
        if (this.bluetoothAudioActive) threshold += 0.05;
        if (this.navigationAudioActive) threshold += 0.03;
        
        return Math.min(0.95, threshold); // Cap at 0.95
    }
    
    isCarSpecificConfirmationValid(analysis) {
        // Car-specific validation logic
        
        // Check for engine noise interference
        if (this.isEngineRunning && this.dominantNoiseType === 'engine') {
            if (analysis.avgConfidence < 0.8) {
                return false;
            }
        }
        
        // Check for road noise interference
        if (this.currentSpeed > 60 && this.dominantNoiseType === 'road') {
            if (analysis.avgConfidence < 0.75) {
                return false;
            }
        }
        
        // Check for Bluetooth audio interference
        if (this.bluetoothAudioActive && analysis.avgConfidence < 0.85) {
            return false;
        }
        
        // Validate against known false positive patterns in cars
        if (this.detectFalsePositivePattern(analysis)) {
            return false;
        }
        
        return true;
    }
    
    detectFalsePositivePattern(analysis) {
        // Detect patterns that commonly cause false positives in cars
        
        // Pattern 1: Rhythmic road noise mimicking speech
        if (this.isRhythmicNoise() && analysis.avgConfidence < 0.9) {
            return true;
        }
        
        // Pattern 2: Turn signal or indicator sounds
        if (this.detectPeriodicSignals() && analysis.avgConfidence < 0.85) {
            return true;
        }
        
        // Pattern 3: Radio or navigation voice bleeding through
        if ((this.bluetoothAudioActive || this.navigationAudioActive) && 
            analysis.avgConfidence < 0.9) {
            return true;
        }
        
        return false;
    }
    
    // Utility methods for car-specific audio analysis
    
    detectTunnelConditions() {
        // Detect tunnel by analyzing reverberation and echo patterns
        if (this.spectralHistory.length < 10) return false;
        
        const recent = this.spectralHistory.slice(-10);
        const avgReverb = recent.reduce((sum, spec) => sum + this.calculateReverb(spec), 0) / recent.length;
        
        return avgReverb > 0.6; // High reverberation threshold
    }
    
    isRhythmicNoise() {
        // Detect rhythmic patterns in noise that might trigger false positives
        if (this.frameBuffer.length < 8) return false;
        
        const energies = this.frameBuffer.map(frame => this.calculateEnergy(frame));
        return this.detectPeriodicPattern(energies, 0.7);
    }
    
    detectPeriodicSignals() {
        // Detect periodic signals like turn indicators
        if (this.spectralHistory.length < 5) return false;
        
        const recentSpectra = this.spectralHistory.slice(-5);
        const periodicFreqs = this.findPeriodicFrequencies(recentSpectra);
        
        return periodicFreqs.length > 0;
    }
    
    // Advanced audio processing utilities
    
    computeSpectrum(frame) {
        // Simple FFT-like spectrum computation
        // In production, use a proper FFT library
        const spectrum = new Float32Array(frame.length / 2);
        for (let i = 0; i < spectrum.length; i++) {
            const real = frame[i * 2] || 0;
            const imag = frame[i * 2 + 1] || 0;
            spectrum[i] = Math.sqrt(real * real + imag * imag);
        }
        return spectrum;
    }
    
    computeInverseSpectrum(spectrum) {
        // Simple inverse FFT-like computation
        const frame = new Float32Array(spectrum.length * 2);
        for (let i = 0; i < spectrum.length; i++) {
            frame[i * 2] = spectrum[i];
            frame[i * 2 + 1] = 0;
        }
        return frame;
    }
    
    calculateEnergy(frame) {
        return frame.reduce((sum, sample) => sum + sample * sample, 0) / frame.length;
    }
    
    calculateReverb(spectrum) {
        // Simplified reverberation calculation
        const highFreqEnergy = spectrum.slice(spectrum.length * 0.7).reduce((a, b) => a + b, 0);
        const totalEnergy = spectrum.reduce((a, b) => a + b, 0);
        return highFreqEnergy / (totalEnergy + 1e-10);
    }
    
    startEnvironmentMonitoring() {
        // Monitor car environment every 2 seconds
        this.environmentTimer = setInterval(() => {
            this.analyzeCurrentEnvironment();
            this.adaptProcessingToEnvironment();
            this.updateMetrics();
        }, 2000);
    }
    
    analyzeCurrentEnvironment() {
        // Analyze current audio environment
        if (this.frameBuffer.length > 0) {
            const latestFrame = this.frameBuffer[this.frameBuffer.length - 1];
            this.ambientNoiseLevel = this.calculateEnergy(latestFrame);
            this.dominantNoiseType = this.classifyNoiseType(latestFrame);
        }
    }
    
    classifyNoiseType(frame) {
        const spectrum = this.computeSpectrum(frame);
        const nyquist = this.options.sampleRate / 2;
        
        const roadEnergy = this.calculateBandEnergy(spectrum, this.options.roadNoiseFreqRange, nyquist);
        const engineEnergy = this.calculateBandEnergy(spectrum, this.options.engineNoiseFreqRange, nyquist);
        const windEnergy = this.calculateBandEnergy(spectrum, this.options.windNoiseFreqRange, nyquist);
        
        const totalEnergy = roadEnergy + engineEnergy + windEnergy;
        if (totalEnergy < 0.01) return 'none';
        
        const maxEnergy = Math.max(roadEnergy, engineEnergy, windEnergy);
        if (maxEnergy === roadEnergy) return 'road';
        if (maxEnergy === engineEnergy) return 'engine';
        return 'wind';
    }
    
    calculateBandEnergy(spectrum, freqRange, nyquist) {
        const startBin = Math.floor(freqRange[0] / nyquist * spectrum.length);
        const endBin = Math.floor(freqRange[1] / nyquist * spectrum.length);
        
        let energy = 0;
        for (let i = startBin; i < endBin && i < spectrum.length; i++) {
            energy += spectrum[i] * spectrum[i];
        }
        return energy / (endBin - startBin);
    }
    
    // Create different types of audio filters
    
    createBandstopFilter(lowFreq, highFreq) {
        return {
            type: 'bandstop',
            lowFreq: lowFreq,
            highFreq: highFreq,
            apply: (frame) => this.applyBandstopFilter(frame, lowFreq, highFreq)
        };
    }
    
    createBandpassFilter(lowFreq, highFreq) {
        return {
            type: 'bandpass',
            lowFreq: lowFreq,
            highFreq: highFreq,
            apply: (frame) => this.applyBandpassFilter(frame, lowFreq, highFreq)
        };
    }
    
    createHighpassFilter(cutoffFreq) {
        return {
            type: 'highpass',
            cutoffFreq: cutoffFreq,
            apply: (frame) => this.applyHighpassFilter(frame, cutoffFreq)
        };
    }
    
    // Simplified filter implementations (use proper DSP library in production)
    
    applyBandstopFilter(frame, lowFreq, highFreq) {
        // Simplified bandstop filter
        const spectrum = this.computeSpectrum(frame);
        const startBin = Math.floor(lowFreq * spectrum.length);
        const endBin = Math.floor(highFreq * spectrum.length);
        
        for (let i = startBin; i < endBin; i++) {
            spectrum[i] *= 0.1; // Attenuate by 90%
        }
        
        return this.computeInverseSpectrum(spectrum);
    }
    
    updateFrameBuffer(frame) {
        this.frameBuffer.push(new Float32Array(frame));
        if (this.frameBuffer.length > this.maxFrameBuffer) {
            this.frameBuffer.shift();
        }
        
        // Update spectral history
        const spectrum = this.computeSpectrum(frame);
        this.spectralHistory.push(spectrum);
        if (this.spectralHistory.length > this.maxSpectralHistory) {
            this.spectralHistory.shift();
        }
    }
    
    applyMultiFrameAnalysis() {
        if (this.frameBuffer.length < 3) {
            return this.frameBuffer[this.frameBuffer.length - 1] || new Float32Array(512);
        }
        
        // Apply temporal smoothing across frames
        const avgFrame = new Float32Array(this.frameBuffer[0].length);
        const weights = [0.2, 0.3, 0.5]; // More weight to recent frames
        
        for (let i = 0; i < 3; i++) {
            const frame = this.frameBuffer[this.frameBuffer.length - 3 + i];
            for (let j = 0; j < avgFrame.length; j++) {
                avgFrame[j] += frame[j] * weights[i];
            }
        }
        
        return avgFrame;
    }
    
    updateProcessingMetrics(startTime, endTime) {
        this.metrics.totalFramesProcessed++;
        
        const processingTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        this.metrics.processingLatency = this.metrics.processingLatency * 0.9 + processingTime * 0.1;
    }
    
    getCarOptimizedMetrics() {
        return {
            ...this.metrics,
            drivingMode: this.drivingMode,
            currentSpeed: this.currentSpeed,
            ambientNoiseLevel: this.ambientNoiseLevel,
            dominantNoiseType: this.dominantNoiseType,
            isEngineRunning: this.isEngineRunning,
            bluetoothAudioActive: this.bluetoothAudioActive,
            adaptiveThreshold: this.getAdaptiveConfidenceThreshold(),
            frameBufferSize: this.frameBuffer.length,
            spectralHistorySize: this.spectralHistory.length
        };
    }
    
    // Public API methods
    
    setDrivingMode(mode) {
        if (this.options.drivingModeProfiles[mode]) {
            this.drivingMode = mode;
            this.adaptToNewDrivingMode();
            console.log(`🚗 Driving mode manually set to: ${mode}`);
        }
    }
    
    setCarContext(context) {
        this.currentSpeed = context.speed || this.currentSpeed;
        this.isEngineRunning = context.engineRunning !== undefined ? context.engineRunning : this.isEngineRunning;
        this.bluetoothAudioActive = context.bluetoothAudio !== undefined ? context.bluetoothAudio : this.bluetoothAudioActive;
        this.navigationAudioActive = context.navigationAudio !== undefined ? context.navigationAudio : this.navigationAudioActive;
        
        this.updateDrivingMode();
    }
    
    adaptToNewDrivingMode() {
        const profile = this.options.drivingModeProfiles[this.drivingMode];
        if (!profile) return;
        
        // Adjust processing parameters based on driving mode
        console.log(`🔧 Adapting audio processing for ${this.drivingMode} mode`);
        
        this.emit('drivingModeChanged', {
            previousMode: this.drivingMode,
            newMode: this.drivingMode,
            profile: profile
        });
    }
    
    destroy() {
        if (this.environmentTimer) {
            clearInterval(this.environmentTimer);
        }
        
        this.frameBuffer = [];
        this.spectralHistory = [];
        this.confirmationBuffer = [];
        this.removeAllListeners();
        
        console.log('🗑️ Car Audio Processor destroyed');
    }
}

module.exports = CarAudioProcessor;