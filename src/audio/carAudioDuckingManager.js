console.log(`
####################################################################
#                                                                  #
#     LOADING CAR AUDIO DUCKING & MEDIA INTEGRATION v2.0          #
#     Seamless Audio Management for Android Auto                  #
#                                                                  #
####################################################################
`);

const EventEmitter = require('events');
const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class CarAudioDuckingManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        console.log('[CarAudioDucking] Initializing automotive audio management...');
        
        this.options = {
            // Audio ducking settings
            duckingLevel: options.duckingLevel || 0.3, // 30% volume during CarBot speech
            duckingFadeTime: options.duckingFadeTime || 500, // 500ms fade
            unduckingFadeTime: options.unduckingFadeTime || 1000, // 1s fade back
            duckingDelay: options.duckingDelay || 100, // 100ms delay before ducking
            
            // Media system integration
            androidAutoCompatible: options.androidAutoCompatible !== false,
            bluetoothMediaControl: options.bluetoothMediaControl !== false,
            navigationAudioPriority: options.navigationAudioPriority !== false,
            emergencyOverride: options.emergencyOverride !== false,
            
            // Car system integration
            canBusIntegration: options.canBusIntegration || false,
            obdPortAccess: options.obdPortAccess || false,
            carManufacturerAPI: options.carManufacturerAPI || null,
            
            // Audio routing
            preferredAudioOutput: options.preferredAudioOutput || 'car_speakers',
            backupAudioOutput: options.backupAudioOutput || 'bluetooth',
            audioQualityProfile: options.audioQualityProfile || 'balanced',
            
            // Smart ducking features
            contextAwareDucking: options.contextAwareDucking !== false,
            voiceActivityDetection: options.voiceActivityDetection !== false,
            musicGenreAwareness: options.musicGenreAwareness || false,
            conversationModeEnabled: options.conversationModeEnabled !== false,
            
            ...options
        };
        
        // Current audio state
        this.audioState = {
            isCarBotSpeaking: false,
            isMusicPlaying: false,
            isNavigationActive: false,
            isPhoneCallActive: false,
            currentVolume: 1.0,
            originalVolume: 1.0,
            isDucked: false,
            lastDuckingAction: 0
        };
        
        // Media session tracking
        this.mediaSessions = {
            music: null,
            navigation: null,
            phone: null,
            other: []
        };
        
        // Audio device management
        this.audioDevices = {
            carSpeakers: null,
            bluetooth: null,
            headphones: null,
            phoneAudio: null,
            available: []
        };
        
        // Ducking profiles for different scenarios
        this.duckingProfiles = {
            'music_soft': { level: 0.4, fadeIn: 300, fadeOut: 800 },
            'music_loud': { level: 0.2, fadeIn: 200, fadeOut: 1200 },
            'navigation': { level: 0.6, fadeIn: 150, fadeOut: 500 },
            'phone_call': { level: 0.1, fadeIn: 100, fadeOut: 300 },
            'emergency': { level: 0.05, fadeIn: 50, fadeOut: 200 },
            'conversation': { level: 0.5, fadeIn: 400, fadeOut: 600 }
        };
        
        // Performance metrics
        this.metrics = {
            duckingOperations: 0,
            averageDuckingTime: 0,
            failedOperations: 0,
            audioInterruptions: 0,
            mediaSessionConflicts: 0,
            userSatisfactionScore: 0
        };
        
        // Android Auto integration
        this.androidAuto = {
            connected: false,
            mediaSession: null,
            audioFocus: false,
            displayMode: 'day',
            supportedFeatures: []
        };
        
        this.initializeAudioSystem();
    }
    
    async initializeAudioSystem() {
        console.log('🔊 Initializing car audio ducking system...');
        
        try {
            // Discover available audio devices
            await this.discoverAudioDevices();
            
            // Initialize platform-specific audio control
            await this.initializePlatformAudio();
            
            // Set up Android Auto integration
            if (this.options.androidAutoCompatible) {
                await this.initializeAndroidAutoIntegration();
            }
            
            // Start audio monitoring
            this.startAudioMonitoring();
            
            // Set up car system integration
            if (this.options.canBusIntegration || this.options.obdPortAccess) {
                await this.initializeCarSystemIntegration();
            }
            
            console.log('✅ Car audio ducking system initialized');
            this.emit('initialized', {
                audioDevices: this.audioDevices.available.length,
                androidAutoReady: this.androidAuto.connected,
                duckingProfiles: Object.keys(this.duckingProfiles).length
            });
            
        } catch (error) {
            console.error('[CarAudioDucking] Initialization error:', error.message);
            await this.initializeFallbackAudioSystem();
        }
    }
    
    async discoverAudioDevices() {
        console.log('🎤 Discovering available audio devices...');
        
        const platform = process.platform;
        let devices = [];
        
        try {
            if (platform === 'darwin') {
                devices = await this.discoverMacAudioDevices();
            } else if (platform === 'linux') {
                devices = await this.discoverLinuxAudioDevices();
            } else if (platform === 'win32') {
                devices = await this.discoverWindowsAudioDevices();
            }
            
            this.audioDevices.available = devices;
            this.categorizeAudioDevices(devices);
            
            console.log(`✅ Found ${devices.length} audio devices`);
            
        } catch (error) {
            console.warn('⚠️ Audio device discovery failed:', error.message);
            this.audioDevices.available = [];
        }
    }
    
    async discoverMacAudioDevices() {
        return new Promise((resolve, reject) => {
            exec('system_profiler SPAudioDataType -json', (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                
                try {
                    const data = JSON.parse(stdout);
                    const devices = this.parseMacAudioDevices(data);
                    resolve(devices);
                } catch (parseError) {
                    reject(parseError);
                }
            });
        });
    }
    
    parseMacAudioDevices(data) {
        const devices = [];
        
        if (data.SPAudioDataType) {
            data.SPAudioDataType.forEach(device => {
                devices.push({
                    name: device._name || 'Unknown Device',
                    type: this.classifyDeviceType(device._name),
                    manufacturer: device.manufacturer || 'Unknown',
                    isInput: device.input_channels && device.input_channels > 0,
                    isOutput: device.output_channels && device.output_channels > 0,
                    sampleRate: device.sample_rate || 44100,
                    bitDepth: device.bit_depth || 16
                });
            });
        }
        
        return devices;
    }
    
    classifyDeviceType(deviceName) {
        const name = deviceName.toLowerCase();
        
        if (name.includes('bluetooth') || name.includes('airpods') || name.includes('wireless')) {
            return 'bluetooth';
        } else if (name.includes('headphone') || name.includes('headset')) {
            return 'headphones';
        } else if (name.includes('car') || name.includes('auto') || name.includes('vehicle')) {
            return 'car_audio';
        } else if (name.includes('built-in') || name.includes('internal')) {
            return 'internal';
        } else if (name.includes('usb') || name.includes('external')) {
            return 'external';
        }
        
        return 'unknown';
    }
    
    categorizeAudioDevices(devices) {
        devices.forEach(device => {
            switch (device.type) {
                case 'bluetooth':
                    if (!this.audioDevices.bluetooth) {
                        this.audioDevices.bluetooth = device;
                    }
                    break;
                case 'car_audio':
                    if (!this.audioDevices.carSpeakers) {
                        this.audioDevices.carSpeakers = device;
                    }
                    break;
                case 'headphones':
                    if (!this.audioDevices.headphones) {
                        this.audioDevices.headphones = device;
                    }
                    break;
            }
        });
    }
    
    async initializePlatformAudio() {
        const platform = process.platform;
        
        if (platform === 'darwin') {
            await this.initializeMacAudio();
        } else if (platform === 'linux') {
            await this.initializeLinuxAudio();
        } else if (platform === 'win32') {
            await this.initializeWindowsAudio();
        }
    }
    
    async initializeMacAudio() {
        console.log('🍎 Initializing macOS audio control...');
        
        // Check for SoX (Sound eXchange) for advanced audio control
        try {
            await this.checkCommandAvailability('sox');
            this.audioControls = {
                platform: 'darwin',
                hasAdvancedControl: true,
                volumeControl: 'osascript',
                duckingMethod: 'sox'
            };
        } catch (error) {
            this.audioControls = {
                platform: 'darwin',
                hasAdvancedControl: false,
                volumeControl: 'osascript',
                duckingMethod: 'volume'
            };
        }
    }
    
    async initializeAndroidAutoIntegration() {
        console.log('📱 Initializing Android Auto integration...');
        
        // Set up Android Auto media session monitoring
        this.setupAndroidAutoMediaSession();
        
        // Configure audio focus management
        this.setupAudioFocusManagement();
        
        // Set up display mode detection
        this.setupDisplayModeDetection();
        
        this.androidAuto.connected = true;
        console.log('✅ Android Auto integration ready');
    }
    
    setupAndroidAutoMediaSession() {
        // Monitor for Android Auto media sessions
        this.mediaSessionMonitor = setInterval(() => {
            this.detectAndroidAutoMediaSession();
        }, 1000);
    }
    
    detectAndroidAutoMediaSession() {
        // This would integrate with actual Android Auto APIs
        // For now, simulate detection
        
        const currentTime = Date.now();
        
        // Simulate music playing detection
        if (Math.random() > 0.95) { // 5% chance per check
            this.handleMediaSessionChange('music', true);
        }
        
        // Simulate navigation audio
        if (Math.random() > 0.98) { // 2% chance per check
            this.handleMediaSessionChange('navigation', true);
        }
    }
    
    handleMediaSessionChange(sessionType, isActive) {
        const previousState = this.mediaSessions[sessionType];
        this.mediaSessions[sessionType] = isActive ? {
            active: true,
            startTime: Date.now(),
            volume: this.getCurrentVolume()
        } : null;
        
        if (isActive && !previousState) {
            console.log(`🎵 ${sessionType} session started`);
            this.updateAudioState();
        } else if (!isActive && previousState) {
            console.log(`🎵 ${sessionType} session ended`);
            this.updateAudioState();
        }
        
        this.emit('mediaSessionChanged', {
            sessionType: sessionType,
            isActive: isActive,
            timestamp: Date.now()
        });
    }
    
    updateAudioState() {
        // Update overall audio state based on active sessions
        this.audioState.isMusicPlaying = !!this.mediaSessions.music;
        this.audioState.isNavigationActive = !!this.mediaSessions.navigation;
        this.audioState.isPhoneCallActive = !!this.mediaSessions.phone;
    }
    
    async startCarBotSpeech(text, options = {}) {
        console.log('🗣️ CarBot starting speech, initiating audio ducking...');
        
        if (this.audioState.isCarBotSpeaking) {
            console.log('⚠️ CarBot already speaking, queuing speech...');
            return this.queueSpeech(text, options);
        }
        
        this.audioState.isCarBotSpeaking = true;
        
        try {
            // Determine appropriate ducking profile
            const profile = this.selectDuckingProfile(options);
            
            // Apply audio ducking
            await this.applyAudioDucking(profile);
            
            // Start speech with enhanced audio routing
            const speechResult = await this.executeSpeechWithRouting(text, options);
            
            // Monitor speech completion
            this.monitorSpeechCompletion(speechResult);
            
            this.emit('speechStarted', {
                text: text,
                profile: profile,
                audioState: this.audioState
            });
            
            return speechResult;
            
        } catch (error) {
            console.error('[CarAudioDucking] Speech initiation error:', error);
            this.audioState.isCarBotSpeaking = false;
            throw error;
        }
    }
    
    selectDuckingProfile(options) {
        // Intelligent ducking profile selection
        
        if (options.priority === 'emergency') {
            return this.duckingProfiles.emergency;
        }
        
        if (this.audioState.isPhoneCallActive) {
            return this.duckingProfiles.phone_call;
        }
        
        if (this.audioState.isNavigationActive && !options.overrideNavigation) {
            return this.duckingProfiles.navigation;
        }
        
        if (this.audioState.isMusicPlaying) {
            // Determine music ducking level based on context
            const musicVolume = this.getCurrentVolume();
            return musicVolume > 0.7 ? 
                this.duckingProfiles.music_loud : 
                this.duckingProfiles.music_soft;
        }
        
        if (options.conversationMode) {
            return this.duckingProfiles.conversation;
        }
        
        // Default ducking
        return this.duckingProfiles.music_soft;
    }
    
    async applyAudioDucking(profile) {
        const startTime = Date.now();
        
        try {
            // Store original volume before ducking
            this.audioState.originalVolume = this.getCurrentVolume();
            
            // Apply ducking with fade
            await this.fadeAudioToLevel(profile.level, profile.fadeIn);
            
            this.audioState.isDucked = true;
            this.audioState.currentVolume = profile.level;
            this.audioState.lastDuckingAction = Date.now();
            
            // Update metrics
            this.metrics.duckingOperations++;
            const duckingTime = Date.now() - startTime;
            this.metrics.averageDuckingTime = (this.metrics.averageDuckingTime + duckingTime) / 2;
            
            console.log(`🔇 Audio ducked to ${(profile.level * 100).toFixed(0)}% in ${duckingTime}ms`);
            
            this.emit('audioDucked', {
                originalVolume: this.audioState.originalVolume,
                duckingLevel: profile.level,
                fadeTime: profile.fadeIn,
                profile: profile
            });
            
        } catch (error) {
            console.error('[CarAudioDucking] Ducking application error:', error);
            this.metrics.failedOperations++;
            throw error;
        }
    }
    
    async fadeAudioToLevel(targetLevel, fadeTime) {
        const currentLevel = this.getCurrentVolume();
        const steps = Math.max(10, fadeTime / 50); // At least 10 steps, max 50ms per step
        const stepSize = (targetLevel - currentLevel) / steps;
        const stepDelay = fadeTime / steps;
        
        for (let i = 0; i < steps; i++) {
            const newLevel = currentLevel + (stepSize * (i + 1));
            await this.setSystemVolume(newLevel);
            await this.sleep(stepDelay);
        }
        
        // Ensure final level is exact
        await this.setSystemVolume(targetLevel);
    }
    
    async executeSpeechWithRouting(text, options) {
        // Enhanced speech execution with car audio routing
        
        const audioOutput = this.selectOptimalAudioOutput();
        const speechOptions = {
            ...options,
            outputDevice: audioOutput,
            carOptimized: true,
            duckingActive: this.audioState.isDucked
        };
        
        console.log(`🎵 Routing CarBot speech to: ${audioOutput.name || 'default'}`);
        
        // This would integrate with the TTS system
        // For now, simulate speech execution
        return this.simulateSpeechExecution(text, speechOptions);
    }
    
    selectOptimalAudioOutput() {
        // Intelligent audio output selection for car environment
        
        // Priority 1: Car speakers (if available and connected)
        if (this.audioDevices.carSpeakers && this.isDeviceActive(this.audioDevices.carSpeakers)) {
            return this.audioDevices.carSpeakers;
        }
        
        // Priority 2: Bluetooth (likely car audio system)
        if (this.audioDevices.bluetooth && this.isDeviceActive(this.audioDevices.bluetooth)) {
            return this.audioDevices.bluetooth;
        }
        
        // Priority 3: Any available output device
        const availableOutputs = this.audioDevices.available.filter(device => 
            device.isOutput && this.isDeviceActive(device)
        );
        
        if (availableOutputs.length > 0) {
            return availableOutputs[0];
        }
        
        // Fallback to system default
        return { name: 'system_default', type: 'default' };
    }
    
    isDeviceActive(device) {
        // Check if device is currently active/connected
        // This would involve platform-specific checks
        return true; // Simplified for now
    }
    
    simulateSpeechExecution(text, options) {
        // Simulate TTS execution
        const estimatedDuration = this.estimateSpeechDuration(text);
        
        return {
            text: text,
            duration: estimatedDuration,
            audioFile: null, // Would be actual audio file path
            options: options,
            startTime: Date.now()
        };
    }
    
    estimateSpeechDuration(text) {
        // Estimate speech duration (words per minute calculation)
        const words = text.split(' ').length;
        const wpm = 180; // Average speech rate
        return (words / wpm) * 60 * 1000; // Convert to milliseconds
    }
    
    monitorSpeechCompletion(speechResult) {
        // Monitor when speech completes to restore audio
        setTimeout(() => {
            this.endCarBotSpeech();
        }, speechResult.duration);
    }
    
    async endCarBotSpeech() {
        if (!this.audioState.isCarBotSpeaking) {
            return;
        }
        
        console.log('🗣️ CarBot speech ended, restoring audio...');
        
        this.audioState.isCarBotSpeaking = false;
        
        try {
            // Restore original audio levels
            await this.restoreAudioLevels();
            
            this.emit('speechEnded', {
                restoredVolume: this.audioState.originalVolume,
                audioState: this.audioState
            });
            
        } catch (error) {
            console.error('[CarAudioDucking] Audio restoration error:', error);
            this.metrics.failedOperations++;
        }
    }
    
    async restoreAudioLevels() {
        if (!this.audioState.isDucked) {
            return;
        }
        
        const restoreProfile = this.getRestoreProfile();
        
        // Fade back to original volume
        await this.fadeAudioToLevel(this.audioState.originalVolume, restoreProfile.fadeOut);
        
        this.audioState.isDucked = false;
        this.audioState.currentVolume = this.audioState.originalVolume;
        
        console.log(`🔊 Audio restored to ${(this.audioState.originalVolume * 100).toFixed(0)}%`);
        
        this.emit('audioRestored', {
            originalVolume: this.audioState.originalVolume,
            fadeTime: restoreProfile.fadeOut
        });
    }
    
    getRestoreProfile() {
        // Determine appropriate restoration profile
        if (this.audioState.isPhoneCallActive) {
            return { fadeOut: 200 }; // Quick restore for phone calls
        }
        
        if (this.audioState.isNavigationActive) {
            return { fadeOut: 500 }; // Medium restore for navigation
        }
        
        return { fadeOut: 1000 }; // Gentle restore for music
    }
    
    async setSystemVolume(level) {
        const platform = process.platform;
        
        try {
            if (platform === 'darwin') {
                await this.setMacVolume(level);
            } else if (platform === 'linux') {
                await this.setLinuxVolume(level);
            } else if (platform === 'win32') {
                await this.setWindowsVolume(level);
            }
        } catch (error) {
            console.warn('⚠️ Failed to set system volume:', error.message);
        }
    }
    
    async setMacVolume(level) {
        const volumePercent = Math.round(level * 100);
        const command = `osascript -e "set volume output volume ${volumePercent}"`;
        
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }
    
    getCurrentVolume() {
        // This would get the actual system volume
        // For now, return a simulated value
        return this.audioState.currentVolume;
    }
    
    // Advanced car audio features
    
    async handleEmergencyOverride(emergencyText, options = {}) {
        console.log('🚨 EMERGENCY OVERRIDE: Stopping all audio for critical message');
        
        // Immediate audio stop for emergency
        await this.emergencyAudioStop();
        
        // Use emergency ducking profile
        const emergencyProfile = this.duckingProfiles.emergency;
        await this.applyAudioDucking(emergencyProfile);
        
        // Execute emergency speech with highest priority
        return this.startCarBotSpeech(emergencyText, {
            ...options,
            priority: 'emergency',
            overrideNavigation: true,
            bypassQueue: true
        });
    }
    
    async emergencyAudioStop() {
        // Immediately stop or heavily duck all audio sources
        
        // Stop music playback
        if (this.audioState.isMusicPlaying) {
            await this.pauseMediaPlayback('music');
        }
        
        // Duck navigation audio significantly
        if (this.audioState.isNavigationActive) {
            await this.duckMediaVolume('navigation', 0.05);
        }
        
        // Handle phone call audio
        if (this.audioState.isPhoneCallActive) {
            // Don't interrupt phone calls unless absolutely critical
            await this.duckMediaVolume('phone', 0.1);
        }
    }
    
    async pauseMediaPlayback(mediaType) {
        console.log(`⏸️ Pausing ${mediaType} playback for CarBot speech`);
        
        // This would interface with media controls
        // Platform-specific implementation needed
        
        this.emit('mediaPlaybackPaused', {
            mediaType: mediaType,
            timestamp: Date.now()
        });
    }
    
    async resumeMediaPlayback(mediaType) {
        console.log(`▶️ Resuming ${mediaType} playback`);
        
        // This would interface with media controls
        // Platform-specific implementation needed
        
        this.emit('mediaPlaybackResumed', {
            mediaType: mediaType,
            timestamp: Date.now()
        });
    }
    
    async duckMediaVolume(mediaType, level) {
        console.log(`🔇 Ducking ${mediaType} volume to ${(level * 100).toFixed(0)}%`);
        
        // Media-specific volume control
        // Would require integration with media session APIs
        
        this.emit('mediaVolumeDucked', {
            mediaType: mediaType,
            level: level,
            timestamp: Date.now()
        });
    }
    
    startAudioMonitoring() {
        console.log('👂 Starting continuous audio monitoring...');
        
        // Monitor audio state changes every 500ms
        this.audioMonitoringTimer = setInterval(() => {
            this.monitorAudioState();
        }, 500);
        
        // Detect volume changes from external sources
        this.volumeMonitoringTimer = setInterval(() => {
            this.monitorVolumeChanges();
        }, 1000);
    }
    
    monitorAudioState() {
        // Monitor for changes in audio environment
        
        // Check for new media sessions
        this.detectNewMediaSessions();
        
        // Monitor audio quality and conflicts
        this.detectAudioConflicts();
        
        // Update car context if available
        this.updateCarAudioContext();
    }
    
    detectNewMediaSessions() {
        // Detect new media sessions that might affect ducking
        // This would integrate with system media session APIs
    }
    
    detectAudioConflicts() {
        // Detect when multiple audio sources conflict
        const activeSessions = Object.values(this.mediaSessions).filter(session => session);
        
        if (activeSessions.length > 2) {
            console.log('⚠️ Multiple audio sessions detected - potential conflict');
            this.metrics.mediaSessionConflicts++;
            
            this.emit('audioConflictDetected', {
                activeSessions: activeSessions.length,
                timestamp: Date.now()
            });
        }
    }
    
    // Utility methods
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async checkCommandAvailability(command) {
        return new Promise((resolve, reject) => {
            exec(`which ${command}`, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Command ${command} not available`));
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }
    
    getCarAudioMetrics() {
        return {
            ...this.metrics,
            audioState: this.audioState,
            mediaSessions: this.mediaSessions,
            audioDevices: {
                total: this.audioDevices.available.length,
                carSpeakers: !!this.audioDevices.carSpeakers,
                bluetooth: !!this.audioDevices.bluetooth
            },
            androidAuto: this.androidAuto,
            duckingProfiles: Object.keys(this.duckingProfiles)
        };
    }
    
    // Public API methods
    
    setDuckingProfile(profileName, profile) {
        this.duckingProfiles[profileName] = profile;
        console.log(`🎛️ Custom ducking profile '${profileName}' configured`);
    }
    
    setCarContext(context) {
        // Update car context for better audio decisions
        if (context.speed !== undefined) {
            // Adjust ducking based on driving speed
            const speedFactor = Math.min(1.2, 1 + context.speed / 200);
            this.adjustDuckingForSpeed(speedFactor);
        }
        
        if (context.engineNoise !== undefined) {
            // Adjust for engine noise levels
            this.adjustDuckingForNoise(context.engineNoise);
        }
    }
    
    adjustDuckingForSpeed(speedFactor) {
        // Adjust ducking levels based on driving speed
        Object.keys(this.duckingProfiles).forEach(profileName => {
            const profile = this.duckingProfiles[profileName];
            profile.adjustedLevel = Math.max(0.1, profile.level / speedFactor);
        });
    }
    
    forceAudioRestore() {
        if (this.audioState.isDucked) {
            console.log('🔧 Forcing audio restoration...');
            this.restoreAudioLevels();
        }
    }
    
    destroy() {
        console.log('🗑️ Destroying car audio ducking manager...');
        
        // Clear timers
        if (this.audioMonitoringTimer) clearInterval(this.audioMonitoringTimer);
        if (this.volumeMonitoringTimer) clearInterval(this.volumeMonitoringTimer);
        if (this.mediaSessionMonitor) clearInterval(this.mediaSessionMonitor);
        
        // Restore audio if ducked
        if (this.audioState.isDucked) {
            this.restoreAudioLevels();
        }
        
        this.removeAllListeners();
        console.log('✅ Car audio ducking manager destroyed');
    }
}

module.exports = CarAudioDuckingManager;