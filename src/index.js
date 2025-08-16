#!/usr/bin/env node

require('dotenv').config();
const GoogleAutoAPI = require('./api/googleAutoAPI');
const CarFeatures = require('./utils/carFeatures');
const CarSystemIntegration = require('./services/carSystemIntegration');

// Initialize the application
class CarBot {
    constructor() {
        this.carFeatures = new CarFeatures();
        
        // Initialize advanced AI car system
        this.carSystem = new CarSystemIntegration({
            aiProvider: process.env.AI_PROVIDER || 'groq',
            audioQuality: process.env.AUDIO_QUALITY || 'medium',
            wakeWordSensitivity: process.env.WAKE_WORD_SENSITIVITY || 'medium',
            picovoiceAccessKey: process.env.PICOVOICE_ACCESS_KEY,
            enableNavigation: true,
            enableMusic: true,
            enablePhone: true,
            enableClimate: true,
            enableEmergency: true
        });

        this.api = new GoogleAutoAPI(this.carSystem, {
            port: process.env.PORT || 3000
        });
        
        this.setupSystemIntegration();
        this.setupGracefulShutdown();
    }

    async start() {
        try {
            console.log('🚗 Starting CarBot Advanced AI System...');
            console.log('🎯 Target: Android Auto Platform');
            console.log('🎤 Advanced Voice Recognition: Wake Word + VAD');
            console.log('🤖 AI Provider:', process.env.AI_PROVIDER || 'groq');
            console.log('⚡ Features: Function Calling, Real-time Audio, Visual Feedback');
            
            await this.carSystem.initialize();

            // Test system connections
            console.log('🔍 Testing system connections...');
            const connectionTest = await this.carSystem.testConnection();
            console.log('✅ AI Provider:', connectionTest.ai.success ? 'Connected' : 'Failed');
            console.log('✅ Audio Stream:', connectionTest.audioStream.isStreaming ? 'Active' : 'Inactive');
            
            // Start the API server
            this.api.start();
            
            console.log('✅ CarBot Advanced AI System is ready!');
            console.log('📱 API server running on port', process.env.PORT || 3000);
            console.log('🎧 Listening for voice activation...');
            console.log('👁️ Visual feedback system active');
            
            // Play startup greeting if enabled
            await this.playStartupGreeting();
            
        } catch (error) {
            console.error('❌ Failed to start CarBot:', error);
            process.exit(1);
        }
    }

    async playStartupGreeting() {
        if (process.env.ENABLE_STARTUP_GREETING === 'true') {
            const greetingMessage = process.env.GREETING_MESSAGE || 'Hello master, how can I help you today?';
            const assistantName = process.env.VOICE_ASSISTANT_NAME || 'CarBot';
            
            console.log(`🎤 ${assistantName}: "${greetingMessage}"`);
            
            // Send greeting to TTS
            try {
                if (this.carSystem) {
                    const audioResponse = await this.carSystem.speakResponse(greetingMessage);
                    console.log('🔊 Startup greeting ready for playback');
                    
                    // Optionally play immediately or send to Android app
                    this.broadcastGreeting(greetingMessage, audioResponse);
                }
            } catch (error) {
                console.log('ℹ️ TTS not available for startup greeting:', error.message);
            }
        }
    }

    broadcastGreeting(message, audioResponse = null) {
        // Broadcast greeting to all connected clients/Android apps
        if (this.api && this.api.io) {
            this.api.io.emit('startup_greeting', {
                message: message,
                audio: audioResponse,
                timestamp: new Date().toISOString()
            });
            console.log('📡 Startup greeting broadcasted to connected clients');
        }
    }

    setupSystemIntegration() {
        // Listen for car system events
        this.carSystem.on('systemReady', () => {
            console.log('🚗 Car system integration ready');
        });
        
        this.carSystem.on('voiceActivated', (data) => {
            console.log('🎤 Voice activated:', data.mode);
            this.broadcastEvent('voice_activated', data);
        });
        
        this.carSystem.on('navigationStarted', (data) => {
            console.log('🗺️ Navigation started to:', data.destination);
            this.broadcastEvent('navigation_started', data);
        });
        
        this.carSystem.on('musicStateChanged', (data) => {
            console.log('🎵 Music state:', data);
            this.broadcastEvent('music_state_changed', data);
        });
        
        this.carSystem.on('emergencyActivated', () => {
            console.log('🚨 Emergency mode activated');
            this.broadcastEvent('emergency_activated', { timestamp: Date.now() });
        });
        
        this.carSystem.on('stateChange', (data) => {
            this.broadcastEvent('system_state_changed', data);
        });
    }
    
    broadcastEvent(eventName, data) {
        if (this.api && this.api.io) {
            this.api.io.emit(eventName, {
                ...data,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    setupGracefulShutdown() {
        const shutdown = (signal) => {
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            
            if (this.carSystem) {
                this.carSystem.destroy();
            }
            
            if (this.api) {
                this.api.stop();
            }
            
            console.log('✅ CarBot stopped');
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }
}

// Check if required environment variables are set
function checkEnvironment() {
    const provider = 'groq';
    let apiKeyRequired = 'GROQ_API_KEY';
    
    const required = [
        apiKeyRequired
    ];
    
    const optionalRequired = [
        'GOOGLE_CLOUD_PROJECT_ID',
        'GOOGLE_CLOUD_KEY_FILE', 
        'PICOVOICE_ACCESS_KEY'
    ];

    const optional = [
        'TWITTER_BEARER_TOKEN'
    ];

    console.log('🔍 Checking environment variables...');
    console.log(`🤖 Using AI Provider: ${provider.toUpperCase()}`);
    
    // Check optional variables and warn if missing
    const missingOptional = [...optionalRequired, ...optional].filter(key => !process.env[key]);
    if (missingOptional.length > 0) {
        console.warn('⚠️  Optional environment variables not set:');
        missingOptional.forEach(key => {
            if (optional.includes(key)) {
                console.warn(`   - ${key} (Social media features will be disabled)`);
            } else {
                console.warn(`   - ${key} (Voice features will be limited)`);
            }
        });
    }

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(key => console.error(`   - ${key}`));
        console.error('\n💡 Please check your .env file');
        process.exit(1);
    }
}

// Main execution
if (require.main === module) {
    console.log('🚀 CarBot - Advanced AI Voice Assistant for Android Auto');
    console.log('=========================================================');
    console.log('🎯 Features: VAD, Function Calling, Real-time Audio, Visual Feedback');
    console.log('🤖 Inspired by onju-voice architecture for superior performance');
    console.log('');
    
    // Check environment
    checkEnvironment();
    
    // Create and start the bot
    const bot = new CarBot();
    bot.start();
}

module.exports = CarBot;