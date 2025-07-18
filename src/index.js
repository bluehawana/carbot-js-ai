#!/usr/bin/env node

require('dotenv').config();
const GoogleAutoAPI = require('./api/googleAutoAPI');
const CarFeatures = require('./utils/carFeatures');

// Initialize the application
class EcarxBot {
    constructor() {
        this.carFeatures = new CarFeatures();
        this.api = new GoogleAutoAPI({
            port: process.env.PORT || 3000
        });
        
        this.setupGracefulShutdown();
    }

    async start() {
        try {
            console.log('🚗 Starting ECARX Bot...');
            console.log('🎯 Target: Google Auto Platform');
            console.log('🎤 Wake word: "hi ecarx"');
            
            // Start the API server
            this.api.start();
            
            console.log('✅ ECARX Bot is ready!');
            console.log('📱 API server running on port', process.env.PORT || 3000);
            console.log('🎧 Listening for wake word...');
            
        } catch (error) {
            console.error('❌ Failed to start ECARX Bot:', error);
            process.exit(1);
        }
    }

    setupGracefulShutdown() {
        const shutdown = (signal) => {
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            
            if (this.api) {
                this.api.stop();
            }
            
            console.log('✅ ECARX Bot stopped');
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }
}

// Check if required environment variables are set
function checkEnvironment() {
    const required = [
        'GOOGLE_CLOUD_PROJECT_ID',
        'GOOGLE_CLOUD_KEY_FILE',
        'OPENAI_API_KEY',
        'PICOVOICE_ACCESS_KEY'
    ];

    const optional = [
        'TWITTER_BEARER_TOKEN'
    ];

    console.log('🔍 Checking environment variables...');
    
    // Check optional variables and warn if missing
    const missingOptional = optional.filter(key => !process.env[key]);
    if (missingOptional.length > 0) {
        console.warn('⚠️  Optional environment variables not set:');
        missingOptional.forEach(key => console.warn(`   - ${key} (Twitter features will be disabled)`));
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
    console.log('🚀 ECARX Bot - Voice Assistant for Google Auto');
    console.log('================================================');
    
    // Check environment
    checkEnvironment();
    
    // Create and start the bot
    const bot = new EcarxBot();
    bot.start();
}

module.exports = EcarxBot;