#!/usr/bin/env node

require('dotenv').config();
const readline = require('readline');
const AIProvider = require('./ai/aiProvider');
const ConversationHandler = require('./chatbot/conversationHandler');
const CarFeatures = require('./utils/carFeatures');

class EcarxTestRunner {
    constructor() {
        this.carFeatures = new CarFeatures();
        this.conversationHandler = new ConversationHandler({
            provider: process.env.AI_PROVIDER || 'openai'
        });
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        this.isRunning = false;
    }

    async start() {
        console.log('🚗 ECARX Bot - Local Test Runner');
        console.log('================================');
        console.log('');
        console.log('🎤 Wake word: "hi ecarx"');
        console.log('📱 Running on your device for testing');
        console.log('🔧 Type "config" to change AI provider');
        console.log('❌ Type "exit" to quit');
        console.log('');

        // Show current configuration
        await this.showConfiguration();
        
        this.isRunning = true;
        console.log('🎯 ECARX Bot is ready! Type your message or say "hi ecarx"...');
        console.log('');
        
        this.startConversation();
    }

    async showConfiguration() {
        const providers = AIProvider.getAvailableProviders();
        const currentProvider = process.env.AI_PROVIDER || 'openai';
        const provider = providers.find(p => p.name === currentProvider) || providers[0];
        
        console.log('⚙️  Current Configuration:');
        console.log(`   AI Provider: ${provider.displayName}`);
        console.log(`   Status: ${provider.free ? 'FREE' : 'PAID'}`);
        console.log(`   Description: ${provider.description}`);
        
        // Test AI connection
        try {
            const ai = new AIProvider({ provider: currentProvider });
            const result = await ai.testConnection();
            
            if (result.success) {
                console.log(`   Connection: ✅ Connected`);
                console.log(`   Model: ${result.model}`);
            } else {
                console.log(`   Connection: ⚠️  No API key (using fallback)`);
            }
        } catch (error) {
            console.log(`   Connection: ⚠️  No API key (using fallback)`);
        }
        
        console.log('');
    }

    startConversation() {
        this.rl.question('You: ', async (input) => {
            if (!this.isRunning) return;
            
            const trimmedInput = input.trim().toLowerCase();
            
            // Handle special commands
            if (trimmedInput === 'exit') {
                console.log('👋 Goodbye! ECARX Bot shutting down...');
                this.rl.close();
                process.exit(0);
                return;
            }
            
            if (trimmedInput === 'config') {
                await this.changeProvider();
                this.startConversation();
                return;
            }
            
            if (trimmedInput === 'help') {
                this.showHelp();
                this.startConversation();
                return;
            }
            
            if (trimmedInput === 'car') {
                this.showCarStatus();
                this.startConversation();
                return;
            }
            
            // Check for wake word
            if (trimmedInput.includes('hi ecarx') || trimmedInput.includes('hey ecarx')) {
                console.log('🎤 Wake word detected! ECARX activated...');
                console.log('');
            }
            
            // Process the message
            await this.processMessage(input);
            
            // Continue conversation
            this.startConversation();
        });
    }

    async processMessage(message) {
        try {
            console.log('🧠 Processing your request...');
            
            // Get car context
            const carContext = this.carFeatures.getCarContext();
            
            // Process with conversation handler
            const response = await this.conversationHandler.processMessage(message, carContext);
            
            console.log(`🤖 ECARX: ${response.response}`);
            
            // Handle actions
            if (response.actions && response.actions.length > 0) {
                console.log('');
                console.log('🔧 Actions:');
                response.actions.forEach(action => {
                    this.executeAction(action);
                });
            }
            
            console.log('');
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            console.log('🤖 ECARX: Sorry, I had trouble processing that. Could you try again?');
            console.log('');
        }
    }

    executeAction(action) {
        switch (action.type) {
            case 'navigation':
                if (action.action === 'start') {
                    console.log('📍 Starting navigation...');
                    // Simulate navigation start
                    this.carFeatures.updateVehicleData({ navigationActive: true });
                }
                break;
                
            case 'music':
                if (action.action === 'play') {
                    console.log('🎵 Playing music...');
                    this.carFeatures.updateVehicleData({ musicPlaying: true });
                }
                break;
                
            case 'phone':
                if (action.action === 'call') {
                    console.log('📞 Making phone call...');
                }
                break;
                
            default:
                console.log(`⚙️  ${action.type}: ${action.action}`);
        }
    }

    async changeProvider() {
        console.log('');
        console.log('🔧 Available AI Providers:');
        console.log('=========================');
        
        const providers = AIProvider.getAvailableProviders();
        providers.forEach((provider, index) => {
            const status = provider.free ? '[FREE]' : '[PAID]';
            const current = provider.name === (process.env.AI_PROVIDER || 'openai') ? ' ⭐' : '';
            console.log(`${index + 1}. ${provider.displayName} ${status}${current}`);
            console.log(`   ${provider.description}`);
        });
        
        console.log('');
        
        return new Promise((resolve) => {
            this.rl.question('Choose provider (1-' + providers.length + ') or press Enter to continue: ', (choice) => {
                if (choice.trim()) {
                    const index = parseInt(choice) - 1;
                    if (index >= 0 && index < providers.length) {
                        const selected = providers[index];
                        process.env.AI_PROVIDER = selected.name;
                        this.conversationHandler = new ConversationHandler({
                            provider: selected.name
                        });
                        console.log(`✅ Switched to ${selected.displayName}`);
                        console.log('');
                    }
                }
                resolve();
            });
        });
    }

    showHelp() {
        console.log('');
        console.log('🆘 ECARX Bot Help:');
        console.log('==================');
        console.log('');
        console.log('Commands:');
        console.log('  "hi ecarx" + message  - Activate with wake word');
        console.log('  "config"              - Change AI provider');
        console.log('  "car"                 - Show car status');
        console.log('  "help"                - Show this help');
        console.log('  "exit"                - Quit ECARX Bot');
        console.log('');
        console.log('Car Functions:');
        console.log('  "Navigate to [place]" - Start navigation');
        console.log('  "Play music"          - Control music');
        console.log('  "Call [contact]"      - Make phone calls');
        console.log('  "Check fuel level"    - Vehicle status');
        console.log('  "Set temperature"     - Climate control');
        console.log('');
        console.log('Examples:');
        console.log('  "Hi ECARX, navigate to the nearest gas station"');
        console.log('  "Hi ECARX, play some jazz music"');
        console.log('  "Hi ECARX, what\'s my fuel level?"');
        console.log('');
    }

    showCarStatus() {
        console.log('');
        console.log('🚗 Car Status:');
        console.log('==============');
        
        const status = this.carFeatures.getVehicleStatus();
        const context = this.carFeatures.getCarContext();
        
        console.log(`Speed: ${status.speed} mph`);
        console.log(`Fuel Level: ${status.fuelLevel}%`);
        console.log(`Battery: ${status.batteryLevel}%`);
        console.log(`Engine Temp: ${status.engineTemperature}°F`);
        console.log(`Navigation: ${context.navigationActive ? 'Active' : 'Inactive'}`);
        console.log(`Music: ${context.musicPlaying ? 'Playing' : 'Stopped'}`);
        console.log('');
    }
}

// Main execution
if (require.main === module) {
    const testRunner = new EcarxTestRunner();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n👋 ECARX Bot shutting down...');
        process.exit(0);
    });
    
    testRunner.start().catch(error => {
        console.error('❌ Failed to start ECARX Bot:', error);
        process.exit(1);
    });
}

module.exports = EcarxTestRunner;