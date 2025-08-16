#!/usr/bin/env node

require('dotenv').config();
const ConversationHandler = require('./chatbot/conversationHandler');

class TwitterBotTest {
    constructor() {
        this.conversationHandler = new ConversationHandler({
            provider: process.env.AI_PROVIDER || 'openai'
        });
    }

    async testTwitterQueries() {
        console.log('🤖 Testing CarBot Twitter Integration');
        console.log('=====================================\n');

        const testQueries = [
            "Hi CarBot, what is the newest Twitter of Elon Musk now?",
            "What's Trump's latest tweet?",
            "Show me Elon's recent tweets",
            "What are the latest Twitter updates?",
            "Check Trump's Twitter"
        ];

        for (const query of testQueries) {
            console.log(`🎤 User: "${query}"`);
            console.log('💭 Processing...');
            
            try {
                const result = await this.conversationHandler.processMessage(query);
                
                console.log(`🔍 Intent: ${result.intent}`);
                console.log(`🤖 CarBot: "${result.response}"`);
                
                if (result.actions && result.actions.length > 0) {
                    console.log(`🎯 Actions: ${result.actions.map(a => a.type).join(', ')}`);
                }
                
                console.log('\n' + '='.repeat(60) + '\n');
                
                // Wait a bit between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error('❌ Error:', error.message);
                console.log('\n' + '='.repeat(60) + '\n');
            }
        }
    }

    async testSpecificQuery(query) {
        console.log(`🎤 Testing: "${query}"`);
        console.log('💭 Processing...\n');
        
        try {
            const result = await this.conversationHandler.processMessage(query);
            
            console.log(`🔍 Intent detected: ${result.intent}`);
            console.log(`🤖 CarBot response: "${result.response}"`);
            
            if (result.actions && result.actions.length > 0) {
                console.log(`🎯 Actions triggered:`, result.actions);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            throw error;
        }
    }
}

// Main execution
async function main() {
    const tester = new TwitterBotTest();
    
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
        const query = args.join(' ');
        await tester.testSpecificQuery(query);
    } else {
        await tester.testTwitterQueries();
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Test execution failed:', error.message);
        process.exit(1);
    });
}

module.exports = TwitterBotTest;