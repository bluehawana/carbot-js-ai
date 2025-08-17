#!/usr/bin/env node

require('dotenv').config();
const AIProvider = require('../ai/aiProvider');

console.log('🚗 CarBot - AI Provider Integration Demo');
console.log('==========================================');
console.log('');

// Show available providers
const providers = AIProvider.getAvailableProviders();

console.log('📋 Available AI Providers:');
console.log('');
console.log('🌟 RECOMMENDED (Best for CarBot):');
providers
    .filter(p => p.recommended)
    .forEach((provider, index) => {
        const freeTag = provider.free ? '🆓 FREE' : '💰 PAID';
        console.log(`${index + 1}. ${provider.displayName} (${freeTag})`);
        console.log(`   ${provider.description}`);
        console.log(`   Get API key: ${provider.url}`);
        console.log('');
    });

console.log('⚡ ALTERNATIVES:');
providers
    .filter(p => !p.recommended)
    .forEach((provider, index) => {
        const freeTag = provider.free ? '🆓 FREE' : '💰 PAID';
        console.log(`${index + 4}. ${provider.displayName} (${freeTag})`);
        console.log(`   ${provider.description}`);
        if (provider.name === 'ollama') {
            console.log(`   Install locally: ${provider.url}`);
        } else {
            console.log(`   Get API key: ${provider.url}`);
        }
        console.log('');
    });

console.log('🔧 How to configure:');
console.log('===================');
console.log('');
console.log('1. Copy .env.example to .env:');
console.log('   cp .env.example .env');
console.log('');
console.log('2. Choose your AI provider (edit .env):');
console.log('   AI_PROVIDER=openai     # For ChatGPT 3.5');
console.log('   AI_PROVIDER=claude     # For Claude 3 Haiku (FREE)');
console.log('   AI_PROVIDER=grok       # For Grok');
console.log('   AI_PROVIDER=groq       # For Groq (FREE)');
console.log('');
console.log('3. Add your API key (edit .env):');
console.log('   OPENAI_API_KEY=sk-...');
console.log('   ANTHROPIC_API_KEY=sk-ant-...');
console.log('   GROK_API_KEY=xai-...');
console.log('   GROQ_API_KEY=your_groq_api_key_here');
console.log('');
console.log('4. Start CarBot:');
console.log('   npm start');
console.log('');

// Test fallback system (without API keys)
console.log('🧪 Testing fallback system:');
console.log('============================');
console.log('');

async function testFallback() {
    const ai = new AIProvider({ provider: 'openai' });
    
    const testMessages = [
        {
            role: 'system',
            content: 'You are CarBot, a car assistant.'
        },
        {
            role: 'user',
            content: 'Navigate to the nearest gas station'
        }
    ];
    
    try {
        console.log('💭 User: "Navigate to the nearest gas station"');
        console.log('🔄 No API keys configured, using fallback...');
        
        const response = await ai.generateResponse(testMessages);
        
        console.log(`🤖 CarBot: "${response.content}"`);
        console.log(`📡 Provider: ${response.provider}`);
        console.log('');
        console.log('✅ Fallback system working! CarBot will respond even without API keys.');
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

testFallback();

console.log('');
console.log('🎯 Next steps:');
console.log('==============');
console.log('1. Get a free API key from Claude or Groq');
console.log('2. Configure your .env file');
console.log('3. Run: npm start');
console.log('4. Say "Hi CarBot" to activate voice assistant');
console.log('');
console.log('🚗 Ready to install in your car with Google Auto!');
console.log('');