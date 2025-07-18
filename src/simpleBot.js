#!/usr/bin/env node

require('dotenv').config();
const readline = require('readline');
const axios = require('axios');

class SimpleEcarxBot {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        this.carStatus = {
            speed: 0,
            fuelLevel: 75,
            batteryLevel: 90,
            navigationActive: false,
            musicPlaying: false,
            currentSong: null
        };
    }

    async start() {
        console.log('🚗 ECARX Bot - Voice Assistant for Cars');
        console.log('======================================');
        console.log('');
        console.log('🎤 Wake word: "hi ecarx"');
        console.log('🤖 AI: Groq Llama3 (Ultra-fast & Free)');
        console.log('📱 Running locally on your device');
        console.log('');
        console.log('Commands:');
        console.log('  • Type any car-related request');
        console.log('  • "car" - Show vehicle status');
        console.log('  • "help" - Show all commands');
        console.log('  • "exit" - Quit');
        console.log('');
        console.log('🎯 ECARX Bot ready! Try: "Hi ECARX, navigate to the mall"');
        console.log('');
        
        this.startConversation();
    }

    startConversation() {
        this.rl.question('You: ', async (input) => {
            const message = input.trim();
            
            if (message.toLowerCase() === 'exit') {
                console.log('👋 ECARX Bot shutting down. Safe travels!');
                this.rl.close();
                return;
            }
            
            if (message.toLowerCase() === 'car') {
                this.showCarStatus();
                this.startConversation();
                return;
            }
            
            if (message.toLowerCase() === 'help') {
                this.showHelp();
                this.startConversation();
                return;
            }
            
            if (message) {
                await this.processMessage(message);
            }
            
            this.startConversation();
        });
    }

    async processMessage(message) {
        // Check for wake word
        if (message.toLowerCase().includes('hi ecarx') || message.toLowerCase().includes('hey ecarx')) {
            console.log('🎤 Wake word detected! Activating ECARX...');
        }
        
        console.log('🧠 Thinking...');
        
        try {
            const response = await this.getAIResponse(message);
            console.log(`🤖 ECARX: ${response}`);
            
            // Simulate car actions based on the message
            this.handleCarActions(message);
            
        } catch (error) {
            console.log('🤖 ECARX: I understand you want help with your car. How can I assist you today?');
        }
        
        console.log('');
    }

    async getAIResponse(message) {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama3-8b-8192',
            messages: [
                {
                    role: 'system',
                    content: `You are ECARX, a helpful car voice assistant. 
                    
Current car status:
- Speed: ${this.carStatus.speed} mph
- Fuel Level: ${this.carStatus.fuelLevel}%
- Battery: ${this.carStatus.batteryLevel}%
- Navigation: ${this.carStatus.navigationActive ? 'Active' : 'Inactive'}
- Music: ${this.carStatus.musicPlaying ? 'Playing' : 'Stopped'}

Respond briefly and helpfully to car-related requests. Keep responses under 30 words and be conversational.`
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            max_tokens: 80,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        return response.data.choices[0].message.content.trim();
    }

    handleCarActions(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('navigate') || lowerMessage.includes('directions')) {
            this.carStatus.navigationActive = true;
            console.log('📍 Navigation started');
        }
        
        if (lowerMessage.includes('play music') || lowerMessage.includes('play song')) {
            this.carStatus.musicPlaying = true;
            this.carStatus.currentSong = 'Your favorite playlist';
            console.log('🎵 Music started playing');
        }
        
        if (lowerMessage.includes('stop music')) {
            this.carStatus.musicPlaying = false;
            this.carStatus.currentSong = null;
            console.log('🔇 Music stopped');
        }
        
        if (lowerMessage.includes('fuel') || lowerMessage.includes('gas')) {
            console.log(`⛽ Fuel level: ${this.carStatus.fuelLevel}%`);
        }
        
        if (lowerMessage.includes('call') && lowerMessage.includes('emergency')) {
            console.log('🚨 Emergency services contacted');
        }
    }

    showCarStatus() {
        console.log('');
        console.log('🚗 Vehicle Status:');
        console.log('=================');
        console.log(`Speed: ${this.carStatus.speed} mph`);
        console.log(`Fuel Level: ${this.carStatus.fuelLevel}%`);
        console.log(`Battery: ${this.carStatus.batteryLevel}%`);
        console.log(`Navigation: ${this.carStatus.navigationActive ? '✅ Active' : '❌ Inactive'}`);
        console.log(`Music: ${this.carStatus.musicPlaying ? '🎵 Playing' : '🔇 Stopped'}`);
        if (this.carStatus.currentSong) {
            console.log(`Current Song: ${this.carStatus.currentSong}`);
        }
        console.log('');
    }

    showHelp() {
        console.log('');
        console.log('🆘 ECARX Bot Help:');
        console.log('==================');
        console.log('');
        console.log('Car Functions:');
        console.log('  "Hi ECARX, navigate to [place]"  - Start navigation');
        console.log('  "Hi ECARX, play music"           - Start music');
        console.log('  "Hi ECARX, stop music"           - Stop music');
        console.log('  "Hi ECARX, what\'s my fuel level?" - Check fuel');
        console.log('  "Hi ECARX, call emergency"       - Emergency call');
        console.log('');
        console.log('Commands:');
        console.log('  "car"   - Show vehicle status');
        console.log('  "help"  - Show this help');
        console.log('  "exit"  - Quit ECARX Bot');
        console.log('');
        console.log('Examples:');
        console.log('  "Hi ECARX, navigate to the nearest restaurant"');
        console.log('  "Hi ECARX, play some jazz music"');
        console.log('  "Hi ECARX, how much fuel do I have?"');
        console.log('');
    }
}

// Start the bot
const bot = new SimpleEcarxBot();

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n👋 ECARX Bot shutting down. Safe travels!');
    process.exit(0);
});

bot.start();