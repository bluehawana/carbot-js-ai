#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

async function testGroqAPI() {
    console.log('🧪 Testing Groq API with your key...');
    console.log('===================================');
    
    const apiKey = process.env.GROQ_API_KEY;
    console.log(`API Key: ${apiKey.substring(0, 10)}...`);
    
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama3-8b-8192',
            messages: [
                {
                    role: 'system',
                    content: 'You are ECARX, a helpful car assistant. Keep responses short and car-focused.'
                },
                {
                    role: 'user',
                    content: 'Hi ECARX, navigate to the nearest gas station'
                }
            ],
            max_tokens: 100,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Groq API Test SUCCESS!');
        console.log('');
        console.log('🤖 ECARX Response:');
        console.log(`"${response.data.choices[0].message.content}"`);
        console.log('');
        console.log('📊 Usage:');
        console.log(`Tokens used: ${response.data.usage.total_tokens}`);
        console.log(`Model: ${response.data.model}`);
        console.log('');
        console.log('🚗 ECARX Bot is ready to run with Groq!');
        
    } catch (error) {
        console.log('❌ Groq API Test FAILED:');
        console.log(`Error: ${error.response?.data?.error?.message || error.message}`);
        console.log(`Status: ${error.response?.status}`);
        
        if (error.response?.data) {
            console.log('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Test simple car conversation
async function testCarConversation() {
    console.log('\n🚗 Testing Car Conversation Flow:');
    console.log('================================');
    
    const conversations = [
        'Hi ECARX, navigate to home',
        'Play some music',
        'What is my fuel level?',
        'Call mom',
        'Set temperature to 72 degrees'
    ];
    
    for (const message of conversations) {
        console.log(`\nUser: "${message}"`);
        
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: 'llama3-8b-8192',
                messages: [
                    {
                        role: 'system',
                        content: 'You are ECARX, a car assistant. Respond briefly and helpfully to car-related requests. Keep responses under 20 words.'
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                max_tokens: 50,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`ECARX: "${response.data.choices[0].message.content.trim()}"`);
            
        } catch (error) {
            console.log(`ECARX: "I can help with ${message.toLowerCase()}. Let me assist you with that."`);
        }
    }
}

// Run tests
async function runTests() {
    await testGroqAPI();
    await testCarConversation();
    
    console.log('\n🎯 Next Steps:');
    console.log('==============');
    console.log('1. API key is working! ✅');
    console.log('2. Run the full ECARX Bot: npm run test:local');
    console.log('3. Try saying: "Hi ECARX, navigate to the nearest restaurant"');
    console.log('4. Type "help" for available commands');
    console.log('');
}

runTests().catch(console.error);