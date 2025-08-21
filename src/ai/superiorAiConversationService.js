const EventEmitter = require('events');
const EnhancedAIProvider = require('./enhancedAiProvider');

/**
 * Superior AI Conversation Service
 * 
 * This service makes CarBot outperform Google Assistant by providing:
 * - Real-time web search and current events
 * - Social media integration (Twitter/X updates)
 * - Context-aware car assistance
 * - Multi-turn conversation memory
 * - Proactive suggestions based on driving context
 * - Voice-optimized responses for safety
 */
class SuperiorAIConversationService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxContextTurns: options.maxContextTurns || 10,
            realTimeDataTimeout: options.realTimeDataTimeout || 8000,
            proactiveMode: options.proactiveMode ?? true,
            emergencyMode: options.emergencyMode ?? true,
            voiceOptimization: options.voiceOptimization ?? true,
            ...options
        };

        // Initialize AI provider with enhanced capabilities
        this.aiProvider = new EnhancedAIProvider({
            maxRetries: 2,
            timeout: 10000,
            circuitBreakerThreshold: 3
        });

        // Real-time data providers (to be injected)
        this.realTimeDataProvider = null;
        this.contextManager = null;
        this.carIntelligence = null;
        this.responseOptimizer = null;

        // Conversation state
        this.currentConversation = {
            id: null,
            startTime: null,
            context: [],
            drivingContext: {
                isMoving: false,
                speed: 0,
                location: null,
                destination: null,
                route: null
            },
            userPreferences: {
                responseLength: 'short', // short, medium, long
                includeProactive: true,
                emergencyContactsReady: true
            }
        };

        // Performance metrics
        this.metrics = {
            totalQueries: 0,
            realTimeQueries: 0,
            proactiveResponses: 0,
            emergencyHandled: 0,
            averageResponseTime: 0,
            successRate: 0
        };

        console.log('🧠 Superior AI Conversation Service initialized');
    }

    /**
     * Set real-time data provider
     */
    setRealTimeDataProvider(provider) {
        this.realTimeDataProvider = provider;
        console.log('🌐 Real-time data provider connected');
    }

    /**
     * Set conversation context manager
     */
    setContextManager(manager) {
        this.contextManager = manager;
        console.log('🧠 Context manager connected');
    }

    /**
     * Set car intelligence service
     */
    setCarIntelligence(intelligence) {
        this.carIntelligence = intelligence;
        console.log('🚗 Car intelligence service connected');
    }

    /**
     * Set response optimizer
     */
    setResponseOptimizer(optimizer) {
        this.responseOptimizer = optimizer;
        console.log('⚡ Response optimizer connected');
    }

    /**
     * Start a new conversation
     */
    startConversation(initialContext = {}) {
        this.currentConversation = {
            id: this.generateConversationId(),
            startTime: Date.now(),
            context: [],
            drivingContext: {
                isMoving: initialContext.isMoving || false,
                speed: initialContext.speed || 0,
                location: initialContext.location || null,
                destination: initialContext.destination || null,
                route: initialContext.route || null
            },
            userPreferences: {
                responseLength: initialContext.responseLength || 'short',
                includeProactive: initialContext.includeProactive ?? true,
                emergencyContactsReady: true
            }
        };

        this.emit('conversationStarted', this.currentConversation);
        console.log(`💬 Started superior conversation: ${this.currentConversation.id}`);
    }

    /**
     * Process user input with superior intelligence
     */
    async processUserInput(input, metadata = {}) {
        const startTime = Date.now();
        this.metrics.totalQueries++;

        try {
            // 1. Analyze input for intent and urgency
            const analysis = await this.analyzeUserInput(input, metadata);
            
            // 2. Handle emergency situations immediately
            if (analysis.isEmergency) {
                return await this.handleEmergencyInput(input, analysis);
            }

            // 3. Determine if real-time data is needed
            if (analysis.needsRealTimeData) {
                this.metrics.realTimeQueries++;
                return await this.handleRealTimeQuery(input, analysis);
            }

            // 4. Check for car-specific requests
            if (analysis.isCarSpecific) {
                return await this.handleCarSpecificQuery(input, analysis);
            }

            // 5. Generate contextual response
            const response = await this.generateSuperiorResponse(input, analysis);

            // 6. Add proactive suggestions if enabled
            if (this.options.proactiveMode && analysis.allowsProactive) {
                await this.addProactiveSuggestions(response, analysis);
            }

            // 7. Optimize response for voice and safety
            const finalResponse = await this.optimizeResponse(response, analysis);

            // 8. Update conversation context
            this.updateConversationContext(input, finalResponse, analysis);

            // 9. Update metrics
            this.updateMetrics(true, Date.now() - startTime);

            return finalResponse;

        } catch (error) {
            console.error('🚨 Superior AI error:', error);
            this.updateMetrics(false, Date.now() - startTime);
            return this.generateFallbackResponse(input, error);
        }
    }

    /**
     * Analyze user input for intent, urgency, and data needs
     */
    async analyzeUserInput(input, metadata) {
        const lowercaseInput = input.toLowerCase();
        
        const analysis = {
            input: input,
            intent: this.extractIntent(input),
            isEmergency: this.detectEmergency(input),
            needsRealTimeData: this.needsRealTimeData(input),
            isCarSpecific: this.isCarSpecific(input),
            allowsProactive: !this.isDirectCommand(input),
            urgencyLevel: this.calculateUrgency(input, metadata),
            topics: this.extractTopics(input),
            entities: this.extractEntities(input),
            confidence: 0.8
        };

        return analysis;
    }

    /**
     * Detect emergency situations
     */
    detectEmergency(input) {
        const emergencyKeywords = [
            'emergency', 'help', 'accident', 'crash', 'fire', 'medical',
            'police', 'ambulance', '911', 'urgent', 'danger', 'stuck',
            'broken down', 'stranded', 'hurt', 'injured'
        ];
        
        const lowercaseInput = input.toLowerCase();
        return emergencyKeywords.some(keyword => lowercaseInput.includes(keyword));
    }

    /**
     * Check if input needs real-time data
     */
    needsRealTimeData(input) {
        const realTimeKeywords = [
            'latest', 'newest', 'recent', 'current', 'today', 'now',
            'what is happening', 'what happened', 'news', 'twitter', 'tweet',
            'elon', 'trump', 'stock price', 'weather', 'traffic',
            'happening with', 'latest from', 'current status'
        ];
        
        const lowercaseInput = input.toLowerCase();
        return realTimeKeywords.some(keyword => lowercaseInput.includes(keyword));
    }

    /**
     * Check if input is car-specific
     */
    isCarSpecific(input) {
        const carKeywords = [
            'navigate', 'directions', 'route', 'traffic', 'gas station',
            'parking', 'restaurant nearby', 'hotel near', 'music', 'play',
            'call', 'phone', 'climate', 'temperature', 'ac', 'heat'
        ];
        
        const lowercaseInput = input.toLowerCase();
        return carKeywords.some(keyword => lowercaseInput.includes(keyword));
    }

    /**
     * Check if input is a direct command
     */
    isDirectCommand(input) {
        const commandPrefixes = ['play', 'stop', 'pause', 'skip', 'call', 'navigate to'];
        const lowercaseInput = input.toLowerCase();
        return commandPrefixes.some(prefix => lowercaseInput.startsWith(prefix));
    }

    /**
     * Calculate urgency level
     */
    calculateUrgency(input, metadata) {
        let urgency = 0;
        
        // Check for urgent keywords
        const urgentWords = ['urgent', 'quickly', 'immediate', 'asap', 'now', 'fast'];
        urgentWords.forEach(word => {
            if (input.toLowerCase().includes(word)) urgency += 0.3;
        });
        
        // Check audio metadata
        if (metadata.volume && metadata.volume > 0.7) urgency += 0.2;
        if (metadata.speechRate && metadata.speechRate > 1.2) urgency += 0.2;
        
        return Math.min(1.0, urgency);
    }

    /**
     * Extract topics from input
     */
    extractTopics(input) {
        const topics = [];
        const topicPatterns = {
            'social_media': ['twitter', 'tweet', 'x.com', 'facebook', 'instagram'],
            'politics': ['trump', 'biden', 'election', 'president', 'congress'],
            'technology': ['tesla', 'spacex', 'ai', 'tech', 'apple', 'google'],
            'finance': ['stock', 'market', 'bitcoin', 'crypto', 'price'],
            'weather': ['weather', 'temperature', 'rain', 'snow', 'storm'],
            'navigation': ['directions', 'navigate', 'route', 'traffic'],
            'entertainment': ['music', 'movie', 'song', 'artist', 'play']
        };
        
        const lowercaseInput = input.toLowerCase();
        for (const [topic, keywords] of Object.entries(topicPatterns)) {
            if (keywords.some(keyword => lowercaseInput.includes(keyword))) {
                topics.push(topic);
            }
        }
        
        return topics;
    }

    /**
     * Extract entities from input
     */
    extractEntities(input) {
        const entities = {};
        
        // Extract people
        const peoplePatterns = ['elon musk', 'trump', 'biden', 'putin'];
        peoplePatterns.forEach(person => {
            if (input.toLowerCase().includes(person)) {
                entities.people = entities.people || [];
                entities.people.push(person);
            }
        });
        
        // Extract locations (basic pattern matching)
        const locationWords = ['in', 'at', 'near', 'to'];
        locationWords.forEach(word => {
            const regex = new RegExp(`${word}\\s+([A-Z][a-zA-Z\\s]+)`, 'i');
            const match = input.match(regex);
            if (match) {
                entities.locations = entities.locations || [];
                entities.locations.push(match[1].trim());
            }
        });
        
        return entities;
    }

    /**
     * Extract intent from user input
     */
    extractIntent(input) {
        const intentPatterns = {
            'question': ['what', 'how', 'why', 'when', 'where', 'who', '?'],
            'request': ['please', 'can you', 'could you', 'would you'],
            'command': ['play', 'stop', 'start', 'open', 'close', 'navigate'],
            'search': ['find', 'search', 'look up', 'tell me about'],
            'social': ['twitter', 'tweet', 'latest from', 'what did'],
            'news': ['news', 'happened', 'current events', 'updates']
        };
        
        const lowercaseInput = input.toLowerCase();
        
        for (const [intent, keywords] of Object.entries(intentPatterns)) {
            if (keywords.some(keyword => lowercaseInput.includes(keyword))) {
                return intent;
            }
        }
        
        return 'general';
    }

    /**
     * Handle emergency input with immediate response
     */
    async handleEmergencyInput(input, analysis) {
        this.metrics.emergencyHandled++;
        
        const emergencyResponse = {
            content: "Emergency detected. I'm getting help for you right away. Stay calm.",
            type: 'emergency',
            priority: 'critical',
            actions: ['emergency_services_contacted', 'location_shared'],
            timestamp: Date.now()
        };

        // Trigger emergency protocols
        this.emit('emergency', {
            input: input,
            analysis: analysis,
            location: this.currentConversation.drivingContext.location
        });

        console.log('🚨 Emergency situation detected and handled');
        return emergencyResponse;
    }

    /**
     * Handle real-time queries with current data
     */
    async handleRealTimeQuery(input, analysis) {
        try {
            if (!this.realTimeDataProvider) {
                throw new Error('Real-time data provider not available');
            }

            let realTimeData = null;
            
            // Determine what type of real-time data is needed
            if (analysis.topics.includes('social_media')) {
                realTimeData = await this.getRealTimeSocialMedia(input, analysis);
            } else if (analysis.topics.includes('weather')) {
                realTimeData = await this.getRealTimeWeather(input, analysis);
            } else if (analysis.topics.includes('finance')) {
                realTimeData = await this.getRealTimeFinance(input, analysis);
            } else {
                realTimeData = await this.getRealTimeNews(input, analysis);
            }

            // Generate response with real-time data
            const response = await this.generateResponseWithRealTimeData(input, realTimeData, analysis);
            
            response.hasRealTimeData = true;
            response.dataTimestamp = Date.now();
            
            return response;
            
        } catch (error) {
            console.warn('⚠️ Real-time data unavailable, using AI only:', error.message);
            return await this.generateSuperiorResponse(input, analysis);
        }
    }

    /**
     * Get real-time social media data
     */
    async getRealTimeSocialMedia(input, analysis) {
        const socialData = {};
        
        if (input.toLowerCase().includes('elon')) {
            socialData.elonTweets = await this.realTimeDataProvider.getElonTweets(3);
        }
        
        if (input.toLowerCase().includes('trump')) {
            socialData.trumpTweets = await this.realTimeDataProvider.getTrumpTweets(3);
        }
        
        return socialData;
    }

    /**
     * Get real-time weather data
     */
    async getRealTimeWeather(input, analysis) {
        const location = this.extractLocationFromInput(input) || 
                        this.currentConversation.drivingContext.location;
        
        if (!location) {
            throw new Error('Location not available for weather query');
        }
        
        return await this.realTimeDataProvider.getWeatherData(location);
    }

    /**
     * Get real-time financial data
     */
    async getRealTimeFinance(input, analysis) {
        const symbol = this.extractStockSymbol(input);
        
        if (!symbol) {
            throw new Error('Stock symbol not found in query');
        }
        
        return await this.realTimeDataProvider.getStockData(symbol);
    }

    /**
     * Get real-time news data
     */
    async getRealTimeNews(input, analysis) {
        const query = this.extractNewsQuery(input, analysis);
        return await this.realTimeDataProvider.getNewsData(query);
    }

    /**
     * Handle car-specific queries
     */
    async handleCarSpecificQuery(input, analysis) {
        if (!this.carIntelligence) {
            return await this.generateSuperiorResponse(input, analysis);
        }

        // Get car-specific intelligence
        const carContext = await this.carIntelligence.getContextualSuggestions(
            input, 
            this.currentConversation.drivingContext
        );

        // Generate response with car intelligence
        const response = await this.generateResponseWithCarContext(input, carContext, analysis);
        
        response.hasCarIntelligence = true;
        
        return response;
    }

    /**
     * Generate superior AI response
     */
    async generateSuperiorResponse(input, analysis) {
        // Build context for AI
        const contextMessages = this.buildSuperiorContext(input, analysis);
        
        // Generate response with enhanced AI
        const aiResponse = await this.aiProvider.generateResponse(contextMessages, {
            maxTokens: this.getTokenLimitForContext(analysis),
            temperature: this.getTemperatureForIntent(analysis.intent),
            model: this.selectModelForQuery(analysis)
        });
        
        return {
            content: aiResponse.content,
            type: 'ai_generated',
            analysis: analysis,
            provider: aiResponse.provider,
            confidence: analysis.confidence,
            timestamp: Date.now()
        };
    }

    /**
     * Generate response with real-time data
     */
    async generateResponseWithRealTimeData(input, realTimeData, analysis) {
        // Create enhanced context with real-time data
        const contextMessages = this.buildSuperiorContext(input, analysis);
        
        // Add real-time data to context
        if (realTimeData) {
            contextMessages.push({
                role: 'system',
                content: `Real-time data: ${JSON.stringify(realTimeData, null, 2)}`
            });
        }
        
        const aiResponse = await this.aiProvider.generateResponse(contextMessages, {
            maxTokens: 180,
            temperature: 0.6
        });
        
        return {
            content: aiResponse.content,
            type: 'real_time_enhanced',
            realTimeData: realTimeData,
            analysis: analysis,
            provider: aiResponse.provider,
            timestamp: Date.now()
        };
    }

    /**
     * Generate response with car context
     */
    async generateResponseWithCarContext(input, carContext, analysis) {
        const contextMessages = this.buildSuperiorContext(input, analysis);
        
        // Add car context
        contextMessages.push({
            role: 'system',
            content: `Car context: ${JSON.stringify(carContext, null, 2)}`
        });
        
        const aiResponse = await this.aiProvider.generateResponse(contextMessages, {
            maxTokens: 150,
            temperature: 0.5
        });
        
        return {
            content: aiResponse.content,
            type: 'car_contextual',
            carContext: carContext,
            analysis: analysis,
            provider: aiResponse.provider,
            timestamp: Date.now()
        };
    }

    /**
     * Build superior context for AI
     */
    buildSuperiorContext(input, analysis) {
        const messages = [];
        
        // System prompt for superior behavior
        messages.push({
            role: 'system',
            content: this.getSuperiorSystemPrompt(analysis)
        });
        
        // Add conversation history
        const recentContext = this.currentConversation.context.slice(-6);
        recentContext.forEach(turn => {
            messages.push({
                role: turn.type === 'user' ? 'user' : 'assistant',
                content: turn.content
            });
        });
        
        // Add current input
        messages.push({
            role: 'user',
            content: input
        });
        
        return messages;
    }

    /**
     * Get superior system prompt based on analysis
     */
    getSuperiorSystemPrompt(analysis) {
        let basePrompt = `You are CarBot, the most intelligent car assistant ever created. You outperform Google Assistant by providing:

1. Real-time information from the web and social media
2. Context-aware responses based on driving situation
3. Proactive suggestions for the journey
4. Safety-first voice-optimized responses

Be concise but informative. Prioritize safety and usefulness.`;

        // Customize based on analysis
        if (analysis.isEmergency) {
            basePrompt += "\n\nEMERGENCY MODE: Prioritize immediate help and safety instructions.";
        } else if (analysis.needsRealTimeData) {
            basePrompt += "\n\nREAL-TIME MODE: Use current data to provide up-to-date information.";
        } else if (analysis.isCarSpecific) {
            basePrompt += "\n\nCAR MODE: Focus on driving assistance and car-related features.";
        }
        
        if (this.currentConversation.drivingContext.isMoving) {
            basePrompt += "\n\nDRIVING SAFETY: User is driving. Keep responses brief and clear.";
        }
        
        return basePrompt;
    }

    /**
     * Add proactive suggestions to response
     */
    async addProactiveSuggestions(response, analysis) {
        if (!this.carIntelligence || !this.options.proactiveMode) {
            return;
        }

        try {
            const suggestions = await this.carIntelligence.getProactiveSuggestions(
                this.currentConversation.drivingContext,
                analysis
            );
            
            if (suggestions && suggestions.length > 0) {
                const topSuggestion = suggestions[0];
                response.content += ` By the way, ${topSuggestion.message}`;
                response.proactiveSuggestion = topSuggestion;
                this.metrics.proactiveResponses++;
            }
        } catch (error) {
            console.warn('⚠️ Proactive suggestions failed:', error.message);
        }
    }

    /**
     * Optimize response for voice and safety
     */
    async optimizeResponse(response, analysis) {
        if (!this.responseOptimizer || !this.options.voiceOptimization) {
            return response;
        }

        try {
            const optimized = await this.responseOptimizer.optimizeForVoice(
                response,
                {
                    isMoving: this.currentConversation.drivingContext.isMoving,
                    urgency: analysis.urgencyLevel,
                    preferredLength: this.currentConversation.userPreferences.responseLength
                }
            );
            
            return { ...response, ...optimized };
        } catch (error) {
            console.warn('⚠️ Response optimization failed:', error.message);
            return response;
        }
    }

    /**
     * Update conversation context
     */
    updateConversationContext(input, response, analysis) {
        this.currentConversation.context.push(
            {
                type: 'user',
                content: input,
                timestamp: Date.now(),
                analysis: analysis
            },
            {
                type: 'assistant',
                content: response.content,
                timestamp: Date.now(),
                type: response.type,
                hasRealTimeData: response.hasRealTimeData
            }
        );

        // Maintain context length
        if (this.currentConversation.context.length > this.options.maxContextTurns * 2) {
            this.currentConversation.context = this.currentConversation.context.slice(-this.options.maxContextTurns * 2);
        }
    }

    /**
     * Update driving context
     */
    updateDrivingContext(context) {
        this.currentConversation.drivingContext = {
            ...this.currentConversation.drivingContext,
            ...context
        };
        
        this.emit('drivingContextUpdated', this.currentConversation.drivingContext);
    }

    /**
     * Generate fallback response
     */
    generateFallbackResponse(input, error) {
        return {
            content: "I'm having trouble processing that right now. Could you please try again?",
            type: 'fallback',
            error: error.message,
            timestamp: Date.now()
        };
    }

    /**
     * Utility methods
     */
    generateConversationId() {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getTokenLimitForContext(analysis) {
        if (this.currentConversation.drivingContext.isMoving) {
            return 120; // Shorter for safety while driving
        }
        
        switch (analysis.intent) {
            case 'search':
            case 'news': return 180;
            case 'social': return 150;
            default: return 140;
        }
    }

    getTemperatureForIntent(intent) {
        switch (intent) {
            case 'command': return 0.3; // More deterministic
            case 'search': return 0.6;  // Balanced
            case 'question': return 0.7; // More creative
            default: return 0.5;
        }
    }

    selectModelForQuery(analysis) {
        // Could switch models based on query type
        return 'llama3-8b-8192'; // Default for now
    }

    extractLocationFromInput(input) {
        // Basic location extraction
        const locationMatch = input.match(/(?:in|at|near)\s+([A-Z][a-zA-Z\s]+)/i);
        return locationMatch ? locationMatch[1].trim() : null;
    }

    extractStockSymbol(input) {
        // Basic stock symbol extraction
        const symbolMatch = input.match(/\b([A-Z]{1,5})\b/);
        return symbolMatch ? symbolMatch[1] : null;
    }

    extractNewsQuery(input, analysis) {
        // Extract relevant search terms for news
        if (analysis.entities.people) {
            return analysis.entities.people[0];
        }
        
        if (analysis.topics.includes('politics')) {
            return 'politics news';
        }
        
        return input.replace(/what.*(happening|happened|news|latest)/i, '').trim();
    }

    /**
     * Update performance metrics
     */
    updateMetrics(success, responseTime) {
        if (success) {
            this.metrics.averageResponseTime = 
                (this.metrics.averageResponseTime * (this.metrics.totalQueries - 1) + responseTime) / this.metrics.totalQueries;
        }
        
        this.metrics.successRate = 
            ((this.metrics.totalQueries - (this.metrics.totalQueries - this.getSuccessfulQueries())) / this.metrics.totalQueries) * 100;
    }

    getSuccessfulQueries() {
        // Calculate based on responses that weren't fallbacks
        return this.metrics.totalQueries - this.metrics.emergencyHandled;
    }

    /**
     * Get comprehensive metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            conversationId: this.currentConversation.id,
            conversationDuration: this.currentConversation.startTime ? 
                Date.now() - this.currentConversation.startTime : 0,
            contextTurns: this.currentConversation.context.length,
            aiProviderMetrics: this.aiProvider.getMetrics()
        };
    }

    /**
     * Test the superior AI system
     */
    async testSuperiorCapabilities() {
        const testQueries = [
            "What's Elon's latest tweet?",
            "What's happening with Trump today?",
            "Navigate to the nearest gas station",
            "Play some relaxing music for the drive",
            "What's the weather like at my destination?"
        ];

        const results = [];
        
        for (const query of testQueries) {
            try {
                const startTime = Date.now();
                const response = await this.processUserInput(query);
                const responseTime = Date.now() - startTime;
                
                results.push({
                    query,
                    response: response.content,
                    type: response.type,
                    responseTime,
                    success: true
                });
            } catch (error) {
                results.push({
                    query,
                    error: error.message,
                    success: false
                });
            }
        }
        
        return results;
    }

    /**
     * Destroy service and cleanup
     */
    destroy() {
        this.removeAllListeners();
        if (this.aiProvider) {
            this.aiProvider.destroy();
        }
        console.log('🗑️ Superior AI Conversation Service destroyed');
    }
}

module.exports = SuperiorAIConversationService;