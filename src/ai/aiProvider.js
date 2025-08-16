const axios = require('axios');

class AIProvider {
    constructor(options = {}) {
        this.provider = 'groq'; // Forcing groq to prevent fallback issues
        this.apiKey = this.getApiKey();
        this.baseURL = this.getBaseURL();
        this.model = this.getModel();
        this.maxRetries = options.maxRetries || 2;
        this.timeout = options.timeout || 15000; // 15 seconds
        this.availableFunctions = new Map();
        this.registerDefaultFunctions();
    }

    getApiKey() {
        switch (this.provider) {
            case 'openai':
            case 'chatgpt':
                return process.env.OPENAI_API_KEY;
            case 'anthropic':
            case 'claude':
                return process.env.ANTHROPIC_API_KEY;
            case 'grok':
                return process.env.GROK_API_KEY || process.env.XAI_API_KEY;
            case 'groq':
                return process.env.GROQ_API_KEY;
            case 'together':
                return process.env.TOGETHER_API_KEY;
            case 'cohere':
                return process.env.COHERE_API_KEY;
            case 'perplexity':
                return process.env.PERPLEXITY_API_KEY;
            case 'ollama':
                return 'ollama';
            case 'huggingface':
                return process.env.HUGGINGFACE_API_KEY;
            case 'google':
            case 'gemini':
                return process.env.GOOGLE_AI_API_KEY;
            case 'qwen':
                return process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
            default:
                return process.env.OPENAI_API_KEY;
        }
    }

    getBaseURL() {
        switch (this.provider) {
            case 'openai':
            case 'chatgpt':
                return 'https://api.openai.com/v1';
            case 'anthropic':
            case 'claude':
                return 'https://api.anthropic.com/v1';
            case 'grok':
                return 'https://api.x.ai/v1';
            case 'groq':
                return 'https://api.groq.com/openai/v1';
            case 'together':
                return 'https://api.together.xyz/v1';
            case 'cohere':
                return 'https://api.cohere.ai/v1';
            case 'perplexity':
                return 'https://api.perplexity.ai';
            case 'ollama':
                return 'http://localhost:11434/v1';
            case 'huggingface':
                return 'https://api-inference.huggingface.co/models';
            case 'google':
            case 'gemini':
                return 'https://generativelanguage.googleapis.com/v1beta';
            case 'qwen':
                return 'https://dashscope.aliyuncs.com/api/v1';
            default:
                return 'https://api.openai.com/v1';
        }
    }

    getModel() {
        switch (this.provider) {
            case 'openai':
            case 'chatgpt':
                return 'gpt-3.5-turbo';
            case 'anthropic':
            case 'claude':
                return 'claude-3-haiku-20240307';
            case 'grok':
                return 'grok-beta';
            case 'groq':
                return 'llama3-8b-8192';
            case 'together':
                return 'meta-llama/Llama-2-7b-chat-hf';
            case 'cohere':
                return 'command-r-plus';
            case 'perplexity':
                return 'llama-3.1-sonar-small-128k-online';
            case 'ollama':
                return 'llama3';
            case 'huggingface':
                return 'microsoft/DialoGPT-medium';
            case 'google':
            case 'gemini':
                return 'gemini-2.5-pro';
            case 'qwen':
                return 'qwen-turbo';
            default:
                return 'gpt-3.5-turbo';
        }
    }

    async generateResponse(messages, options = {}) {
        // Enhanced with function calling and intelligent routing
        const lastMessage = messages[messages.length - 1];
        const intent = await this.analyzeIntent(lastMessage.content);
        
        // Prepare function calling if needed
        if (intent.requiresFunction && this.supportsFunctionCalling()) {
            options.functions = this.getFunctionsForIntent(intent);
            options.function_call = 'auto';
        }
        
        const response = await this.generateResponseWithProvider(messages, options);
        
        // Handle function calls
        if (response.function_call) {
            return await this.handleFunctionCall(response, messages, options);
        }
        
        return response;
    }

    needsRealTimeData(messages) {
        const lastMessage = messages[messages.length - 1];
        const text = lastMessage.content.toLowerCase();
        
        // Keywords that suggest need for real-time data
        const realTimeKeywords = [
            'latest', 'newest', 'recent', 'current', 'today', 'now',
            'twitter', 'tweet', 'x.com', 'elon musk', 'news',
            'weather', 'stock', 'price', 'happening'
        ];
        
        return realTimeKeywords.some(keyword => text.includes(keyword));
    }

