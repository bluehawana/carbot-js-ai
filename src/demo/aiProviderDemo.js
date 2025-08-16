#!/usr/bin/env node

require('dotenv').config();
const AIProvider = require('../ai/aiProvider');

class AIProviderDemo {
    constructor() {
        this.providers = AIProvider.getAvailableProviders();
    }

    async runDemo() {
        console.log('🚗 CarBot AI Provider Demo');
        console.log('============================');
        console.log('');

        // Show available providers
        console.log('📋 Available AI Providers:');
        console.log('');
        console.log('🌟 RECOMMENDED:');
        this.providers
            .filter(p => p.recommended)
            .forEach((provider, index) => {
                const freeTag = provider.free ? '🆓' : '💰';
                const statusTag = provider.free ? '[FREE]' : '[PAID]';
                console.log(`${index + 1}. ${freeTag} ${provider.displayName} ${statusTag}`);
                console.log(`   ${provider.description}`);
                console.log(`   API: ${provider.url}`);
                console.log('');
            });
        
        console.log('⚡ ALTERNATIVES:');
        this.providers
            .filter(p => !p.recommended)
            .forEach((provider, index) => {
                const freeTag = provider.free ? '🆓' : '💰';
                const statusTag = provider.free ? '[FREE]' : '[PAID]';
                console.log(`${index + 4}. ${freeTag} ${provider.displayName} ${statusTag}`);
                console.log(`   ${provider.description}`);
                console.log(`   API: ${provider.url}`);
                console.log('');
            });

        // Test each provider
        console.log('🧪 Testing AI Providers:');
        console.log('========================');

        const testMessage = [
            {
                role: 'system',
                content: 'You are CarBot, a car assistant. Respond briefly and helpfully.'
            },
            {
                role: 'user',
                content: 'Hi CarBot, navigate to the nearest gas station.'
            }
        ];

        // Test recommended providers first
        const recommendedProviders = this.providers.filter(p => p.recommended);
        for (const provider of recommendedProviders) {
            await this.testProvider(provider.name, testMessage);
        }

        console.log('');
        console.log('🎯 Demo completed! Use any of the free providers for your CarBot.');
    }

    async testProvider(providerName, messages) {
        console.log(`\n🔍 Testing ${providerName}...`);
        
        try {
            const aiProvider = new AIProvider({ 
                provider: providerName,
                timeout: 10000
            });

            const result = await aiProvider.testConnection();
            
            if (result.success) {
                console.log(`✅ ${providerName}: Connected successfully`);
                console.log(`   Model: ${result.model}`);
                console.log(`   Response: "${result.response}"`);
                
                // Try a full conversation
                const response = await aiProvider.generateResponse(messages, {
                    maxTokens: 100,
                    temperature: 0.7
                });
                
                console.log(`   Full response: "${response.content}"`);
                console.log(`   Provider: ${response.provider}`);
                
            } else {
                console.log(`❌ ${providerName}: ${result.error}`);
            }
            
        } catch (error) {
            console.log(`❌ ${providerName}: ${error.message}`);
        }
    }

    async interactiveDemo() {
        console.log('\n🎮 Interactive AI Provider Demo');
        console.log('===============================');
        
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Let user choose provider
        console.log('\nChoose an AI provider:');
        this.providers.forEach((provider, index) => {
            if (provider.free) {
                console.log(`${index + 1}. ${provider.displayName} (${provider.description})`);
            }
        });

        const choice = await new Promise(resolve => {
            rl.question('\nEnter provider number: ', resolve);
        });

        const selectedProvider = this.providers[parseInt(choice) - 1];
        
        if (!selectedProvider) {
            console.log('Invalid choice!');
            rl.close();
            return;
        }

        console.log(`\n🤖 Using ${selectedProvider.displayName}`);
        console.log('Type "exit" to quit, "switch" to change provider\n');

        const aiProvider = new AIProvider({ 
            provider: selectedProvider.name 
        });

        const conversationHistory = [
            {
                role: 'system',
                content: 'You are CarBot, a helpful car assistant. Keep responses brief and car-focused.'
            }
        ];

        // Interactive conversation loop
        const askQuestion = async () => {
            rl.question('You: ', async (input) => {
                if (input.toLowerCase() === 'exit') {
                    console.log('Goodbye!');
                    rl.close();
                    return;
                }

                if (input.toLowerCase() === 'switch') {
                    rl.close();
                    await this.interactiveDemo();
                    return;
                }

                try {
                    conversationHistory.push({
                        role: 'user',
                        content: input
                    });

                    const response = await aiProvider.generateResponse(conversationHistory, {
                        maxTokens: 150,
                        temperature: 0.7
                    });

                    console.log(`CarBot (${response.provider}): ${response.content}\n`);

                    conversationHistory.push({
                        role: 'assistant',
                        content: response.content
                    });

                    askQuestion();
                } catch (error) {
                    console.log(`Error: ${error.message}\n`);
                    askQuestion();
                }
            });
        };

        askQuestion();
    }

    showUsageInstructions() {
        console.log('\n📚 How to use AI Providers in CarBot:');
        console.log('========================================');
        console.log('');
        console.log('1. Set your preferred AI provider in .env:');
        console.log('   AI_PROVIDER=openai  # or claude, grok, groq, etc.');
        console.log('');
        console.log('2. Add your API key:');
        console.log('   OPENAI_API_KEY=your-api-key');
        console.log('');
        console.log('3. Get API keys from these providers:');
        console.log('   🌟 RECOMMENDED:');
        console.log('   • OpenAI (ChatGPT): https://platform.openai.com/api-keys');
        console.log('   • Claude (Anthropic): https://console.anthropic.com');
        console.log('   • Grok (X.AI): https://console.x.ai');
        console.log('');
        console.log('   🆓 FREE ALTERNATIVES:');
        console.log('   • Groq: https://console.groq.com');
        console.log('   • Together AI: https://api.together.xyz');
        console.log('   • Hugging Face: https://huggingface.co/settings/tokens');
        console.log('   • Cohere: https://dashboard.cohere.ai/api-keys');
        console.log('   • Perplexity: https://www.perplexity.ai/settings/api');
        console.log('');
        console.log('4. Local option (no API key needed):');
        console.log('   • Ollama: Install locally from https://ollama.ai');
        console.log('');
        console.log('5. Start CarBot:');
        console.log('   npm start');
        console.log('');
    }
}

// Run the demo
if (require.main === module) {
    const demo = new AIProviderDemo();
    
    const args = process.argv.slice(2);
    
    if (args.includes('--interactive')) {
        demo.interactiveDemo();
    } else if (args.includes('--help')) {
        demo.showUsageInstructions();
    } else {
        demo.runDemo();
    }
}

module.exports = AIProviderDemo;