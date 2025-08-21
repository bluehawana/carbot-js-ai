const axios = require('axios');

class EnhancedAIProvider {
    constructor(options = {}) {
        this.provider = 'groq'; // Focusing on Groq for reliability
        this.apiKey = this.getApiKey();
        this.baseURL = this.getBaseURL();
        this.model = this.getModel();
        this.maxRetries = options.maxRetries || 3;
        this.timeout = options.timeout || 12000; // Reduced for faster responses
        this.circuitBreakerThreshold = options.circuitBreakerThreshold || 5;
        this.circuitBreakerResetTime = options.circuitBreakerResetTime || 60000;
        
        // Circuit breaker state
        this.circuitBreaker = {
            failures: 0,
            lastFailure: null,
            isOpen: false
        };
        
        // Response cache for similar requests
        this.responseCache = new Map();
        this.cacheTimeout = options.cacheTimeout || 300000; // 5 minutes
        
        // Performance metrics
        this.metrics = {
            requests: 0,
            successes: 0,
            failures: 0,
            averageResponseTime: 0,
            lastResponseTime: 0
        };
        
        this.availableFunctions = new Map();
        this.registerDefaultFunctions();
    }

    getApiKey() {
        switch (this.provider) {
            case 'groq':
                return process.env.GROQ_API_KEY;
            case 'openai':
                return process.env.OPENAI_API_KEY;
            case 'anthropic':
                return process.env.ANTHROPIC_API_KEY;
            default:
                return process.env.GROQ_API_KEY;
        }
    }

    getBaseURL() {
        switch (this.provider) {
            case 'groq':
                return 'https://api.groq.com/openai/v1';
            case 'openai':
                return 'https://api.openai.com/v1';
            case 'anthropic':
                return 'https://api.anthropic.com/v1';
            default:
                return 'https://api.groq.com/openai/v1';
        }
    }

    getModel() {
        switch (this.provider) {
            case 'groq':
                return 'llama3-8b-8192';
            case 'openai':
                return 'gpt-3.5-turbo';
            case 'anthropic':
                return 'claude-3-haiku-20240307';
            default:
                return 'llama3-8b-8192';
        }
    }

    async generateResponse(messages, options = {}) {
        // Check circuit breaker
        if (this.isCircuitBreakerOpen()) {
            console.log('🔴 Circuit breaker is open, using fallback response');
            return this.getFallbackResponse(messages);
        }
        
        // Check cache first
        const cacheKey = this.getCacheKey(messages, options);
        const cachedResponse = this.getFromCache(cacheKey);
        if (cachedResponse) {
            console.log('💾 Returning cached response');
            return cachedResponse;
        }
        
        const startTime = Date.now();
        
        try {
            const response = await this.generateResponseWithProvider(messages, options);
            
            // Update metrics and circuit breaker
            this.updateMetrics(true, Date.now() - startTime);
            this.circuitBreaker.failures = 0;
            
            // Cache successful response
            this.cacheResponse(cacheKey, response);
            
            return response;
            
        } catch (error) {
            this.updateMetrics(false, Date.now() - startTime);
            this.updateCircuitBreaker();
            
            console.error('🚨 AI Provider error:', error.message);
            return this.getFallbackResponse(messages, error);
        }
    }

    async generateResponseWithProvider(messages, options = {}) {
        // Enhanced request options with car-specific optimizations
        const requestOptions = {
            model: options.model || this.model,
            messages: this.optimizeMessagesForCar(messages),
            max_tokens: Math.min(options.maxTokens || 120, 150), // Shorter for voice responses
            temperature: options.temperature || 0.4, // Lower for more consistent responses
            stream: false,
            top_p: options.topP || 0.9
        };

        // Add system message for car context if not present
        if (!requestOptions.messages.some(m => m.role === 'system')) {
            requestOptions.messages.unshift({
                role: 'system',
                content: this.getCarSystemPrompt()
            });
        }

        let lastError;
        const errors = [];
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`🤖 Generating response with ${this.provider} (attempt ${attempt}/${this.maxRetries})`);
                
                const response = await this.makeRequestWithTimeout(requestOptions);
                
