const EventEmitter = require('events');

class ConversationFlowService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxContextLength: options.maxContextLength || 10,
            interruptionTimeout: options.interruptionTimeout || 2000,
            continuationTimeout: options.continuationTimeout || 5000,
            maxRetries: options.maxRetries || 3,
            enableContextAwareness: options.enableContextAwareness ?? true,
            enableEmotionalContext: options.enableEmotionalContext ?? true,
            ...options
        };
        
        this.conversationState = {
            isActive: false,
            isSpeaking: false,
            isListening: false,
            isProcessing: false,
            isInterrupted: false,
            currentTurn: 0,
            lastActivity: Date.now(),
            context: [],
            pendingResponse: null,
            interruptionLevel: 0
        };
        
        this.interruptions = [];
        this.timers = new Map();
        this.responseQueue = [];
        this.contextMemory = new Map();
        
        // Conversation patterns and flow management
        this.conversationPatterns = {
            greeting: {
                triggers: ['hello', 'hi', 'hey', 'good morning', 'good afternoon'],
                responses: ['Hello! How can I help you today?', 'Hi there! What can I do for you?'],
                followUp: true
            },
            clarification: {
                triggers: ['what', 'how', 'why', 'explain', 'clarify'],
                requiresContext: true,
                priority: 'high'
            },
            emergency: {
                triggers: ['emergency', 'help', 'urgent', 'accident', '911'],
                priority: 'critical',
                interruptAll: true
            },
            navigation: {
                triggers: ['navigate', 'directions', 'route'],
                contextual: true,
                allowsInterruption: false
            }
        };
        
        this.emotionalContext = {
            user: { mood: 'neutral', stress: 0, engagement: 0.5 },
            conversation: { tone: 'helpful', urgency: 'normal', complexity: 'medium' }
        };
    }
    
    startConversation(initialContext = {}) {
        this.conversationState.isActive = true;
        this.conversationState.currentTurn = 0;
        this.conversationState.lastActivity = Date.now();
        
        if (initialContext.context) {
            this.conversationState.context = [...initialContext.context];
        }
        
        this.emit('conversationStarted', {
            timestamp: Date.now(),
            context: this.conversationState.context
        });
        
        console.log('💬 Conversation started');
    }
    
    endConversation(reason = 'normal') {
        this.clearAllTimers();
        
        const summary = this.generateConversationSummary();
        
        this.conversationState.isActive = false;
        this.conversationState.isListening = false;
        this.conversationState.isSpeaking = false;
        this.conversationState.isProcessing = false;
        
        this.emit('conversationEnded', {
            reason,
            summary,
            duration: Date.now() - this.conversationState.lastActivity,
            turns: this.conversationState.currentTurn
        });
        
        console.log(`💬 Conversation ended: ${reason}`);
    }
    
    processUserInput(input, audioMetadata = {}) {
        if (!this.conversationState.isActive) {
            this.startConversation();
        }
        
        const turn = {
            id: this.generateTurnId(),
            timestamp: Date.now(),
            type: 'user',
            content: input,
            metadata: audioMetadata,
            context: this.getCurrentContext(),
            emotionalContext: this.analyzeEmotionalContext(input, audioMetadata)
        };
        
        // Check for interruption
        if (this.conversationState.isSpeaking) {
            return this.handleInterruption(turn);
        }
        
        // Update conversation state
        this.conversationState.isListening = false;
        this.conversationState.isProcessing = true;
        this.conversationState.currentTurn++;
        
        // Add to context
        this.addToContext(turn);
        
        // Analyze intent and priority
        const analysis = this.analyzeInput(input);
        turn.analysis = analysis;
        
        this.emit('userInput', turn);
        
        // Process the input
        return this.processInputWithFlow(turn);
    }
    
    generateTurnId() {
        return `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    analyzeEmotionalContext(input, audioMetadata) {
        const emotional = {
            valence: 0, // -1 (negative) to 1 (positive)
            arousal: 0, // 0 (calm) to 1 (excited)
            urgency: 0  // 0 (relaxed) to 1 (urgent)
        };
        
        const positiveWords = ['good', 'great', 'excellent', 'perfect', 'thanks'];
        const negativeWords = ['bad', 'terrible', 'wrong', 'problem', 'error'];
        const urgentWords = ['urgent', 'quickly', 'immediately', 'emergency', 'now'];
        
        const lowercaseInput = input.toLowerCase();
        
        // Analyze valence
        const positiveCount = positiveWords.filter(word => lowercaseInput.includes(word)).length;
        const negativeCount = negativeWords.filter(word => lowercaseInput.includes(word)).length;
        emotional.valence = (positiveCount - negativeCount) * 0.3;
        
        // Analyze urgency
        const urgentCount = urgentWords.filter(word => lowercaseInput.includes(word)).length;
        emotional.urgency = Math.min(1.0, urgentCount * 0.4);
        
        // Use audio metadata if available
        if (audioMetadata.volume) {
            emotional.arousal = Math.min(1.0, audioMetadata.volume * 0.8);
        }
        
        if (audioMetadata.speechRate) {
            emotional.urgency += Math.min(0.5, audioMetadata.speechRate * 0.3);
        }
        
        return emotional;
    }
    
    getCurrentContext() {
        return {
            state: { ...this.conversationState },
            recentTurns: this.conversationState.context.slice(-3),
            emotionalContext: { ...this.emotionalContext }
        };
    }
    
    handleInterruption(newTurn) {
        const interruptionData = {
            id: this.generateInterruptionId(),
            timestamp: Date.now(),
            originalResponse: this.conversationState.pendingResponse,
            newInput: newTurn,
            level: this.calculateInterruptionLevel(newTurn)
        };
        
        this.interruptions.push(interruptionData);
        this.conversationState.isInterrupted = true;
        this.conversationState.interruptionLevel = interruptionData.level;
        
        console.log(`🚫 Interruption detected (level: ${interruptionData.level})`);
        
        // Decide how to handle the interruption
        switch (interruptionData.level) {
            case 'critical':
                return this.handleCriticalInterruption(interruptionData);
            case 'high':
                return this.handleHighPriorityInterruption(interruptionData);
            case 'medium':
                return this.handleMediumPriorityInterruption(interruptionData);
            case 'low':
            default:
                return this.handleLowPriorityInterruption(interruptionData);
        }
    }
    
    generateInterruptionId() {
        return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    calculateInterruptionLevel(turn) {
        if (turn.analysis?.priority === 'critical') return 'critical';
        if (turn.analysis?.priority === 'high') return 'high';
        
        const urgentKeywords = ['stop', 'wait', 'no', 'cancel', 'emergency'];
        const hasUrgentKeywords = urgentKeywords.some(keyword => 
            turn.content.toLowerCase().includes(keyword)
        );
        
        if (hasUrgentKeywords) return 'high';
        
        // Analyze audio intensity if available
        if (turn.metadata?.volume > 0.8) return 'medium';
        if (turn.metadata?.intensity > 0.7) return 'medium';
        
        return 'low';
    }
    
    handleCriticalInterruption(interruptionData) {
        // Stop everything and handle immediately
        this.stopCurrentResponse();
        this.conversationState.isSpeaking = false;
        
        this.emit('criticalInterruption', interruptionData);
        
        return this.processInputWithFlow(interruptionData.newInput);
    }
    
    handleHighPriorityInterruption(interruptionData) {
        // Pause current response and acknowledge
        this.pauseCurrentResponse();
        
        const acknowledgment = this.generateInterruptionAcknowledgment(interruptionData);
        
        this.emit('highPriorityInterruption', {
            ...interruptionData,
            acknowledgment
        });
        
        // Queue the new input for immediate processing
        return this.processInputWithFlow(interruptionData.newInput);
    }
    
    handleMediumPriorityInterruption(interruptionData) {
        // Finish current sentence if speaking, then address interruption
        if (this.conversationState.isSpeaking) {
            this.scheduleInterruptionHandling(interruptionData, 3000);
            return { queued: true, priority: 'medium' };
        }
        
        return this.processInputWithFlow(interruptionData.newInput);
    }
    
    handleLowPriorityInterruption(interruptionData) {
        // Queue for later or ignore if not important
        this.responseQueue.push(interruptionData.newInput);
        
        this.emit('lowPriorityInterruption', interruptionData);
        
        return { queued: true, priority: 'low' };
    }
    
    addToContext(turn) {
        this.conversationState.context.push(turn);
        
        // Maintain context length
        if (this.conversationState.context.length > this.options.maxContextLength) {
            this.conversationState.context.shift();
        }
        
        // Store in long-term memory if important
        if (turn.analysis?.priority === 'high' || turn.analysis?.priority === 'critical') {
            this.storeInMemory(turn);
        }
    }
    
    storeInMemory(turn) {
        const memoryKey = turn.analysis?.pattern || turn.analysis?.intent || 'general';
        
        if (!this.contextMemory.has(memoryKey)) {
            this.contextMemory.set(memoryKey, []);
        }
        
        this.contextMemory.get(memoryKey).push({
            turn: turn,
            importance: this.calculateImportance(turn),
            timestamp: Date.now()
        });
    }
    
    calculateImportance(turn) {
        let importance = 0.5;
        
        if (turn.analysis?.priority === 'critical') importance = 1.0;
        else if (turn.analysis?.priority === 'high') importance = 0.8;
        else if (turn.analysis?.priority === 'normal') importance = 0.6;
        
        if (turn.analysis?.confidence > 0.8) importance += 0.1;
        if (turn.emotionalContext?.urgency > 0.7) importance += 0.1;
        
        return Math.min(1.0, importance);
    }
    
    analyzeInput(text) {
        const lowercaseText = text.toLowerCase();
        
        // Pattern matching
        let matchedPattern = null;
        let priority = 'normal';
        
        for (const [patternName, pattern] of Object.entries(this.conversationPatterns)) {
            if (pattern.triggers.some(trigger => lowercaseText.includes(trigger))) {
                matchedPattern = patternName;
                priority = pattern.priority || 'normal';
                break;
            }
        }
        
        // Intent analysis
        const intent = this.extractIntent(text);
        
        // Context requirements
        const requiresContext = matchedPattern && 
            this.conversationPatterns[matchedPattern].requiresContext;
        
        return {
            pattern: matchedPattern,
            intent: intent,
            priority: priority,
            requiresContext: requiresContext,
            confidence: this.calculateConfidence(text, matchedPattern)
        };
    }
    
    extractIntent(input) {
        const intents = {
            question: ['what', 'how', 'why', 'when', 'where', 'who', '?'],
            command: ['play', 'stop', 'start', 'open', 'close', 'navigate'],
            request: ['please', 'can you', 'could you', 'would you'],
            information: ['tell me', 'show me', 'explain', 'describe'],
            confirmation: ['yes', 'yeah', 'ok', 'correct', 'right'],
            negation: ['no', 'nope', 'wrong', 'incorrect', 'cancel']
        };
        
        const lowercaseInput = input.toLowerCase();
        
        for (const [intentType, keywords] of Object.entries(intents)) {
            if (keywords.some(keyword => lowercaseInput.includes(keyword))) {
                return intentType;
            }
        }
        
        return 'unknown';
    }
    
    calculateConfidence(input, matchedPattern) {
        let confidence = 0.5; // Base confidence
        
        if (matchedPattern) confidence += 0.3;
        if (input.length > 10) confidence += 0.1;
        if (input.includes('?')) confidence += 0.1;
        
        return Math.min(1.0, confidence);
    }
    
    async processInputWithFlow(turn) {
        try {
            // Set processing state
            this.conversationState.isProcessing = true;
            this.updateLastActivity();
            
            // Check if we need context from previous turns
            if (turn.analysis?.requiresContext) {
                turn.context = this.getRelevantContext(turn);
            }
            
            // Generate response based on conversation flow
            const response = await this.generateContextualResponse(turn);
            
            // Create response turn
            const responseTurn = {
                id: this.generateTurnId(),
                timestamp: Date.now(),
                type: 'assistant',
                content: response.content,
                metadata: response.metadata || {},
                inResponseTo: turn.id,
                context: turn.context
            };
            
            this.addToContext(responseTurn);
            
            // Update conversation state
            this.conversationState.isProcessing = false;
            this.conversationState.isSpeaking = true;
            this.conversationState.pendingResponse = responseTurn;
            
            // Set up continuation timer
            this.setupContinuationTimer();
            
            this.emit('assistantResponse', responseTurn);
            
            return responseTurn;
            
        } catch (error) {
            console.error('Error processing input:', error);
            
            this.conversationState.isProcessing = false;
            
            return {
                id: this.generateTurnId(),
                timestamp: Date.now(),
                type: 'assistant',
                content: "I'm sorry, I encountered an error. Could you please repeat that?",
                error: true
            };
        }
    }
    
    async generateContextualResponse(turn) {
        // This would integrate with the AI provider
        const contextMessages = this.buildContextMessages(turn);
        
        // Simulate AI response for now
        const response = {
            content: this.generateSimpleResponse(turn),
            metadata: {
                confidence: turn.analysis?.confidence || 0.7,
                responseTime: Date.now() - turn.timestamp,
                contextUsed: contextMessages.length > 1
            }
        };
        
        return response;
    }
    
    generateSimpleResponse(turn) {
        const intent = turn.analysis?.intent;
        const pattern = turn.analysis?.pattern;
        
        if (pattern === 'emergency') {
            return "Emergency services have been contacted. Help is on the way. Please stay calm.";
        }
        
        if (pattern === 'greeting') {
            return "Hello! I'm CarBot, your intelligent car assistant. How can I help you today?";
        }
        
        switch (intent) {
            case 'question':
                return "That's a great question. Let me help you with that.";
            case 'command':
                return "I'll take care of that for you right away.";
            case 'request':
                return "Of course! I'd be happy to help you with that.";
            default:
                return "I understand. How else can I assist you?";
        }
    }
    
    buildContextMessages(turn) {
        const messages = [{ role: 'system', content: 'You are CarBot, an intelligent car assistant.' }];
        
        // Add relevant context from conversation history
        const relevantContext = this.getRelevantContext(turn);
        
        for (const contextTurn of relevantContext) {
            messages.push({
                role: contextTurn.type === 'user' ? 'user' : 'assistant',
                content: contextTurn.content
            });
        }
        
        // Add current turn
        messages.push({
            role: 'user',
            content: turn.content
        });
        
        return messages;
    }
    
    getRelevantContext(turn, maxTurns = 5) {
        const recentContext = this.conversationState.context
            .slice(-maxTurns * 2) // Get recent turns (user + assistant pairs)
            .filter(contextTurn => {
                // Filter based on relevance
                if (turn.analysis?.pattern === contextTurn.analysis?.pattern) return true;
                if (turn.analysis?.intent === contextTurn.analysis?.intent) return true;
                if (Date.now() - contextTurn.timestamp < 30000) return true; // Recent
                return false;
            });
        
        return recentContext;
    }
    
    onResponseCompleted() {
        this.conversationState.isSpeaking = false;
        this.conversationState.isListening = true;
        this.conversationState.pendingResponse = null;
        
        // Process any queued responses
        if (this.responseQueue.length > 0) {
            const nextTurn = this.responseQueue.shift();
            setTimeout(() => this.processInputWithFlow(nextTurn), 500);
        }
        
        this.emit('responseCompleted');
    }
    
    setupContinuationTimer() {
        this.clearTimer('continuation');
        
        this.timers.set('continuation', setTimeout(() => {
            if (this.conversationState.isActive && !this.conversationState.isListening) {
                this.emit('conversationTimeout');
                this.endConversation('timeout');
            }
        }, this.options.continuationTimeout));
    }
    
    scheduleInterruptionHandling(interruptionData, delay) {
        this.clearTimer('interruption');
        
        this.timers.set('interruption', setTimeout(() => {
            this.processInputWithFlow(interruptionData.newInput);
        }, delay));
    }
    
    clearTimer(name) {
        if (this.timers.has(name)) {
            clearTimeout(this.timers.get(name));
            this.timers.delete(name);
        }
    }
    
    clearAllTimers() {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
    }
    
    generateInterruptionAcknowledgment(interruptionData) {
        const acknowledgments = [
            "I understand, let me address that.",
            "Got it, switching to your request.",
            "I hear you, let me help with that instead.",
            "Of course, let me handle that for you."
        ];
        
        return acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
    }
    
    updateLastActivity() {
        this.conversationState.lastActivity = Date.now();
    }
    
    generateConversationSummary() {
        return {
            duration: Date.now() - this.conversationState.lastActivity,
            totalTurns: this.conversationState.currentTurn,
            interruptions: this.interruptions.length,
            patterns: this.getUsedPatterns(),
            emotionalTone: this.getAverageEmotionalTone()
        };
    }
    
    getUsedPatterns() {
        const patterns = new Set();
        
        for (const turn of this.conversationState.context) {
            if (turn.analysis?.pattern) {
                patterns.add(turn.analysis.pattern);
            }
        }
        
        return Array.from(patterns);
    }
    
    getAverageEmotionalTone() {
        const emotionalTurns = this.conversationState.context
            .filter(turn => turn.emotionalContext);
        
        if (emotionalTurns.length === 0) return null;
        
        const avgValence = emotionalTurns.reduce((sum, turn) => 
            sum + turn.emotionalContext.valence, 0) / emotionalTurns.length;
        
        const avgArousal = emotionalTurns.reduce((sum, turn) => 
            sum + turn.emotionalContext.arousal, 0) / emotionalTurns.length;
        
        return { valence: avgValence, arousal: avgArousal };
    }
    
    getState() {
        return {
            ...this.conversationState,
            queuedResponses: this.responseQueue.length,
            activeTimers: this.timers.size,
            memoryEntries: this.contextMemory.size
        };
    }
    
    stopCurrentResponse() {
        this.conversationState.isSpeaking = false;
        this.conversationState.pendingResponse = null;
        this.emit('responseStopped');
    }
    
    pauseCurrentResponse() {
        this.emit('responsePaused');
    }
    
    destroy() {
        this.clearAllTimers();
        this.endConversation('destroyed');
        this.removeAllListeners();
        console.log('🗑️ Conversation flow service destroyed');
    }
}

module.exports = ConversationFlowService;