    async generateResponseWithProvider(messages, options = {}) {
        const requestOptions = {
            model: options.model || this.model,
            messages: messages,
            max_tokens: options.maxTokens || 150,
            temperature: options.temperature || 0.7
        };

        // Add function calling support for compatible providers
        if (options.functions && this.supportsFunctionCalling()) {
            requestOptions.functions = options.functions;
            if (options.function_call) {
                requestOptions.function_call = options.function_call;
            }
        }
        
        // Only add supported parameters for Groq
        if (this.provider === 'groq') {
            if (options.topP) requestOptions.top_p = options.topP;
        } else {
            // For other providers, add all parameters
            requestOptions.top_p = options.topP || 1.0;
            requestOptions.frequency_penalty = options.frequencyPenalty || 0.1;
            requestOptions.presence_penalty = options.presencePenalty || 0.1;
            Object.assign(requestOptions, options);
        }

        let lastError;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`🤖 Generating response with ${this.provider} (attempt ${attempt}/${this.maxRetries})`);
                
                const response = await this.makeRequest(requestOptions);
                
                if (response && response.choices && response.choices.length > 0) {
                    const choice = response.choices[0];
                    const content = choice.message.content;
                    const functionCall = choice.message.function_call;
                    
                    console.log(`✅ Response generated successfully with ${this.provider}`);
                    
                    const result = {
                        content: content,
                        provider: this.provider,
                        model: this.model,
                        usage: response.usage
                    };
                    
                    if (functionCall) {
                        result.function_call = functionCall;
                    }
                    
                    return result;
                }
                
