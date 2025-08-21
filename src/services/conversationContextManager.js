const EventEmitter = require('events');

/**
 * Conversation Context Manager
 * 
 * Manages sophisticated conversation context including:
 * - Multi-turn conversation memory
 * - Trip context and journey awareness
 * - Driving situation context
 * - User preferences and patterns
 * - Emotional and interaction context
 */
class ConversationContextManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxMemoryItems: options.maxMemoryItems || 100,
            contextDecayTime: options.contextDecayTime || 30 * 60 * 1000, // 30 minutes
            tripMemoryTime: options.tripMemoryTime || 24 * 60 * 60 * 1000, // 24 hours
            importanceThreshold: options.importanceThreshold || 0.7,
            ...options
        };

        // Memory systems
        this.conversationMemory = new Map(); // Recent conversation context
        this.tripMemory = new Map(); // Trip-specific context
        this.userPreferences = new Map(); // Long-term user preferences
        this.entityMemory = new Map(); // Remembered entities (people, places, etc.)
        
        // Current context state
        this.currentContext = {
            conversation: {
                id: null,
                turns: [],
                topics: [],
                mood: 'neutral',
                urgency: 'normal'
            },
            trip: {
                id: null,
                startTime: null,
                origin: null,
                destination: null,
                waypoints: [],
                purpose: null, // work, home, leisure, emergency
                estimatedDuration: null
            },
            driving: {
                isMoving: false,
                speed: 0,
                location: null,
                heading: null,
                trafficCondition: 'unknown',
                timeOfDay: 'day',
                weatherCondition: 'clear'
            },
            user: {
                alertnessLevel: 'normal', // tired, normal, alert
                stressLevel: 'low', // low, medium, high
                communicationStyle: 'casual', // formal, casual, brief
                preferredResponseLength: 'medium' // short, medium, long
            },
            car: {
                fuelLevel: null,
                batteryLevel: null,
                maintenanceAlerts: [],
                climate: {
                    temperature: null,
                    mode: null
                }
            }
        };

        // Context analytics
        this.analytics = {
            totalConversations: 0,
            averageConversationLength: 0,
            commonTopics: new Map(),
            preferredFeatures: new Map(),
            peakUsageHours: new Map()
        };

        console.log('🧠 Conversation Context Manager initialized');
    }

    /**
     * Start a new conversation context
     */
    startConversation(initialContext = {}) {
        const conversationId = this.generateContextId('conv');
        
        this.currentContext.conversation = {
            id: conversationId,
            turns: [],
            topics: [],
            mood: initialContext.mood || 'neutral',
            urgency: initialContext.urgency || 'normal',
            startTime: Date.now()
        };

        // Update analytics
        this.analytics.totalConversations++;
        
        this.emit('conversationStarted', {
            id: conversationId,
            context: this.currentContext.conversation
        });

        console.log(`💭 Started conversation context: ${conversationId}`);
        return conversationId;
    }

    /**
     * Start a new trip context
     */
    startTrip(tripData = {}) {
        const tripId = this.generateContextId('trip');
        
        this.currentContext.trip = {
            id: tripId,
            startTime: Date.now(),
            origin: tripData.origin || this.currentContext.driving.location,
            destination: tripData.destination || null,
            waypoints: tripData.waypoints || [],
            purpose: this.inferTripPurpose(tripData),
            estimatedDuration: tripData.estimatedDuration || null,
            routePreference: tripData.routePreference || 'fastest'
        };

        // Store in trip memory
        this.tripMemory.set(tripId, {
            ...this.currentContext.trip,
            conversations: [],
            events: [],
            preferences: {}
        });

        this.emit('tripStarted', {
            id: tripId,
            context: this.currentContext.trip
        });

        console.log(`🗺️ Started trip context: ${tripId} to ${tripData.destination || 'unknown'}`);
        return tripId;
    }

    /**
     * Add conversation turn to context
     */
    addConversationTurn(userInput, assistantResponse, metadata = {}) {
        const turn = {
            id: this.generateTurnId(),
            timestamp: Date.now(),
            userInput: userInput,
            assistantResponse: assistantResponse,
            topics: this.extractTopics(userInput),
            entities: this.extractEntities(userInput),
            sentiment: this.analyzeSentiment(userInput),
            intent: this.analyzeIntent(userInput),
            importance: this.calculateImportance(userInput, metadata),
            metadata: metadata
        };

        // Add to current conversation
        this.currentContext.conversation.turns.push(turn);
        
        // Update conversation topics
        turn.topics.forEach(topic => {
            if (!this.currentContext.conversation.topics.includes(topic)) {
                this.currentContext.conversation.topics.push(topic);
            }
        });

        // Store important turns in memory
        if (turn.importance >= this.options.importanceThreshold) {
            this.storeInMemory('conversation', turn);
        }

        // Update entities in memory
        this.updateEntityMemory(turn.entities);

        // Update user preferences based on interaction
        this.updateUserPreferences(turn);

        // Maintain conversation length
        if (this.currentContext.conversation.turns.length > 20) {
            this.currentContext.conversation.turns = 
                this.currentContext.conversation.turns.slice(-15);
        }

        this.emit('turnAdded', turn);
        return turn;
    }

    /**
     * Update driving context
     */
    updateDrivingContext(drivingData) {
        const previousContext = { ...this.currentContext.driving };
        
        this.currentContext.driving = {
            ...this.currentContext.driving,
            ...drivingData,
            lastUpdate: Date.now()
        };

        // Detect context changes that might affect conversation
        if (this.detectSignificantDrivingChange(previousContext, this.currentContext.driving)) {
            this.emit('drivingContextChanged', {
                previous: previousContext,
                current: this.currentContext.driving,
                significance: this.calculateChangeSignificance(previousContext, this.currentContext.driving)
            });
        }

        // Update trip context if in trip
        if (this.currentContext.trip.id) {
            const tripData = this.tripMemory.get(this.currentContext.trip.id);
            if (tripData) {
                tripData.events.push({
                    type: 'driving_update',
                    timestamp: Date.now(),
                    data: drivingData
                });
            }
        }
    }

    /**
     * Update user context
     */
    updateUserContext(userData) {
        this.currentContext.user = {
            ...this.currentContext.user,
            ...userData,
            lastUpdate: Date.now()
        };

        this.emit('userContextChanged', this.currentContext.user);
    }

    /**
     * Get relevant context for AI response generation
     */
    getRelevantContext(query, maxItems = 5) {
        const relevantContext = {
            currentConversation: this.getCurrentConversationContext(),
            recentMemory: this.getRelevantMemory(query, maxItems),
            tripContext: this.getCurrentTripContext(),
            drivingContext: this.getCurrentDrivingContext(),
            userContext: this.getCurrentUserContext(),
            relevantEntities: this.getRelevantEntities(query),
            preferences: this.getRelevantPreferences(query)
        };

        return relevantContext;
    }

    /**
     * Get current conversation context
     */
    getCurrentConversationContext() {
        const recentTurns = this.currentContext.conversation.turns.slice(-3);
        
        return {
            id: this.currentContext.conversation.id,
            currentTopics: this.currentContext.conversation.topics,
            mood: this.currentContext.conversation.mood,
            urgency: this.currentContext.conversation.urgency,
            recentTurns: recentTurns.map(turn => ({
                userInput: turn.userInput,
                assistantResponse: turn.assistantResponse,
                topics: turn.topics,
                timestamp: turn.timestamp
            })),
            duration: this.currentContext.conversation.startTime ? 
                Date.now() - this.currentContext.conversation.startTime : 0
        };
    }

    /**
     * Get current trip context
     */
    getCurrentTripContext() {
        if (!this.currentContext.trip.id) {
            return null;
        }

        return {
            id: this.currentContext.trip.id,
            origin: this.currentContext.trip.origin,
            destination: this.currentContext.trip.destination,
            purpose: this.currentContext.trip.purpose,
            progress: this.calculateTripProgress(),
            estimatedTimeRemaining: this.estimateTimeRemaining(),
            waypoints: this.currentContext.trip.waypoints
        };
    }

    /**
     * Get current driving context
     */
    getCurrentDrivingContext() {
        return {
            isMoving: this.currentContext.driving.isMoving,
            speed: this.currentContext.driving.speed,
            location: this.currentContext.driving.location,
            trafficCondition: this.currentContext.driving.trafficCondition,
            timeOfDay: this.currentContext.driving.timeOfDay,
            weatherCondition: this.currentContext.driving.weatherCondition,
            safetyLevel: this.calculateSafetyLevel()
        };
    }

    /**
     * Get current user context
     */
    getCurrentUserContext() {
        return {
            alertnessLevel: this.currentContext.user.alertnessLevel,
            stressLevel: this.currentContext.user.stressLevel,
            communicationStyle: this.currentContext.user.communicationStyle,
            preferredResponseLength: this.currentContext.user.preferredResponseLength,
            adaptationNeeded: this.shouldAdaptResponse()
        };
    }

    /**
     * Get relevant memory items
     */
    getRelevantMemory(query, maxItems = 5) {
        const relevantItems = [];
        const queryTokens = this.tokenize(query.toLowerCase());
        
        // Search conversation memory
        for (const [key, item] of this.conversationMemory.entries()) {
            const relevanceScore = this.calculateRelevanceScore(queryTokens, item);
            if (relevanceScore > 0.3) {
                relevantItems.push({
                    ...item,
                    relevanceScore: relevanceScore,
                    type: 'conversation'
                });
            }
        }

        // Search trip memory for current and recent trips
        for (const [tripId, trip] of this.tripMemory.entries()) {
            if (Date.now() - trip.startTime < this.options.tripMemoryTime) {
                const relevanceScore = this.calculateTripRelevanceScore(queryTokens, trip);
                if (relevanceScore > 0.3) {
                    relevantItems.push({
                        trip: trip,
                        relevanceScore: relevanceScore,
                        type: 'trip'
                    });
                }
            }
        }

        // Sort by relevance and recency
        relevantItems.sort((a, b) => {
            const scoreA = a.relevanceScore * (1 + this.getRecencyBoost(a.timestamp));
            const scoreB = b.relevanceScore * (1 + this.getRecencyBoost(b.timestamp));
            return scoreB - scoreA;
        });

        return relevantItems.slice(0, maxItems);
    }

    /**
     * Get relevant entities for query
     */
    getRelevantEntities(query) {
        const relevantEntities = {};
        const queryTokens = this.tokenize(query.toLowerCase());
        
        for (const [entity, data] of this.entityMemory.entries()) {
            if (queryTokens.some(token => entity.toLowerCase().includes(token) || 
                data.aliases?.some(alias => alias.toLowerCase().includes(token)))) {
                relevantEntities[entity] = data;
            }
        }
        
        return relevantEntities;
    }

    /**
     * Get relevant user preferences
     */
    getRelevantPreferences(query) {
        const preferences = {};
        const queryContext = this.analyzeQueryContext(query);
        
        // Get preferences relevant to the query context
        for (const [key, value] of this.userPreferences.entries()) {
            if (this.isPreferenceRelevant(key, queryContext)) {
                preferences[key] = value;
            }
        }
        
        return preferences;
    }

    /**
     * Store important information in memory
     */
    storeInMemory(type, data) {
        const memoryKey = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const memoryItem = {
            id: memoryKey,
            type: type,
            data: data,
            timestamp: Date.now(),
            importance: data.importance || 0.5,
            accessCount: 0,
            lastAccessed: Date.now()
        };

        this.conversationMemory.set(memoryKey, memoryItem);
        
        // Cleanup old memory if necessary
        this.cleanupMemory();
        
        this.emit('memoryStored', memoryItem);
    }

    /**
     * Update entity memory
     */
    updateEntityMemory(entities) {
        if (!entities || typeof entities !== 'object') return;
        
        for (const [entityType, entityList] of Object.entries(entities)) {
            if (Array.isArray(entityList)) {
                entityList.forEach(entity => {
                    if (!this.entityMemory.has(entity)) {
                        this.entityMemory.set(entity, {
                            type: entityType,
                            mentions: 1,
                            firstMentioned: Date.now(),
                            lastMentioned: Date.now(),
                            contexts: []
                        });
                    } else {
                        const entityData = this.entityMemory.get(entity);
                        entityData.mentions++;
                        entityData.lastMentioned = Date.now();
                    }
                });
            }
        }
    }

    /**
     * Update user preferences based on interaction
     */
    updateUserPreferences(turn) {
        // Analyze response length preference
        if (turn.assistantResponse) {
            const responseLength = turn.assistantResponse.length;
            const currentLengthPref = this.userPreferences.get('responseLength') || { short: 0, medium: 0, long: 0 };
            
            if (responseLength < 50) {
                currentLengthPref.short++;
            } else if (responseLength < 150) {
                currentLengthPref.medium++;
            } else {
                currentLengthPref.long++;
            }
            
            this.userPreferences.set('responseLength', currentLengthPref);
        }

        // Analyze topic preferences
        turn.topics.forEach(topic => {
            const currentTopicScore = this.userPreferences.get(`topic_${topic}`) || 0;
            this.userPreferences.set(`topic_${topic}`, currentTopicScore + 1);
        });

        // Analyze timing preferences
        const hour = new Date().getHours();
        const timeSlot = this.getTimeSlot(hour);
        const currentTimeScore = this.userPreferences.get(`active_time_${timeSlot}`) || 0;
        this.userPreferences.set(`active_time_${timeSlot}`, currentTimeScore + 1);
    }

    /**
     * Infer trip purpose from data
     */
    inferTripPurpose(tripData) {
        if (!tripData.destination) return 'unknown';
        
        const destination = tripData.destination.toLowerCase();
        const hour = new Date().getHours();
        
        // Rule-based inference
        if (destination.includes('home') || destination.includes('house')) {
            return 'home';
        }
        
        if (destination.includes('work') || destination.includes('office') || 
            (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
            return 'work';
        }
        
        if (destination.includes('hospital') || destination.includes('emergency')) {
            return 'emergency';
        }
        
        if (hour >= 19 || hour <= 2 || destination.includes('restaurant') || 
            destination.includes('bar') || destination.includes('club')) {
            return 'leisure';
        }
        
        return 'general';
    }

    /**
     * Calculate trip progress
     */
    calculateTripProgress() {
        if (!this.currentContext.trip.id || !this.currentContext.trip.estimatedDuration) {
            return 0;
        }
        
        const elapsed = Date.now() - this.currentContext.trip.startTime;
        const progress = elapsed / this.currentContext.trip.estimatedDuration;
        return Math.min(1, Math.max(0, progress));
    }

    /**
     * Estimate time remaining in trip
     */
    estimateTimeRemaining() {
        if (!this.currentContext.trip.id || !this.currentContext.trip.estimatedDuration) {
            return null;
        }
        
        const elapsed = Date.now() - this.currentContext.trip.startTime;
        const remaining = this.currentContext.trip.estimatedDuration - elapsed;
        return Math.max(0, remaining);
    }

    /**
     * Calculate safety level for current driving context
     */
    calculateSafetyLevel() {
        let safetyScore = 1.0; // Start with perfect safety
        
        // Reduce safety based on speed
        if (this.currentContext.driving.speed > 80) {
            safetyScore -= 0.3;
        } else if (this.currentContext.driving.speed > 50) {
            safetyScore -= 0.1;
        }
        
        // Reduce safety based on traffic
        if (this.currentContext.driving.trafficCondition === 'heavy') {
            safetyScore -= 0.2;
        }
        
        // Reduce safety based on weather
        if (this.currentContext.driving.weatherCondition === 'rain' || 
            this.currentContext.driving.weatherCondition === 'snow') {
            safetyScore -= 0.2;
        }
        
        // Reduce safety based on time of day
        if (this.currentContext.driving.timeOfDay === 'night') {
            safetyScore -= 0.1;
        }
        
        return Math.max(0, Math.min(1, safetyScore));
    }

    /**
     * Determine if response adaptation is needed
     */
    shouldAdaptResponse() {
        const adaptationFactors = [];
        
        // High stress or low alertness
        if (this.currentContext.user.stressLevel === 'high' || 
            this.currentContext.user.alertnessLevel === 'tired') {
            adaptationFactors.push('simplified_responses');
        }
        
        // Poor driving conditions
        if (this.calculateSafetyLevel() < 0.7) {
            adaptationFactors.push('safety_priority');
        }
        
        // High urgency
        if (this.currentContext.conversation.urgency === 'high') {
            adaptationFactors.push('brevity_priority');
        }
        
        return adaptationFactors;
    }

    /**
     * Helper methods
     */
    generateContextId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateTurnId() {
        return `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    tokenize(text) {
        return text.toLowerCase().split(/\s+/).filter(token => token.length > 2);
    }

    extractTopics(text) {
        const topicKeywords = {
            'navigation': ['navigate', 'directions', 'route', 'traffic', 'map'],
            'music': ['play', 'music', 'song', 'album', 'artist', 'spotify'],
            'communication': ['call', 'phone', 'message', 'text', 'contact'],
            'weather': ['weather', 'temperature', 'rain', 'snow', 'forecast'],
            'news': ['news', 'happening', 'current', 'events', 'updates'],
            'social': ['twitter', 'tweet', 'facebook', 'instagram', 'social']
        };
        
        const topics = [];
        const lowerText = text.toLowerCase();
        
        for (const [topic, keywords] of Object.entries(topicKeywords)) {
            if (keywords.some(keyword => lowerText.includes(keyword))) {
                topics.push(topic);
            }
        }
        
        return topics;
    }

    extractEntities(text) {
        const entities = {};
        
        // Extract people (simple pattern matching)
        const peoplePattern = /(?:call|contact|message)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
        const peopleMatches = [...text.matchAll(peoplePattern)];
        if (peopleMatches.length > 0) {
            entities.people = peopleMatches.map(match => match[1]);
        }
        
        // Extract locations
        const locationPattern = /(?:to|in|at|near)\s+([A-Z][a-zA-Z\s]+?)(?:\s|$|,)/g;
        const locationMatches = [...text.matchAll(locationPattern)];
        if (locationMatches.length > 0) {
            entities.locations = locationMatches.map(match => match[1].trim());
        }
        
        return entities;
    }

    analyzeSentiment(text) {
        const positiveWords = ['good', 'great', 'excellent', 'love', 'like', 'awesome', 'perfect'];
        const negativeWords = ['bad', 'terrible', 'hate', 'dislike', 'awful', 'horrible', 'wrong'];
        
        const lowerText = text.toLowerCase();
        const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
        const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
        
        if (positiveCount > negativeCount) return 'positive';
        if (negativeCount > positiveCount) return 'negative';
        return 'neutral';
    }

    analyzeIntent(text) {
        const intentPatterns = {
            'question': /\b(what|how|why|when|where|who)\b.*\?/i,
            'request': /\b(please|can you|could you|would you)\b/i,
            'command': /^(play|stop|call|navigate|set|turn)/i,
            'search': /\b(find|search|look up|tell me about)\b/i
        };
        
        for (const [intent, pattern] of Object.entries(intentPatterns)) {
            if (pattern.test(text)) {
                return intent;
            }
        }
        
        return 'statement';
    }

    calculateImportance(text, metadata) {
        let importance = 0.5; // Base importance
        
        // Emergency keywords
        if (/emergency|urgent|help|accident/i.test(text)) {
            importance = 1.0;
        }
        
        // User preferences or personal information
        if (/prefer|like|don't like|always|never/i.test(text)) {
            importance += 0.3;
        }
        
        // Location or destination information
        if (/home|work|office|address/i.test(text)) {
            importance += 0.2;
        }
        
        // Metadata indicators
        if (metadata.userInitiated) importance += 0.1;
        if (metadata.longResponse) importance += 0.1;
        
        return Math.min(1.0, importance);
    }

    calculateRelevanceScore(queryTokens, memoryItem) {
        if (!memoryItem.data || !memoryItem.data.userInput) return 0;
        
        const itemTokens = this.tokenize(memoryItem.data.userInput);
        const commonTokens = queryTokens.filter(token => itemTokens.includes(token));
        
        let relevanceScore = commonTokens.length / Math.max(queryTokens.length, itemTokens.length);
        
        // Boost for importance
        relevanceScore *= (1 + memoryItem.importance);
        
        // Boost for recent access
        const hoursSinceAccess = (Date.now() - memoryItem.lastAccessed) / (1000 * 60 * 60);
        if (hoursSinceAccess < 1) relevanceScore *= 1.5;
        
        return relevanceScore;
    }

    getRecencyBoost(timestamp) {
        const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
        return Math.max(0, 1 - ageHours / 24); // Boost decreases over 24 hours
    }

    getTimeSlot(hour) {
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 21) return 'evening';
        return 'night';
    }

    detectSignificantDrivingChange(previous, current) {
        // Speed change > 20 km/h
        if (Math.abs(current.speed - previous.speed) > 20) return true;
        
        // Movement state change
        if (current.isMoving !== previous.isMoving) return true;
        
        // Traffic condition change
        if (current.trafficCondition !== previous.trafficCondition) return true;
        
        return false;
    }

    calculateChangeSignificance(previous, current) {
        let significance = 0;
        
        if (Math.abs(current.speed - previous.speed) > 30) significance += 0.5;
        if (current.isMoving !== previous.isMoving) significance += 0.3;
        if (current.trafficCondition !== previous.trafficCondition) significance += 0.2;
        
        return Math.min(1.0, significance);
    }

    cleanupMemory() {
        if (this.conversationMemory.size <= this.options.maxMemoryItems) return;
        
        // Convert to array and sort by importance and recency
        const memoryItems = Array.from(this.conversationMemory.entries())
            .map(([key, item]) => ({ key, ...item }))
            .sort((a, b) => {
                const scoreA = a.importance * (1 + this.getRecencyBoost(a.timestamp));
                const scoreB = b.importance * (1 + this.getRecencyBoost(b.timestamp));
                return scoreB - scoreA;
            });
        
        // Keep only the top items
        const itemsToKeep = memoryItems.slice(0, this.options.maxMemoryItems);
        const itemsToRemove = memoryItems.slice(this.options.maxMemoryItems);
        
        // Clear memory and re-add important items
        this.conversationMemory.clear();
        itemsToKeep.forEach(item => {
            const { key, ...itemData } = item;
            this.conversationMemory.set(key, itemData);
        });
        
        console.log(`🧠 Memory cleanup: kept ${itemsToKeep.length}, removed ${itemsToRemove.length} items`);
    }

    /**
     * Get context statistics
     */
    getContextStats() {
        return {
            conversation: {
                id: this.currentContext.conversation.id,
                turns: this.currentContext.conversation.turns.length,
                topics: this.currentContext.conversation.topics.length,
                duration: this.currentContext.conversation.startTime ? 
                    Date.now() - this.currentContext.conversation.startTime : 0
            },
            trip: this.currentContext.trip.id ? {
                id: this.currentContext.trip.id,
                progress: this.calculateTripProgress(),
                timeRemaining: this.estimateTimeRemaining()
            } : null,
            memory: {
                conversationItems: this.conversationMemory.size,
                tripItems: this.tripMemory.size,
                entities: this.entityMemory.size,
                preferences: this.userPreferences.size
            },
            driving: {
                safetyLevel: this.calculateSafetyLevel(),
                adaptationNeeded: this.shouldAdaptResponse().length > 0
            }
        };
    }

    /**
     * Clear expired memory items
     */
    clearExpiredMemory() {
        const now = Date.now();
        
        // Clear old conversation memory
        for (const [key, item] of this.conversationMemory.entries()) {
            if (now - item.timestamp > this.options.contextDecayTime) {
                this.conversationMemory.delete(key);
            }
        }
        
        // Clear old trip memory
        for (const [key, trip] of this.tripMemory.entries()) {
            if (now - trip.startTime > this.options.tripMemoryTime) {
                this.tripMemory.delete(key);
            }
        }
        
        console.log('🧠 Expired memory items cleared');
    }

    /**
     * Export context for analysis or backup
     */
    exportContext() {
        return {
            currentContext: this.currentContext,
            memoryStats: {
                conversationMemory: this.conversationMemory.size,
                tripMemory: this.tripMemory.size,
                entityMemory: this.entityMemory.size,
                userPreferences: this.userPreferences.size
            },
            analytics: this.analytics,
            timestamp: Date.now()
        };
    }

    /**
     * Destroy context manager
     */
    destroy() {
        this.conversationMemory.clear();
        this.tripMemory.clear();
        this.userPreferences.clear();
        this.entityMemory.clear();
        this.removeAllListeners();
        console.log('🗑️ Conversation Context Manager destroyed');
    }
}

module.exports = ConversationContextManager;