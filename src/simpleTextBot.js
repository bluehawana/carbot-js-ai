#!/usr/bin/env node

require('dotenv').config();
const ConversationHandler = require('./chatbot/conversationHandler');
const readline = require('readline');

class SimpleTextBot {
    constructor() {
        console.log('🚗 Initializing CarBot Text Bot...');
        
        // Check if we have the minimum required API key
        if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
            console.error('❌ Missing AI API key. Please set GROQ_API_KEY or OPENAI_API_KEY');
            process.exit(1);
        }

        this.conversationHandler = new ConversationHandler({
            provider: process.env.AI_PROVIDER || 'groq'
        });

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('✅ CarBot Text Bot initialized!');
        console.log('📱 AI Provider:', process.env.AI_PROVIDER || 'groq');
        console.log('🐦 Twitter:', process.env.TWITTER_BEARER_TOKEN ? 'Enabled' : 'Disabled');
        console.log('\n💡 Try saying:');
        console.log('   - "Hi CarBot, what is the newest Twitter of Elon Musk now?"');
        console.log('   - "What\'s Trump\'s latest tweet?"');
        console.log('   - "Hello CarBot, how are you?"');
        console.log('   - Type "quit" to exit\n');
    }

    async start() {
        const askQuestion = () => {
            this.rl.question('🎤 You: ', async (input) => {
                if (input.toLowerCase().trim() === 'quit') {
                    console.log('👋 Goodbye!');
                    this.rl.close();
                    return;
                }

                if (input.trim() === '') {
                    askQuestion();
                    return;
                }

                try {
                    console.log('💭 Processing...');
                    const result = await this.conversationHandler.processMessage(input);
                    
                    console.log(`🤖 CarBot: ${result.response}`);
                    console.log(`🔍 Intent: ${result.intent}`);
                    
                    if (result.actions && result.actions.length > 0) {
                        console.log(`🎯 Actions: ${result.actions.map(a => `${a.type}:${a.action}`).join(', ')}`);
                    }
                    console.log();
                    
                } catch (error) {
                    console.error('❌ Error:', error.message);
                    console.log();
                }
                
                askQuestion();
            });
        };

        askQuestion();
    }

    async testTwitter() {
        console.log('\n🧪 Testing Twitter functionality...\n');
        
        const testQueries = [
            "Hi CarBot, what is the newest Twitter of Elon Musk now?",
            "What's Trump's latest tweet?"
        ];

        for (const query of testQueries) {
            console.log(`🎤 Testing: "${query}"`);
            try {
                const result = await this.conversationHandler.processMessage(query);
                console.log(`🤖 CarBot: ${result.response}`);
                console.log(`🔍 Intent: ${result.intent}\n`);
                
                // Wait between requests
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error(`❌ Error: ${error.message}\n`);
            }
        }
    }
}

// Main execution
async function main() {
    const bot = new SimpleTextBot();
    
    const args = process.argv.slice(2);
    if (args.includes('--test-twitter')) {
        await bot.testTwitter();
    } else {
        await bot.start();
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Bot failed to start:', error.message);
        process.exit(1);
    });
}

module.exports = SimpleTextBot;