                throw new Error('No valid response received');
                
            } catch (error) {
                lastError = error;
                console.error(`❌ Attempt ${attempt} failed with ${this.provider}:`, error.message);
                
                if (attempt < this.maxRetries) {
                    await this.delay(1000 * attempt); // Exponential backoff
                }
            }
        }

        // If all attempts failed, try fallback
        console.log('🔄 Trying fallback provider...');
        return await this.tryFallback(messages, options);
    }

    async makeRequest(requestOptions) {
        const headers = this.getHeaders();
        let url, data;

        if (this.provider === 'anthropic' || this.provider === 'claude') {
            // Claude API uses different format
            url = `${this.baseURL}/messages`;
            data = {
                model: requestOptions.model,
                max_tokens: requestOptions.max_tokens || 150,
                messages: requestOptions.messages,
                system: requestOptions.messages.find(m => m.role === 'system')?.content || '',
            };
            // Remove system message from messages array for Claude
            data.messages = requestOptions.messages.filter(m => m.role !== 'system');
        } else if (this.provider === 'google' || this.provider === 'gemini') {
            // Google AI (Gemini) API format
            url = `${this.baseURL}/models/${requestOptions.model}:generateContent`;
            const contents = [];
            let systemInstruction = '';
            
            for (const msg of requestOptions.messages) {
                if (msg.role === 'system') {
                    systemInstruction = msg.content;
                } else {
                    contents.push({
                        role: msg.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: msg.content }]
                    });
                }
            }
            
            data = {
                contents: contents,
                generationConfig: {
                    temperature: requestOptions.temperature || 0.7,
                    maxOutputTokens: requestOptions.max_tokens || 150,
                    topP: requestOptions.top_p || 1.0
                }
            };
            
            if (systemInstruction) {
                data.systemInstruction = { parts: [{ text: systemInstruction }] };
            }
        } else if (this.provider === 'qwen') {
            // Qwen/DashScope API format
            url = `${this.baseURL}/services/aigc/text-generation/generation`;
            data = {
                model: requestOptions.model,
                input: {
                    messages: requestOptions.messages
                },
                parameters: {
                    result_format: 'message',
                    max_tokens: requestOptions.max_tokens || 150,
                    temperature: requestOptions.temperature || 0.7,
                    top_p: requestOptions.top_p || 1.0
                }
            };
        } else {
            // Standard OpenAI-compatible format
            url = `${this.baseURL}/chat/completions`;
            data = requestOptions;
        }
        
        const config = {
            method: 'POST',
            url: url,
            headers: headers,
            data: data,
            timeout: this.timeout
        };

        const response = await axios(config);
        
        // Handle different response formats
        if (this.provider === 'anthropic' || this.provider === 'claude') {
            return {
                choices: [{
                    message: {
                        content: response.data.content[0].text
                    }
                }],
                usage: response.data.usage
            };
        } else if (this.provider === 'google' || this.provider === 'gemini') {
            // Google AI response format
            const candidate = response.data.candidates?.[0];
            if (candidate && candidate.content && candidate.content.parts) {
                return {
                    choices: [{
                        message: {
                            content: candidate.content.parts[0].text
                        }
                    }],
                    usage: response.data.usageMetadata || {}
                };
            }
            throw new Error('Invalid Google AI response format');
        } else if (this.provider === 'qwen') {
            // Qwen response format
            if (response.data.output && response.data.output.choices) {
                return {
                    choices: [{
                        message: {
                            content: response.data.output.choices[0].message.content
                        }
                    }],
                    usage: response.data.usage || {}
                };
            }
            throw new Error('Invalid Qwen response format');
        }
        
        return response.data;
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        switch (this.provider) {
            case 'openai':
            case 'chatgpt':
            case 'groq':
            case 'together':
            case 'grok':
            case 'perplexity':
            case 'ollama':
                headers['Authorization'] = `Bearer ${this.apiKey}`;
                break;
            case 'anthropic':
            case 'claude':
                headers['x-api-key'] = this.apiKey;
                headers['anthropic-version'] = '2023-06-01';
                break;
            case 'cohere':
                headers['Authorization'] = `Bearer ${this.apiKey}`;
                headers['X-Client-Name'] = 'carbot';
                break;
            case 'huggingface':
                headers['Authorization'] = `Bearer ${this.apiKey}`;
                break;
            case 'google':
            case 'gemini':
                headers['Authorization'] = `Bearer ${this.apiKey}`;
                break;
            case 'qwen':
                headers['Authorization'] = `Bearer ${this.apiKey}`;
                headers['Content-Type'] = 'application/json';
                break;
            default:
                headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        return headers;
    }

    async tryFallback(messages, options) {
        // Only use Groq, no other fallback providers
        if (this.provider !== 'groq') {
            console.log('🔄 Switching to Groq as the only allowed provider...');
            this.switchProvider('groq');
            
            try {
                const response = await this.generateResponse(messages, options);
                if (response) {
                    return response;
                }
            } catch (error) {
                console.error(`❌ Groq fallback failed:`, error.message);
            }
        }

        // Final fallback - simple response
        return {
            content: this.getSimpleFallbackResponse(messages),
            provider: 'fallback',
            model: 'simple',
            usage: { total_tokens: 0 }
        };
    }

    getFallbackProviders() {
        const allProviders = [
            'openai', 'claude', 'grok', 'groq', 'together', 
            'cohere', 'perplexity', 'ollama', 'huggingface'
        ];
        return allProviders.filter(p => p !== this.provider);
    }

    getSimpleFallbackResponse(messages) {
        const lastMessage = messages[messages.length - 1];
        const text = lastMessage.content.toLowerCase();
        
        // Simple rule-based responses
        if (text.includes('navigate') || text.includes('directions')) {
            return "I can help with navigation. Please specify your destination.";
        }
        
        if (text.includes('music') || text.includes('play')) {
            return "I can control music playback. What would you like to listen to?";
        }
        
        if (text.includes('call') || text.includes('phone')) {
            return "I can help with phone calls. Who would you like to call?";
        }
        
        if (text.includes('weather')) {
            return "I can check the weather for you. What location?";
        }
        
        if (text.includes('emergency') || text.includes('help')) {
            return "Emergency assistance activated. How can I help you?";
        }
        
        return "I'm CarBot, your car assistant. I can help with navigation, music, calls, and more.";
    }
    
    // Function calling implementation
    registerFunction(name, description, parameters, handler) {
        this.availableFunctions.set(name, {
            name,
            description,
            parameters,
            handler
        });
    }
    
    registerDefaultFunctions() {
        // Navigation function
        this.registerFunction('navigate_to_destination', 
            'Navigate to a specific destination using GPS',
            {
                type: 'object',
                properties: {
                    destination: {
                        type: 'string',
                        description: 'The destination address or location name'
                    },
                    route_preference: {
                        type: 'string',
                        enum: ['fastest', 'shortest', 'eco'],
                        description: 'Preferred route type'
                    }
                },
                required: ['destination']
            },
            async (params) => {
                return {
                    success: true,
                    message: `Navigation started to ${params.destination}`,
                    eta: '15 minutes',
                    distance: '8.2 km'
                };
            }
        );
        
        // Music control function
        this.registerFunction('control_music',
            'Control music playback (play, pause, skip, search)',
            {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['play', 'pause', 'skip', 'previous', 'search'],
                        description: 'Music control action'
                    },
                    query: {
                        type: 'string',
                        description: 'Song, artist, or album to search for (required for search action)'
                    },
                    volume: {
                        type: 'number',
                        minimum: 0,
                        maximum: 100,
                        description: 'Volume level (0-100)'
                    }
                },
                required: ['action']
            },
            async (params) => {
                switch (params.action) {
                    case 'search':
                        return {
                            success: true,
                            message: `Playing "${params.query}"`,
                            current_song: params.query
                        };
                    default:
                        return {
                            success: true,
                            message: `Music ${params.action} executed`,
                            action: params.action
                        };
                }
            }
        );
        
        // Phone call function
        this.registerFunction('make_phone_call',
            'Make a phone call to a contact or number',
            {
                type: 'object',
                properties: {
                    contact: {
                        type: 'string',
                        description: 'Contact name or phone number'
                    },
                    call_type: {
                        type: 'string',
                        enum: ['voice', 'video'],
                        description: 'Type of call to make'
                    }
                },
                required: ['contact']
            },
            async (params) => {
                return {
                    success: true,
                    message: `Calling ${params.contact}`,
                    call_type: params.call_type || 'voice'
                };
            }
        );
        
        // Weather function
        this.registerFunction('get_weather',
            'Get current weather information for a location',
            {
                type: 'object',
                properties: {
                    location: {
                        type: 'string',
                        description: 'City or location for weather information'
                    },
                    include_forecast: {
                        type: 'boolean',
                        description: 'Include extended forecast'
                    }
                },
                required: ['location']
            },
            async (params) => {
                return {
                    success: true,
                    location: params.location,
                    temperature: '22°C',
                    condition: 'Partly cloudy',
                    humidity: '65%',
                    forecast: params.include_forecast ? ['Tomorrow: 24°C Sunny', 'Friday: 19°C Rainy'] : undefined
                };
            }
        );
        
        // Climate control function
        this.registerFunction('control_climate',
            'Control car climate settings (temperature, AC, heating)',
            {
                type: 'object',
                properties: {
                    temperature: {
                        type: 'number',
                        minimum: 16,
                        maximum: 30,
                        description: 'Desired temperature in Celsius'
                    },
                    mode: {
                        type: 'string',
                        enum: ['auto', 'heat', 'cool', 'fan'],
                        description: 'Climate control mode'
                    },
                    fan_speed: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 5,
                        description: 'Fan speed level (1-5)'
                    }
                }
            },
            async (params) => {
                return {
                    success: true,
                    message: `Climate set to ${params.temperature}°C in ${params.mode} mode`,
                    temperature: params.temperature,
                    mode: params.mode
                };
            }
        );
    }
    
    async analyzeIntent(text) {
        const lowercaseText = text.toLowerCase();
        
        // Intent analysis using keywords and patterns
        const intents = {
            navigation: {
                keywords: ['navigate', 'directions', 'route', 'go to', 'drive to', 'take me to'],
                functions: ['navigate_to_destination'],
                requiresFunction: true
            },
            music: {
                keywords: ['play', 'music', 'song', 'album', 'artist', 'spotify', 'pause', 'skip'],
                functions: ['control_music'],
                requiresFunction: true
            },
            phone: {
                keywords: ['call', 'phone', 'dial', 'contact'],
                functions: ['make_phone_call'],
                requiresFunction: true
            },
            weather: {
                keywords: ['weather', 'temperature', 'forecast', 'rain', 'sunny'],
                functions: ['get_weather'],
                requiresFunction: true
            },
            climate: {
                keywords: ['temperature', 'ac', 'heat', 'cool', 'climate', 'air conditioning'],
                functions: ['control_climate'],
                requiresFunction: true
            },
            general: {
                keywords: [],
                functions: [],
                requiresFunction: false
            }
        };
        
        for (const [intentName, intent] of Object.entries(intents)) {
            if (intent.keywords.some(keyword => lowercaseText.includes(keyword))) {
                return {
                    name: intentName,
                    confidence: 0.8,
                    requiresFunction: intent.requiresFunction,
                    functions: intent.functions
                };
            }
        }
        
        return {
            name: 'general',
            confidence: 0.5,
            requiresFunction: false,
            functions: []
        };
    }
    
    supportsFunctionCalling() {
        return ['openai', 'chatgpt', 'grok'].includes(this.provider);
    }
    
    getFunctionsForIntent(intent) {
        const functions = [];
        
        for (const functionName of intent.functions) {
            const func = this.availableFunctions.get(functionName);
            if (func) {
                functions.push({
                    name: func.name,
                    description: func.description,
                    parameters: func.parameters
                });
            }
        }
        
        return functions;
    }
    
    async handleFunctionCall(response, messages, options) {
        const functionCall = response.function_call;
        const functionName = functionCall.name;
        const functionArgs = JSON.parse(functionCall.arguments);
        
        const func = this.availableFunctions.get(functionName);
        if (!func) {
            throw new Error(`Unknown function: ${functionName}`);
        }
        
        try {
            // Execute the function
            const result = await func.handler(functionArgs);
            
            // Add function call and result to conversation
            const updatedMessages = [
                ...messages,
                {
                    role: 'assistant',
                    content: null,
                    function_call: functionCall
                },
                {
                    role: 'function',
                    name: functionName,
                    content: JSON.stringify(result)
                }
            ];
            
            // Generate final response based on function result
            const finalResponse = await this.generateResponseWithProvider(updatedMessages, {
                ...options,
                functions: undefined,
                function_call: undefined
            });
            
            return {
                ...finalResponse,
                function_result: result,
                function_name: functionName
            };
            
        } catch (error) {
            console.error(`Function ${functionName} failed:`, error);
            return {
                content: `I encountered an error while trying to ${functionName.replace('_', ' ')}: ${error.message}`,
                provider: this.provider,
                model: this.model,
                error: true
            };
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Test connection to AI provider
    async testConnection() {
        try {
            const testMessages = [
                { role: 'user', content: 'Hello, can you respond with just "OK"?' }
            ];
            
            const response = await this.generateResponse(testMessages, { maxTokens: 10 });
            return {
                success: true,
                provider: this.provider,
                model: this.model,
                response: response.content
            };
        } catch (error) {
            return {
                success: false,
                provider: this.provider,
                error: error.message
            };
        }
    }

    // Get available providers
    static getAvailableProviders() {
        return [
            {
                name: 'openai',
                displayName: 'OpenAI GPT-3.5',
                description: 'ChatGPT 3.5 Turbo - reliable and fast',
                requiresKey: true,
                url: 'https://api.openai.com',
                free: false,
                recommended: true
            },
            {
                name: 'claude',
                displayName: 'Claude 3 Haiku',
                description: 'Anthropic\'s fast and affordable Claude model',
                requiresKey: true,
                url: 'https://api.anthropic.com',
                free: true,
                recommended: true
            },
            {
                name: 'grok',
                displayName: 'Grok (X.AI)',
                description: 'Elon Musk\'s AI with real-time knowledge',
                requiresKey: true,
                url: 'https://api.x.ai',
                free: false,
                recommended: true
            },
            {
                name: 'groq',
                displayName: 'Groq',
                description: 'Ultra-fast inference with Llama models',
                requiresKey: true,
                url: 'https://api.groq.com',
                free: true,
                recommended: false
            },
            {
                name: 'together',
                displayName: 'Together AI',
                description: 'Open source models with good free tier',
                requiresKey: true,
                url: 'https://api.together.xyz',
                free: true,
                recommended: false
            },
            {
                name: 'cohere',
                displayName: 'Cohere',
                description: 'Enterprise-grade AI with free tier',
                requiresKey: true,
                url: 'https://api.cohere.ai',
                free: true,
                recommended: false
            },
            {
                name: 'perplexity',
                displayName: 'Perplexity',
                description: 'Search-augmented AI responses',
                requiresKey: true,
                url: 'https://api.perplexity.ai',
                free: true,
                recommended: false
            },
            {
                name: 'ollama',
                displayName: 'Ollama (Local)',
                description: 'Run models locally - completely free',
                requiresKey: false,
                url: 'http://localhost:11434',
                free: true,
                recommended: false
            },
            {
                name: 'huggingface',
                displayName: 'Hugging Face',
                description: 'Free inference API for open models',
                requiresKey: true,
                url: 'https://api-inference.huggingface.co',
                free: true,
                recommended: false
            },
            {
                name: 'google',
                displayName: 'Google AI (Gemini)',
                description: 'Google\'s latest Gemini models with excellent real-time capabilities',
                requiresKey: true,
                url: 'https://generativelanguage.googleapis.com',
                free: true,
                recommended: true
            },
            {
                name: 'qwen',
                displayName: 'Qwen (Alibaba Cloud)',
                description: 'Alibaba\'s powerful multilingual AI model',
                requiresKey: true,
                url: 'https://dashscope.aliyuncs.com',
                free: true,
                recommended: true
            }
        ];
    }

    // Switch provider dynamically
    switchProvider(provider, apiKey = null) {
        this.provider = provider;
        this.apiKey = apiKey || this.getApiKey();
        this.baseURL = this.getBaseURL();
        this.model = this.getModel();
        
        console.log(`🔄 Switched to AI provider: ${provider}`);
    }
}

module.exports = AIProvider;