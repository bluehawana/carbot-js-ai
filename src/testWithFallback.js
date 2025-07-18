#!/usr/bin/env node

require('dotenv').config();
const ConversationHandler = require('./chatbot/conversationHandler');

async function testWithRetry() {
    console.log('🚗 ECARX Bot - Continuous Testing');
    console.log('==================================\n');

    const handler = new ConversationHandler();

    const testQueries = [
        "Hi ECARX, how are you?",
        "What's the weather like?",
        "Can you help with navigation?",
        "Hi ECARX, what is the newest Twitter of Elon Musk now?",
        "What's Trump's latest tweet?",
        "Tell me about Twitter updates",
        "What can you do?"
    ];

    for (let i = 0; i < testQueries.length; i++) {
        const query = testQueries[i];
        console.log(`🎤 Test ${i + 1}/${testQueries.length}: "${query}"`);
        console.log('💭 Processing...');
        
        try {
            const result = await handler.processMessage(query);
            console.log(`🤖 ECARX: "${result.response}"`);
            console.log(`🔍 Intent: ${result.intent}`);
            
            if (result.actions && result.actions.length > 0) {
                console.log(`🎯 Actions: ${result.actions.map(a => a.type).join(', ')}`);
            }
            
            // Special handling for Twitter queries
            if (result.intent === 'twitter_error') {
                console.log('⚠️  Twitter rate limited - this is expected, will retry later');
            } else if (result.intent === 'twitter') {
                console.log('✅ Twitter integration working!');
            }
            
            console.log('\n' + '='.repeat(60) + '\n');
            
            // Wait between requests
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            console.log('\n' + '='.repeat(60) + '\n');
        }
    }

    console.log('🔄 Testing complete. Attempting Twitter retry in 5 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Retry Twitter specifically
    console.log('🔄 Retrying Twitter functionality...');
    try {
        const result = await handler.processMessage("Hi ECARX, what is the newest Twitter of Elon Musk now?");
        if (result.intent === 'twitter') {
            console.log('🎉 SUCCESS! Twitter is now working!');
            console.log(`🤖 ECARX: "${result.response}"`);
        } else {
            console.log('⏳ Still rate limited, need to wait longer');
        }
    } catch (error) {
        console.log('⏳ Still rate limited, need to wait longer');
    }
}

if (require.main === module) {
    testWithRetry().catch(console.error);
}