                if (!this.validateResponse(response)) {
                    throw new Error('Invalid response format');
                }
                
                const content = response.choices[0].message.content;
                if (!this.validateContent(content)) {
                    throw new Error('Invalid or empty content');
                }
                
                return {
                    content: this.optimizeForVoice(content),
                    provider: this.provider,
                    model: this.model,
                    usage: response.usage || {},
                    responseTime: Date.now(),
                    attempts: attempt,
                    cached: false
                };
                
            } catch (error) {
                lastError = error;
                errors.push({ attempt, error: error.message, timestamp: Date.now() });
                
                if (!this.isRetryableError(error) || attempt >= this.maxRetries) {
                    break;
                }
                
                const backoffDelay = this.calculateBackoffDelay(attempt);
                console.log(`⏳ Waiting ${backoffDelay}ms before retry...`);
                await this.delay(backoffDelay);
            }
        }

        throw new Error(`All attempts failed: ${lastError.message}`);
    }

    async makeRequestWithTimeout(requestOptions) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await axios({
                method: 'POST',
                url: `${this.baseURL}/chat/completions`,
                headers: this.getHeaders(),
                data: requestOptions,
                signal: controller.signal,
                timeout: this.timeout
            });
            
            return response.data;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': 'CarBot/1.0'
        };
    }

    optimizeMessagesForCar(messages) {
        return messages.map(msg => ({
            ...msg,
            content: this.optimizeContentForCar(msg.content)
        })).slice(-5); // Keep only last 5 messages for context
    }

    optimizeContentForCar(content) {
        // Remove excessive details, keep car-relevant information
        return content
            .replace(/\s+/g, ' ') // Normalize whitespace
            .substring(0, 500) // Limit length for faster processing
            .trim();
    }

    getCarSystemPrompt() {
        return `You are CarBot, an AI assistant for car drivers. Be concise, helpful, and safety-focused. 
        Respond in 1-2 sentences maximum. Prioritize navigation, music, calls, and safety features. 
        Always consider the driver is operating a vehicle and needs quick, clear responses.`;
    }

    optimizeForVoice(content) {
        return content
            .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove markdown bold
            .replace(/\*([^*]+)\*/g, '$1') // Remove markdown italic
            .replace(/`([^`]+)`/g, '$1') // Remove code formatting
            .replace(/\n+/g, '. ') // Convert line breaks to periods
            .replace(/\s+/g, ' ') // Normalize spaces
            .replace(/\.\s*\./g, '.') // Remove double periods
            .trim();
    }

    validateResponse(response) {
        return response && 
               response.choices && 
               Array.isArray(response.choices) && 
               response.choices.length > 0 &&
               response.choices[0].message;
    }

    validateContent(content) {
        return content && 
               typeof content === 'string' && 
               content.trim().length > 0 &&
               content.trim().length <= 500; // Reasonable limit for voice
    }

    isRetryableError(error) {
        const retryablePatterns = [
            /timeout/i, /network/i, /connection/i, /socket/i,
            /ECONNRESET/i, /ENOTFOUND/i, /ECONNREFUSED/i,
            /429/i, /502/i, /503/i, /504/i, /rate.?limit/i
        ];
        
        return retryablePatterns.some(pattern => pattern.test(error.message));
    }

    calculateBackoffDelay(attempt) {
        const baseDelay = Math.min(1000 * Math.pow(1.5, attempt - 1), 8000); // Max 8s
        const jitter = Math.random() * 0.2 * baseDelay; // 20% jitter
        return Math.floor(baseDelay + jitter);
    }

    // Circuit breaker implementation
    isCircuitBreakerOpen() {
        if (!this.circuitBreaker.isOpen) return false;
        
        const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailure;
        if (timeSinceLastFailure > this.circuitBreakerResetTime) {
            console.log('🟡 Circuit breaker reset, attempting request');
            this.circuitBreaker.isOpen = false;
            this.circuitBreaker.failures = 0;
            return false;
        }
        
        return true;
    }

    updateCircuitBreaker() {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailure = Date.now();
        
        if (this.circuitBreaker.failures >= this.circuitBreakerThreshold) {
            console.log('🔴 Circuit breaker opened due to consecutive failures');
            this.circuitBreaker.isOpen = true;
        }
    }

    // Caching implementation
    getCacheKey(messages, options) {
        const lastMessage = messages[messages.length - 1];
        return `${lastMessage.content.substring(0, 100)}_${options.temperature || 0.4}`;
    }

    getFromCache(key) {
        const cached = this.responseCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return { ...cached.response, cached: true };
        }
        return null;
    }

    cacheResponse(key, response) {
        this.responseCache.set(key, {
            response: response,
            timestamp: Date.now()
        });
        
        // Clean old cache entries
        if (this.responseCache.size > 50) {
            const oldestKey = this.responseCache.keys().next().value;
            this.responseCache.delete(oldestKey);
        }
    }

    updateMetrics(success, responseTime) {
        this.metrics.requests++;
        this.metrics.lastResponseTime = responseTime;
        
        if (success) {
            this.metrics.successes++;
        } else {
            this.metrics.failures++;
        }
        
        // Update rolling average
        const totalResponses = this.metrics.successes + this.metrics.failures;
        this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime * (totalResponses - 1) + responseTime) / totalResponses;
    }

    getFallbackResponse(messages, error = null) {
        const lastMessage = messages[messages.length - 1];
        const text = lastMessage.content.toLowerCase();
        
        // Car-specific fallback responses
        if (text.includes('navigate') || text.includes('direction')) {
            return {
                content: "I can help with navigation. Where would you like to go?",
                provider: 'fallback',
                model: 'rule-based',
                usage: { total_tokens: 0 }
            };
        }
        
        if (text.includes('music') || text.includes('play')) {
            return {
                content: "I can control your music. What would you like to play?",
                provider: 'fallback',
                model: 'rule-based',
                usage: { total_tokens: 0 }
            };
        }
        
        if (text.includes('call') || text.includes('phone')) {
            return {
                content: "I can help make phone calls. Who would you like to call?",
                provider: 'fallback',
                model: 'rule-based',
                usage: { total_tokens: 0 }
            };
        }
        
        if (text.includes('emergency') || text.includes('help')) {
            return {
                content: "Emergency services ready. How can I help you?",
                provider: 'fallback',
                model: 'rule-based',
                usage: { total_tokens: 0 }
            };
        }
        
        // Default response
        return {
            content: "I'm here to help. What can I do for you?",
            provider: 'fallback',
            model: 'rule-based',
            usage: { total_tokens: 0 }
        };
    }

    // Function registration (keeping existing functionality)
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
                    }
                },
                required: ['destination']
            },
            async (params) => {
                return {
                    success: true,
                    message: `Starting navigation to ${params.destination}`,
                    action: 'navigation_started'
                };
            }
        );
        
        // Music control
        this.registerFunction('control_music',
            'Control music playback',
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
                        description: 'Song or artist to search for'
                    }
                },
                required: ['action']
            },
            async (params) => {
                return {
                    success: true,
                    message: `Music ${params.action} ${params.query ? 'for ' + params.query : ''}`,
                    action: 'music_controlled'
                };
            }
        );
    }

    registerFunction(name, description, parameters, handler) {
        this.availableFunctions.set(name, {
            name, description, parameters, handler
        });
    }

    getMetrics() {
        return {
            ...this.metrics,
            successRate: this.metrics.requests > 0 ? 
                (this.metrics.successes / this.metrics.requests * 100).toFixed(2) + '%' : '0%',
            circuitBreakerState: this.circuitBreaker.isOpen ? 'open' : 'closed',
            circuitBreakerFailures: this.circuitBreaker.failures,
            cacheSize: this.responseCache.size
        };
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async testConnection() {
        try {
            const testMessages = [
                { role: 'user', content: 'Hello, respond with just OK' }
            ];
            
            const response = await this.generateResponse(testMessages, { maxTokens: 10 });
            return {
                success: true,
                provider: this.provider,
                model: this.model,
                responseTime: this.metrics.lastResponseTime,
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

    destroy() {
        this.responseCache.clear();
        console.log('🗑️ Enhanced AI Provider destroyed');
    }
}

module.exports = EnhancedAIProvider;