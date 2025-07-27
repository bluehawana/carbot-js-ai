const AIProvider = require('../ai/aiProvider');
const SocialMediaService = require('../services/socialMediaService');

class ConversationHandler {
    constructor(options = {}) {
        this.aiProvider = new AIProvider({
            provider: options.provider || process.env.AI_PROVIDER || 'openai',
            apiKey: options.apiKey
        });
        
        this.conversationHistory = [];
        this.maxHistoryLength = options.maxHistoryLength || 10;
        this.systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();
        this.socialMedia = new SocialMediaService();
        this.carContext = {
            speed: 0,
            location: null,
            destination: null,
            route: null,
            musicPlaying: false,
            currentSong: null,
            navigationActive: false
        };
    }

    getDefaultSystemPrompt() {
        return `You are ECARX, an intelligent voice assistant designed for cars. You are helpful, concise, and safety-focused.

Key guidelines:
- Keep responses short and clear for safe driving
- Prioritize safety-related information
- Be conversational but professional
- Understand car-specific contexts (navigation, music, calls, etc.)
- Respond to commands and questions about car features
- Always be ready to help with driving-related tasks

Current car context will be provided with each conversation.

Remember: You are activated by the wake word "Hej Car" and should respond naturally to user queries.`;
    }

    async processMessage(userMessage, carContext = null) {
        try {
            // Update car context if provided
            if (carContext) {
                this.carContext = { ...this.carContext, ...carContext };
            }

            // Check for Twitter-specific queries first
            const twitterIntent = this.detectTwitterIntent(userMessage);
            if (twitterIntent) {
                return await this.handleTwitterQuery(userMessage, twitterIntent);
            }

            // Add user message to history
            this.conversationHistory.push({
                role: 'user',
                content: userMessage,
                timestamp: new Date().toISOString()
            });

            // Maintain conversation history length
            if (this.conversationHistory.length > this.maxHistoryLength) {
                this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
            }

            // Prepare messages for OpenAI
            const messages = [
                {
                    role: 'system',
                    content: this.systemPrompt + this.getCarContextPrompt()
                },
                ...this.conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            ];

            console.log('Sending message to AI provider:', userMessage);
            
            const response = await this.aiProvider.generateResponse(messages, {
                maxTokens: 150,
                temperature: 0.7,
                presencePenalty: 0.1,
                frequencyPenalty: 0.1
            });

            const assistantMessage = response.content;

            // Add assistant response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: assistantMessage,
                timestamp: new Date().toISOString()
            });

            console.log('Assistant response:', assistantMessage);
            
