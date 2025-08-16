#!/usr/bin/env node

require('dotenv').config();
const GoogleAutoAPI = require('./api/googleAutoAPI');
const CarFeatures = require('./utils/carFeatures');

// Initialize the application
class CarBot {
    constructor() {
        this.carFeatures = new CarFeatures();
        this.api = new GoogleAutoAPI({
            port: process.env.PORT || 3000
        });
        
        this.setupGracefulShutdown();
    }

    async start() {
        try {
            console.log('🚗 Starting CarBot...');
            console.log('🎯 Target: Google Auto Platform');
            console.log('🎤 Wake word: "hicar"');
            
            // Start the API server
            this.api.start();
            
            console.log('✅ CarBot is ready!');
            console.log('📱 API server running on port', process.env.PORT || 3000);
            console.log('🎧 Listening for wake word...');
            
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
            
            // Send greeting to TTS if available
            try {
                if (this.api && this.api.textToSpeech) {
                    const audioResponse = await this.api.textToSpeech.synthesize(greetingMessage);
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

    setupGracefulShutdown() {
        const shutdown = (signal) => {
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            
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
    const provider = process.env.AI_PROVIDER || 'groq';
    let apiKeyRequired = '';
    
    switch (provider.toLowerCase()) {
        case 'openai':
            apiKeyRequired = 'OPENAI_API_KEY';
            break;
        case 'groq':
            apiKeyRequired = 'GROQ_API_KEY';
            break;
        case 'perplexity':
            apiKeyRequired = 'PERPLEXITY_API_KEY';
            break;
        case 'claude':
            apiKeyRequired = 'ANTHROPIC_API_KEY';
            break;
        default:
            apiKeyRequired = 'GROQ_API_KEY'; // default to Groq
    }
    
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
    console.log('🚀 CarBot - Voice Assistant for Google Auto');
    console.log('================================================');
    
    // Check environment
    checkEnvironment();
    
    // Create and start the bot
    const bot = new CarBot();
    bot.start();
}

module.exports = CarBot;