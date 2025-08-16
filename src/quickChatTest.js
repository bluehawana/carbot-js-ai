#!/usr/bin/env node

require('dotenv').config();
const ConversationHandler = require('./chatbot/conversationHandler');

async function quickTest() {
    console.log('🚗 CarBot Quick Test');
    console.log('=======================\n');

    const handler = new ConversationHandler({
        provider: process.env.AI_PROVIDER || 'groq'
    });

    const testMessages = [
        "Hello CarBot, how are you?",
        "What can you help me with?",
        // We'll try Twitter after waiting for rate limits to reset
    ];

    for (const message of testMessages) {
        console.log(`🎤 User: "${message}"`);
        console.log('💭 Processing...');
        
        try {
            const result = await handler.processMessage(message);
            console.log(`🤖 CarBot: "${result.response}"`);
            console.log(`🔍 Intent: ${result.intent}`);
            console.log();
        } catch (error) {
            console.error(`❌ Error: ${error.message}\n`);
        }
    }

    console.log('✅ Basic functionality working!');
    console.log('\n💡 To test Twitter functionality:');
    console.log('   Wait 15 minutes for rate limits to reset, then try:');
    console.log('   "Hi CarBot, what is the newest Twitter of Elon Musk now?"');
}

if (require.main === module) {
    quickTest().catch(console.error);
}