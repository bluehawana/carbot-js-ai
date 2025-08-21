const EventEmitter = require('events');
const VoiceActivityDetector = require('./vadService');
const WakeWordDetector = require('../wakeword/detector');
const VisualFeedbackService = require('./visualFeedbackService');
const AudioStreamService = require('./audioStreamService');
const ConversationFlowService = require('./conversationFlowService');
const AIProvider = require('../ai/aiProvider');
const OptimizedTextToSpeechService = require('../audio/optimizedTextToSpeech');

class CarSystemIntegration extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            enableNavigation: options.enableNavigation ?? true,
            enableMusic: options.enableMusic ?? true,
            enablePhone: options.enablePhone ?? true,
            enableClimate: options.enableClimate ?? true,
            enableEmergency: options.enableEmergency ?? true,
            aiProvider: options.aiProvider || 'groq',
            audioQuality: options.audioQuality || 'medium',
            wakeWordSensitivity: options.wakeWordSensitivity || 'medium',
            conversationTimeout: options.conversationTimeout || 30000,
            ...options
        };
        
        // Initialize all services
        this.services = {
            vad: new VoiceActivityDetector({
                energyThreshold: this.getVADThreshold(),
                minSpeechFrames: 3
            }),
            visualFeedback: new VisualFeedbackService({
                enableLED: true,
                enableScreen: true
            }),
            audioStream: new AudioStreamService({
                protocol: 'udp',
                sampleRate: 16000,
                udpPort: 8082
            }),
            conversationFlow: new ConversationFlowService({
                interruptionTimeout: 2000,
                enableContextAwareness: true,
                aiProvider: null // Will be set after aiProvider is created
            }),
            aiProvider: new AIProvider({
                provider: this.options.aiProvider
            }),
            wakeWordDetector: new WakeWordDetector(
                this.options.picovoiceAccessKey,
                this.getWakeWordSensitivity()
            ),
            tts: new OptimizedTextToSpeechService()
        };
        
        // Link AI provider to conversation flow after creation
        this.services.conversationFlow.aiProvider = this.services.aiProvider;
        
        // Car system states
        this.carState = {
            engine: { running: false, rpm: 0, temperature: 90 },
            speed: 0,
            location: { lat: 0, lng: 0, heading: 0 },
            navigation: { active: false, destination: null, eta: null },
            music: { playing: false, track: null, volume: 50 },
            phone: { connected: false, inCall: false, contacts: [] },
            climate: { temperature: 22, mode: 'auto', fanSpeed: 3 },
            doors: { locked: true, windows: { fl: 0, fr: 0, rl: 0, rr: 0 } },
            lights: { headlights: false, fog: false, hazard: false },
            safety: { seatbelt: true, airbag: true, abs: true }
        };
        
        // Integration state
        this.integrationState = {
            isActive: false,
            activeMode: 'idle', // idle, listening, processing, speaking
            currentTask: null,
            lastActivity: Date.now(),
            emergencyMode: false
        };
    }
    
    async initialize() {
        this.setupServiceConnections();
        this.setupCarDataSimulation();
        await this.startServices();
        
        console.log('🚗 CarBot System Integration initialized');
        this.emit('systemReady');
    }
    
    setupServiceConnections() {
        // Voice Activity Detection
        this.services.vad.on('speechStart', () => {
            this.handleSpeechStart();
        });
        
        this.services.vad.on('speechEnd', (audioData) => {
            this.handleSpeechEnd(audioData);
        });

        // Wake Word Detection
        this.services.wakeWordDetector.onWakeWord(() => {
            this.handleVoiceActivation({ mode: 'wakeWord' });
        });
        
        // Conversation Flow
        this.services.conversationFlow.on('userInput', (turn) => {
            this.handleUserInput(turn);
        });
        
        this.services.conversationFlow.on('assistantResponse', (response) => {
            this.handleAssistantResponse(response);
        });
        
        // Audio Streaming
        this.services.audioStream.on('processedAudio', (data) => {
            this.services.vad.processAudioFrame(data.data);
        });
        
        // Visual Feedback Updates
        this.on('stateChange', (state) => {
            this.services.visualFeedback.setState(state.mode, state.options);
        });
    }
    
    setupCarDataSimulation() {
        // Simulate car data updates
        setInterval(() => {
            this.updateCarData();
        }, 1000);
        
        // Simulate location updates when navigating
        setInterval(() => {
            if (this.carState.navigation.active) {
                this.updateLocation();
            }
        }, 5000);
    }
    
    async startServices() {
        await this.services.wakeWordDetector.initialize();
        this.services.wakeWordDetector.startListening();
        this.services.vad.start();
        this.services.audioStream.startStreaming();
        this.services.visualFeedback.setState('idle');
        
        this.integrationState.isActive = true;
        this.setMode('idle');
    }
    
    // Core interaction handlers
    handleVoiceActivation(data) {
        console.log('🎤 Voice activation detected:', data.mode);
        
        this.setMode('listening');
        this.services.conversationFlow.startConversation();
        
        if (data.mode === 'continuous') {
            this.services.vad.options.minSilenceFrames = 20; // Longer silence for continuous
        }
    }
    
    handleSpeechStart() {
        console.log('🗣️ Speech started');
        this.setMode('listening');
        this.updateLastActivity();
    }
    
    async handleSpeechEnd(audioData) {
        if (!audioData) return;
        
        console.log('🗣️ Speech ended, processing...');
        this.setMode('processing');
        
        try {
            // Convert audio to text (STT)
            const transcript = await this.processAudioToText(audioData);
            
            if (transcript && transcript.trim()) {
                // Process through conversation flow
                const response = await this.services.conversationFlow.processUserInput(
                    transcript,
                    { audioData: audioData }
                );
                
                if (response) {
                    await this.handleAssistantResponse(response);
                }
            }
        } catch (error) {
            console.error('Error processing speech:', error);
            this.setMode('idle');
        }
    }
    
    async handleUserInput(turn) {
        console.log('💭 Processing user input:', turn.content);
        
        // Extract car-specific intents
        const carIntent = this.extractCarIntent(turn.content);
        
        if (carIntent) {
            turn.carIntent = carIntent;
            await this.executeCarFunction(carIntent, turn);
        }
    }
    
    async handleAssistantResponse(response) {
        console.log('🤖 Assistant response:', response.content);
        
        this.setMode('speaking');
        
        // Text-to-speech and audio output
        await this.speakResponse(response.content);
        
        // Handle function results if present
        if (response.function_result) {
            await this.handleFunctionResult(response.function_result, response.function_name);
        }
        
        this.services.conversationFlow.onResponseCompleted();
        this.setMode('idle');
    }
    
    handleButtonAction(data) {
        console.log('🎮 Button action:', data.action);
        
        switch (data.action) {
            case 'music_previous':
                this.previousTrack();
                break;
            case 'music_next':
                this.nextTrack();
                break;
            case 'volume_up':
                this.adjustVolume(5);
                break;
            case 'volume_down':
                this.adjustVolume(-5);
                break;
            case 'phone_toggle':
                this.togglePhone();
                break;
            default:
                console.log('Unknown button action:', data.action);
        }
    }
    
    // Car system functions
    extractCarIntent(text) {
        const lowercaseText = text.toLowerCase();
        
        // Navigation intents
        if (lowercaseText.includes('navigate') || lowercaseText.includes('directions')) {
            return {
                category: 'navigation',
                action: 'navigate',
                parameters: this.extractNavigationParams(text)
            };
        }
        
        // Music intents
        if (lowercaseText.includes('play') || lowercaseText.includes('music')) {
            return {
                category: 'music',
                action: 'play',
                parameters: this.extractMusicParams(text)
            };
        }
        
        // Phone intents
        if (lowercaseText.includes('call') || lowercaseText.includes('phone')) {
            return {
                category: 'phone',
                action: 'call',
                parameters: this.extractPhoneParams(text)
            };
        }
        
        // Climate intents
        if (lowercaseText.includes('temperature') || lowercaseText.includes('climate')) {
            return {
                category: 'climate',
                action: 'adjust',
                parameters: this.extractClimateParams(text)
            };
        }
        
        return null;
    }
    
    extractNavigationParams(text) {
        const params = {};
        
        // Extract destination
        const patterns = [
            /(?:to|navigate to|go to)\s+([^,.!?]+)/i,
            /directions to\s+([^,.!?]+)/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                params.destination = match[1].trim();
                break;
            }
        }
        
        // Extract route preference
        if (text.includes('fastest')) params.routePreference = 'fastest';
        else if (text.includes('shortest')) params.routePreference = 'shortest';
        else if (text.includes('eco')) params.routePreference = 'eco';
        
        return params;
    }
    
    extractMusicParams(text) {
        const params = {};
        
        // Extract song/artist
        const patterns = [
            /play\s+([^,.!?]+)/i,
            /music\s+([^,.!?]+)/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                params.query = match[1].trim();
                break;
            }
        }
        
        // Extract actions
        if (text.includes('pause')) params.action = 'pause';
        else if (text.includes('stop')) params.action = 'stop';
        else if (text.includes('skip')) params.action = 'skip';
        else if (text.includes('previous')) params.action = 'previous';
        else params.action = 'play';
        
        return params;
    }
    
    extractPhoneParams(text) {
        const params = {};
        
        // Extract contact name or number
        const patterns = [
            /call\s+([^,.!?]+)/i,
            /phone\s+([^,.!?]+)/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                params.contact = match[1].trim();
                break;
            }
        }
        
        return params;
    }
    
    extractClimateParams(text) {
        const params = {};
        
        // Extract temperature
        const tempMatch = text.match(/(\d+)\s*(?:degrees?|°)/i);
        if (tempMatch) {
            params.temperature = parseInt(tempMatch[1]);
        }
        
        // Extract mode
        if (text.includes('heat')) params.mode = 'heat';
        else if (text.includes('cool') || text.includes('ac')) params.mode = 'cool';
        else if (text.includes('auto')) params.mode = 'auto';
        
        return params;
    }
    
    async executeCarFunction(carIntent, turn) {
        const { category, action, parameters } = carIntent;
        
        try {
            switch (category) {
                case 'navigation':
                    await this.handleNavigationCommand(action, parameters);
                    break;
                case 'music':
                    await this.handleMusicCommand(action, parameters);
                    break;
                case 'phone':
                    await this.handlePhoneCommand(action, parameters);
                    break;
                case 'climate':
                    await this.handleClimateCommand(action, parameters);
                    break;
                default:
                    console.log('Unknown car intent category:', category);
            }
        } catch (error) {
            console.error(`Error executing ${category} command:`, error);
            this.speakResponse(`Sorry, I couldn't ${action} ${category}.`);
        }
    }
    
    async handleNavigationCommand(action, params) {
        if (action === 'navigate' && params.destination) {
            this.carState.navigation = {
                active: true,
                destination: params.destination,
                eta: '15 minutes',
                distance: '8.2 km',
                routePreference: params.routePreference || 'fastest'
            };
            
            await this.speakResponse(`Navigation started to ${params.destination}. ETA is 15 minutes.`);
            this.emit('navigationStarted', this.carState.navigation);
        }
    }
    
    async handleMusicCommand(action, params) {
        switch (action) {
            case 'play':
                this.carState.music.playing = true;
                if (params.query) {
                    this.carState.music.track = params.query;
                    await this.speakResponse(`Now playing ${params.query}`);
                } else {
                    await this.speakResponse('Music resumed');
                }
                break;
            case 'pause':
                this.carState.music.playing = false;
                await this.speakResponse('Music paused');
                break;
            case 'skip':
                this.nextTrack();
                break;
            case 'previous':
                this.previousTrack();
                break;
        }
        
        this.emit('musicStateChanged', this.carState.music);
    }
    
    async handlePhoneCommand(action, params) {
        if (action === 'call' && params.contact) {
            this.carState.phone.inCall = true;
            await this.speakResponse(`Calling ${params.contact}`);
            this.emit('phoneCallStarted', { contact: params.contact });
        }
    }
    
    async handleClimateCommand(action, params) {
        if (params.temperature) {
            this.carState.climate.temperature = params.temperature;
        }
        if (params.mode) {
            this.carState.climate.mode = params.mode;
        }
        
        await this.speakResponse(
            `Climate set to ${this.carState.climate.temperature} degrees in ${this.carState.climate.mode} mode`
        );
        
        this.emit('climateChanged', this.carState.climate);
    }
    
    // Media controls
    nextTrack() {
        const tracks = ['Song A', 'Song B', 'Song C', 'Song D'];
        const currentIndex = tracks.indexOf(this.carState.music.track) || 0;
        this.carState.music.track = tracks[(currentIndex + 1) % tracks.length];
        this.speakResponse(`Next track: ${this.carState.music.track}`);
        this.emit('trackChanged', this.carState.music);
    }
    
    previousTrack() {
        const tracks = ['Song A', 'Song B', 'Song C', 'Song D'];
        const currentIndex = tracks.indexOf(this.carState.music.track) || 0;
        this.carState.music.track = tracks[(currentIndex - 1 + tracks.length) % tracks.length];
        this.speakResponse(`Previous track: ${this.carState.music.track}`);
        this.emit('trackChanged', this.carState.music);
    }
    
    adjustVolume(delta) {
        this.carState.music.volume = Math.max(0, Math.min(100, this.carState.music.volume + delta));
        this.speakResponse(`Volume ${delta > 0 ? 'up' : 'down'}: ${this.carState.music.volume}%`);
        this.emit('volumeChanged', this.carState.music.volume);
    }
    
    togglePhone() {
        if (this.carState.phone.inCall) {
            this.carState.phone.inCall = false;
            this.speakResponse('Call ended');
            this.emit('phoneCallEnded');
        } else {
            this.speakResponse('No active call');
        }
    }
    
    // Emergency handling
    activateEmergencyMode() {
        this.integrationState.emergencyMode = true;
        this.setMode('emergency');
        
        this.speakResponse('Emergency mode activated. Contacting emergency services.');
        
        // Simulate emergency call
        setTimeout(() => {
            this.speakResponse('Emergency services have been contacted. Help is on the way.');
        }, 2000);
        
        this.emit('emergencyActivated');
    }
    
    // Audio processing
    async processAudioToText(audioData) {
        // This would integrate with STT service
        // For now, simulate with sample text
        const sampleTexts = [
            "Navigate to downtown",
            "Play some music",
            "Call John",
            "Set temperature to 23 degrees",
            "What's the weather like?"
        ];
        
        return sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
    }
    
    async speakResponse(text, options = {}) {
        console.log('🔊 Speaking:', text);
        try {
            // Use profile from options or default to current profile
            const profile = options.profile || this.services.tts.currentProfile || 'default';
            
            const audioContent = await this.services.tts.synthesizeSpeech(text, null, profile);
            
            if (audioContent) {
                console.log('🔊 Audio content generated, now playing...');
                await this.services.tts.playAudio(audioContent);
                console.log('✅ Speech playback completed');
                
                // Emit event for Android notification
                this.emit('speechPlayed', { text, audioContent, options });
                
                return audioContent;
            } else {
                console.warn('🔇 No audio content generated');
                return null;
            }
        } catch (error) {
            console.error('🔊 Error generating or playing speech:', error.message);
            
            // Try emergency fallback - just log the text 
            console.log('💬 FALLBACK - Text that should have been spoken:', text);
            
            // Emit error event
            this.emit('speechError', { text, error: error.message });
            
            return null;
        }
    }
    
    async handleFunctionResult(result, functionName) {
        console.log(`✅ Function ${functionName} completed:`, result);
        
        // Update car state based on function results
        switch (functionName) {
            case 'navigate_to_destination':
                if (result.success) {
                    this.carState.navigation.active = true;
                    this.carState.navigation.destination = result.destination || 'Unknown';
                    this.carState.navigation.eta = result.eta;
                    this.carState.navigation.distance = result.distance;
                }
                break;
            case 'control_music':
                if (result.success) {
                    this.carState.music.playing = result.action !== 'pause';
                    if (result.current_song) {
                        this.carState.music.track = result.current_song;
                    }
                }
                break;
            case 'control_climate':
                if (result.success) {
                    this.carState.climate.temperature = result.temperature;
                    this.carState.climate.mode = result.mode;
                }
                break;
        }
        
        this.emit('functionCompleted', { functionName, result });
    }
    
    // State management
    setMode(mode, options = {}) {
        const previousMode = this.integrationState.activeMode;
        this.integrationState.activeMode = mode;
        this.updateLastActivity();
        
        this.emit('stateChange', {
            mode: mode,
            previous: previousMode,
            options: options,
            timestamp: Date.now()
        });
        
        console.log(`🚗 Mode changed: ${previousMode} → ${mode}`);
    }
    
    updateLastActivity() {
        this.integrationState.lastActivity = Date.now();
    }
    
    updateCarData() {
        // Simulate realistic car data changes
        if (this.carState.engine.running) {
            this.carState.speed = Math.max(0, this.carState.speed + (Math.random() - 0.5) * 10);
            this.carState.engine.rpm = 800 + this.carState.speed * 50;
        }
        
        // Update location if navigating
        if (this.carState.navigation.active) {
            this.carState.location.lat += (Math.random() - 0.5) * 0.001;
            this.carState.location.lng += (Math.random() - 0.5) * 0.001;
        }
        
        this.emit('carDataUpdated', this.carState);
    }
    
    updateLocation() {
        if (this.carState.navigation.active) {
            // Simulate progress toward destination
            const progress = Math.random() * 0.1;
            this.carState.location.lat += progress * 0.001;
            this.carState.location.lng += progress * 0.001;
            
            this.emit('locationUpdated', this.carState.location);
        }
    }
    
    getWakeWordSensitivity() {
        const sensitivityMap = {
            low: 0.3,
            medium: 0.5,
            high: 0.7
        };
        return sensitivityMap[this.options.wakeWordSensitivity] || 0.5;
    }

    getVADThreshold() {
        const thresholds = {
            low: 0.005,
            medium: 0.01,
            high: 0.02
        };
        
        return thresholds[this.options.wakeWordSensitivity] || thresholds.medium;
    }
    
    // Public API
    getSystemState() {
        return {
            integration: { ...this.integrationState },
            car: { ...this.carState },
            services: {
                vad: this.services.vad.getStats(),
                audioStream: this.services.audioStream.getStats(),
                conversationFlow: this.services.conversationFlow.getState(),
                tapToWake: this.services.tapToWake.getState()
            }
        };
    }
    
    async testConnection() {
        const results = {
            ai: await this.services.aiProvider.testConnection(),
            audioStream: this.services.audioStream.getStats(),
            vad: this.services.vad.getStats()
        };
        
        return results;
    }
    
    configureSystem(config) {
        if (config.audioQuality) {
            this.services.audioStream.setQualityProfile(config.audioQuality);
        }
        
        if (config.wakeWordSensitivity) {
            this.services.tapToWake.setSensitivity(config.wakeWordSensitivity);
        }
        
        if (config.aiProvider) {
            this.services.aiProvider.switchProvider(config.aiProvider);
        }
        
        this.emit('systemConfigured', config);
    }
    
    // Manual wake word trigger for testing and fallback mode
    triggerWakeWord(source = 'api') {
        console.log(`🎯 Wake word triggered externally (${source})`);
        return this.services.wakeWordDetector.triggerWakeWord(source);
    }
    
    // Handle voice commands directly (for testing without microphone)
    async handleVoiceCommand(commandText) {
        console.log(`🎤 Processing voice command: "${commandText}"`);
        
        try {
            this.setMode('processing');
            
            // Process through conversation flow
            const response = await this.services.conversationFlow.processUserInput(
                commandText,
                { source: 'api', timestamp: Date.now() }
            );
            
            if (response) {
                await this.handleAssistantResponse(response);
                return response;
            } else {
                // Fallback response if conversation flow doesn't work
                const aiResponse = await this.services.aiProvider.generateResponse([
                    { role: 'user', content: commandText }
                ]);
                
                const fallbackResponse = {
                    content: aiResponse.content,
                    audioResponse: null
                };
                
                await this.handleAssistantResponse(fallbackResponse);
                return fallbackResponse;
            }
        } catch (error) {
            console.error('Error processing voice command:', error);
            this.setMode('idle');
            
            const errorResponse = {
                content: "I'm sorry, I couldn't process that command. Could you try again?",
                audioResponse: null,
                error: error.message
            };
            
            return errorResponse;
        }
    }
    
    destroy() {
        // Stop all services
        Object.values(this.services).forEach(service => {
            if (service.destroy) {
                service.destroy();
            }
        });
        
        this.integrationState.isActive = false;
        this.removeAllListeners();
        
        console.log('🗑️ Car system integration destroyed');
    }
}

module.exports = CarSystemIntegration;