            return {
                response: assistantMessage,
                intent: this.detectIntent(userMessage),
                actions: this.extractActions(assistantMessage),
                context: this.carContext
            };

        } catch (error) {
            console.error('Error processing message:', error);
            
            // Fallback response
            const fallbackResponse = this.getFallbackResponse(userMessage);
            return {
                response: fallbackResponse,
                intent: 'unknown',
                actions: [],
                context: this.carContext
            };
        }
    }

    getCarContextPrompt() {
        const context = this.carContext;
        let prompt = '\n\nCurrent car context:';
        
        if (context.speed > 0) {
            prompt += `\n- Vehicle speed: ${context.speed} mph`;
        }
        
        if (context.location) {
            prompt += `\n- Current location: ${context.location}`;
        }
        
        if (context.destination) {
            prompt += `\n- Destination: ${context.destination}`;
        }
        
        if (context.navigationActive) {
            prompt += '\n- Navigation is active';
        }
        
        if (context.musicPlaying) {
            prompt += `\n- Music playing: ${context.currentSong || 'Unknown'}`;
        }
        
        return prompt;
    }

    detectIntent(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('navigate') || lowerMessage.includes('directions') || 
            lowerMessage.includes('route') || lowerMessage.includes('go to')) {
            return 'navigation';
        }
        
        if (lowerMessage.includes('music') || lowerMessage.includes('play') || 
            lowerMessage.includes('song') || lowerMessage.includes('radio')) {
            return 'music';
        }
        
        if (lowerMessage.includes('call') || lowerMessage.includes('phone') || 
            lowerMessage.includes('contact')) {
            return 'phone';
        }
        
        if (lowerMessage.includes('weather') || lowerMessage.includes('temperature')) {
            return 'weather';
        }
        
        if (lowerMessage.includes('news') || lowerMessage.includes('headlines')) {
            return 'news';
        }
        
        if (lowerMessage.includes('twitter') || lowerMessage.includes('tweet') || 
            lowerMessage.includes('social media')) {
            return 'twitter';
        }
        
        if (lowerMessage.includes('help') || lowerMessage.includes('assist')) {
            return 'help';
        }
        
        return 'conversation';
    }

    extractActions(response) {
        const actions = [];
        const lowerResponse = response.toLowerCase();
        
        if (lowerResponse.includes('starting navigation') || 
            lowerResponse.includes('calculating route')) {
            actions.push({ type: 'navigation', action: 'start' });
        }
        
        if (lowerResponse.includes('playing music') || 
            lowerResponse.includes('starting playlist')) {
            actions.push({ type: 'music', action: 'play' });
        }
        
        if (lowerResponse.includes('calling') || 
            lowerResponse.includes('dialing')) {
            actions.push({ type: 'phone', action: 'call' });
        }
        
        return actions;
    }

    getFallbackResponse(userMessage) {
        const intent = this.detectIntent(userMessage);
        
        switch (intent) {
            case 'navigation':
                return "I can help with navigation. Please specify your destination.";
            case 'music':
                return "I can control music playback. What would you like to listen to?";
            case 'phone':
                return "I can help with phone calls. Who would you like to call?";
            case 'weather':
                return "I can check the weather for you. What location?";
            case 'twitter':
                return "I can check Twitter for you. Try asking about specific users like Elon Musk or Donald Trump.";
            case 'help':
                return "I'm ECARX, your car assistant. I can help with navigation, music, calls, Twitter updates, and more.";
            default:
                return "I'm sorry, I didn't understand that. How can I help you?";
        }
    }

    updateCarContext(context) {
        this.carContext = { ...this.carContext, ...context };
    }

    clearHistory() {
        this.conversationHistory = [];
    }

    getConversationHistory() {
        return this.conversationHistory;
    }

    // Twitter-specific functionality
    detectTwitterIntent(message) {
        const lowerMessage = message.toLowerCase();
        
        // Check for specific users
        if (lowerMessage.includes('elon') || lowerMessage.includes('elon musk')) {
            return { type: 'user_tweets', username: 'elonmusk', user: 'Elon Musk' };
        }
        
        if (lowerMessage.includes('trump') || lowerMessage.includes('donald trump')) {
            return { type: 'user_tweets', username: 'realDonaldTrump', user: 'Donald Trump' };
        }
        
        // Check for general Twitter queries
        if (lowerMessage.includes('twitter') || lowerMessage.includes('tweet')) {
            if (lowerMessage.includes('latest') || lowerMessage.includes('newest') || 
                lowerMessage.includes('recent')) {
                return { type: 'latest_tweets' };
            }
            
            if (lowerMessage.includes('search') || lowerMessage.includes('find')) {
                return { type: 'search_tweets' };
            }
        }
        
        return null;
    }

    async handleTwitterQuery(userMessage, twitterIntent) {
        if (!this.socialMedia.isTwitterAvailable()) {
            return {
                response: "Sorry, Twitter features are not available. Please check your Twitter Bearer Token configuration.",
                intent: 'twitter_error',
                actions: [],
                context: this.carContext
            };
        }

        try {
            let response = "";
            let tweetData = null;

            switch (twitterIntent.type) {
                case 'user_tweets':
                    console.log(`Fetching tweets for ${twitterIntent.username}...`);
                    tweetData = await this.socialMedia.getUserTweets(twitterIntent.username, 5);
                    response = this.socialMedia.formatForVoice(tweetData, 1);
                    break;

                case 'latest_tweets':
                    console.log('Fetching trending updates...');
                    const trending = await this.socialMedia.getTrendingUpdates(['realDonaldTrump', 'elonmusk'], 5);
                    response = this.socialMedia.formatTrendingForVoice(trending, 1);
                    break;

                case 'search_tweets':
                    response = "What would you like me to search for on Twitter?";
                    break;

                default:
                    response = "I can check Twitter for you. Try asking about Elon Musk or Donald Trump's latest tweets.";
            }

            // Add to conversation history
            this.conversationHistory.push({
                role: 'user',
                content: userMessage,
                timestamp: new Date().toISOString()
            });

            this.conversationHistory.push({
                role: 'assistant',
                content: response,
                timestamp: new Date().toISOString()
            });

            return {
                response: response,
                intent: 'twitter',
                actions: [{ type: 'twitter', action: 'fetch_tweets', data: tweetData }],
                context: this.carContext
            };

        } catch (error) {
            console.error('Twitter query failed:', error.message);
            
            return {
                response: "Sorry, I couldn't fetch the Twitter information right now. Please try again later.",
                intent: 'twitter_error',
                actions: [],
                context: this.carContext
            };
        }
    }

    // Handle emergency situations
    handleEmergency(emergencyType) {
        switch (emergencyType) {
            case 'accident':
                return {
                    response: "Emergency detected. Calling emergency services and sending location.",
                    actions: [
                        { type: 'phone', action: 'emergency_call', number: '911' },
                        { type: 'location', action: 'send_coordinates' }
                    ],
                    priority: 'critical'
                };
            case 'medical':
                return {
                    response: "Medical emergency detected. Calling for help immediately.",
                    actions: [
                        { type: 'phone', action: 'emergency_call', number: '911' },
                        { type: 'navigation', action: 'find_hospital' }
                    ],
                    priority: 'critical'
                };
            default:
                return {
                    response: "Emergency assistance activated. How can I help?",
                    actions: [{ type: 'emergency', action: 'standby' }],
                    priority: 'high'
                };
        }
    }
}

module.exports = ConversationHandler;