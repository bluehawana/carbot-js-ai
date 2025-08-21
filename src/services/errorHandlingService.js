const EventEmitter = require('events');

class ErrorHandlingService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            enableRecovery: options.enableRecovery !== false,
            maxRecoveryAttempts: options.maxRecoveryAttempts || 3,
            recoveryDelay: options.recoveryDelay || 1000,
            enableLogging: options.enableLogging !== false,
            logLevel: options.logLevel || 'error',
            enableMetrics: options.enableMetrics !== false,
            gracefulDegradation: options.gracefulDegradation !== false,
            ...options
        };
        
        // Error categories for different handling strategies
        this.errorCategories = {
            network: {
                patterns: [/network/i, /connection/i, /timeout/i, /ECONNRESET/i, /ENOTFOUND/i],
                recoverable: true,
                retryable: true,
                severity: 'medium'
            },
            api: {
                patterns: [/api/i, /401/i, /403/i, /429/i, /500/i, /502/i, /503/i],
                recoverable: true,
                retryable: true,
                severity: 'high'
            },
            audio: {
                patterns: [/audio/i, /microphone/i, /speaker/i, /recorder/i, /playback/i],
                recoverable: true,
                retryable: false,
                severity: 'high'
            },
            wakeword: {
                patterns: [/wake.?word/i, /porcupine/i, /picovoice/i, /detection/i],
                recoverable: true,
                retryable: false,
                severity: 'medium'
            },
            tts: {
                patterns: [/tts/i, /text.?to.?speech/i, /synthesis/i, /voice/i],
                recoverable: true,
                retryable: true,
                severity: 'medium'
            },
            system: {
                patterns: [/memory/i, /disk/i, /cpu/i, /resource/i, /permission/i],
                recoverable: false,
                retryable: false,
                severity: 'critical'
            },
            user: {
                patterns: [/validation/i, /input/i, /parameter/i, /argument/i],
                recoverable: false,
                retryable: false,
                severity: 'low'
            }
        };
        
        // Recovery strategies for different components
        this.recoveryStrategies = new Map();
        this.initializeRecoveryStrategies();
        
        // Error tracking and metrics
        this.errorHistory = [];
        this.metrics = {
            totalErrors: 0,
            recoveredErrors: 0,
            criticalErrors: 0,
            errorsByCategory: {},
            errorsByComponent: {},
            recoverySuccessRate: 0
        };
        
        // Circuit breaker states for different components
        this.circuitBreakers = new Map();
        
        // Active recovery operations
        this.activeRecoveries = new Map();
        
        console.log('🛡️ Error Handling Service initialized');
    }

    initializeRecoveryStrategies() {
        // AI Provider recovery
        this.recoveryStrategies.set('aiProvider', {
            attempts: 3,
            delay: 2000,
            strategy: async (error, context) => {
                console.log('🔧 Attempting AI Provider recovery...');
                
                // Switch to fallback provider
                if (context.provider && context.provider.switchProvider) {
                    await context.provider.switchProvider('groq');
                }
                
                // Test connection
                if (context.provider && context.provider.testConnection) {
                    const result = await context.provider.testConnection();
                    return result.success;
                }
                
                return false;
            }
        });
        
        // Wake Word Detector recovery
        this.recoveryStrategies.set('wakeWordDetector', {
            attempts: 2,
            delay: 3000,
            strategy: async (error, context) => {
                console.log('🔧 Attempting Wake Word Detector recovery...');
                
                if (context.detector) {
                    try {
                        // Stop current detection
                        context.detector.stopListening();
                        
                        // Wait for cleanup
                        await this.delay(1000);
                        
                        // Reinitialize if possible
                        if (context.detector.initializeEnhancedFallback) {
                            await context.detector.initializeEnhancedFallback();
                        }
                        
                        // Restart listening
                        context.detector.startListening();
                        
                        return true;
                    } catch (recoveryError) {
                        console.error('Wake word recovery failed:', recoveryError.message);
                        return false;
                    }
                }
                
                return false;
            }
        });
        
        // Audio Stream Service recovery
        this.recoveryStrategies.set('audioStreamService', {
            attempts: 3,
            delay: 1500,
            strategy: async (error, context) => {
                console.log('🔧 Attempting Audio Stream Service recovery...');
                
                if (context.audioService) {
                    try {
                        // Stop current streaming
                        context.audioService.stopStreaming();
                        
                        // Reinitialize with different settings
                        if (context.audioService.setQualityProfile) {
                            context.audioService.setQualityProfile('low');
                        }
                        
                        // Restart streaming
                        context.audioService.startStreaming();
                        
                        return true;
                    } catch (recoveryError) {
                        console.error('Audio service recovery failed:', recoveryError.message);
                        return false;
                    }
                }
                
                return false;
            }
        });
        
        // TTS Service recovery
        this.recoveryStrategies.set('ttsService', {
            attempts: 2,
            delay: 1000,
            strategy: async (error, context) => {
                console.log('🔧 Attempting TTS Service recovery...');
                
                if (context.ttsService) {
                    try {
                        // Force fallback to system TTS
                        context.ttsService.useFallback = true;
                        
                        // Test system TTS
                        await context.ttsService.synthesizeSpeech('Test recovery', null, 'fast');
                        
                        return true;
                    } catch (recoveryError) {
                        console.error('TTS recovery failed:', recoveryError.message);
                        return false;
                    }
                }
                
                return false;
            }
        });
        
        // Conversation Flow recovery
        this.recoveryStrategies.set('conversationFlow', {
            attempts: 1,
            delay: 500,
            strategy: async (error, context) => {
                console.log('🔧 Attempting Conversation Flow recovery...');
                
                if (context.conversationFlow) {
                    try {
                        // Reset conversation state
                        context.conversationFlow.endConversation('recovery');
                        
                        // Clear any pending operations
                        context.conversationFlow.clearAllTimers();
                        
                        return true;
                    } catch (recoveryError) {
                        console.error('Conversation flow recovery failed:', recoveryError.message);
                        return false;
                    }
                }
                
                return false;
            }
        });
    }

    async handleError(error, context = {}) {
        const errorInfo = this.analyzeError(error, context);
        
        // Log the error
        this.logError(errorInfo);
        
        // Update metrics
        this.updateMetrics(errorInfo);
        
        // Add to history
        this.addToHistory(errorInfo);
        
        // Emit error event
        this.emit('error', errorInfo);
        
        // Check circuit breaker
        if (this.shouldTripCircuitBreaker(errorInfo)) {
            this.tripCircuitBreaker(errorInfo.component);
            this.emit('circuitBreakerTripped', { component: errorInfo.component, error: errorInfo });
        }
        
        // Attempt recovery if enabled and error is recoverable
        if (this.options.enableRecovery && errorInfo.recoverable) {
            return await this.attemptRecovery(errorInfo, context);
        }
        
        // Graceful degradation
        if (this.options.gracefulDegradation) {
            return this.handleGracefulDegradation(errorInfo, context);
        }
        
        return {
            success: false,
            error: errorInfo,
            fallback: null
        };
    }

    analyzeError(error, context) {
        const errorMessage = error.message || error.toString();
        const errorStack = error.stack || '';
        
        // Categorize error
        let category = 'unknown';
        for (const [cat, config] of Object.entries(this.errorCategories)) {
            if (config.patterns.some(pattern => pattern.test(errorMessage))) {
                category = cat;
                break;
            }
        }
        
        const categoryConfig = this.errorCategories[category] || {};
        
        // Extract component information
        const component = this.extractComponent(error, context, errorStack);
        
        // Calculate severity
        const severity = this.calculateSeverity(error, categoryConfig.severity, context);
        
        return {
            id: this.generateErrorId(),
            timestamp: Date.now(),
            message: errorMessage,
            stack: errorStack,
            category: category,
            component: component,
            severity: severity,
            recoverable: categoryConfig.recoverable || false,
            retryable: categoryConfig.retryable || false,
            context: this.sanitizeContext(context),
            occurrence: this.getErrorOccurrence(errorMessage)
        };
    }

    extractComponent(error, context, stack) {
        // Try to extract component from context
        if (context.component) return context.component;
        
        // Try to extract from error message
        const messageComponents = ['aiProvider', 'wakeWordDetector', 'audioStreamService', 'ttsService', 'conversationFlow'];
        for (const comp of messageComponents) {
            if (error.message && error.message.toLowerCase().includes(comp.toLowerCase())) {
                return comp;
            }
        }
        
        // Try to extract from stack trace
        if (stack.includes('aiProvider')) return 'aiProvider';
        if (stack.includes('wakeword') || stack.includes('porcupine')) return 'wakeWordDetector';
        if (stack.includes('audio') || stack.includes('stream')) return 'audioStreamService';
        if (stack.includes('tts') || stack.includes('speech')) return 'ttsService';
        if (stack.includes('conversation') || stack.includes('flow')) return 'conversationFlow';
        
        return 'unknown';
    }

    calculateSeverity(error, baseSeverity, context) {
        let severity = baseSeverity || 'medium';
        
        // Increase severity based on context
        if (context.isEmergency) severity = 'critical';
        if (context.isDriving) severity = this.increaseSeverity(severity);
        if (context.userWaiting) severity = this.increaseSeverity(severity);
        
        // Increase severity for repeated errors
        const occurrence = this.getErrorOccurrence(error.message);
        if (occurrence > 3) severity = this.increaseSeverity(severity);
        
        return severity;
    }

    increaseSeverity(currentSeverity) {
        const severityLevels = ['low', 'medium', 'high', 'critical'];
        const currentIndex = severityLevels.indexOf(currentSeverity);
        const nextIndex = Math.min(currentIndex + 1, severityLevels.length - 1);
        return severityLevels[nextIndex];
    }

    getErrorOccurrence(errorMessage) {
        return this.errorHistory.filter(e => e.message === errorMessage).length;
    }

    async attemptRecovery(errorInfo, context) {
        const component = errorInfo.component;
        
        // Check if recovery is already in progress for this component
        if (this.activeRecoveries.has(component)) {
            console.log(`⏳ Recovery already in progress for ${component}`);
            return { success: false, reason: 'recovery_in_progress' };
        }
        
        // Check circuit breaker
        if (this.isCircuitBreakerOpen(component)) {
            console.log(`🔴 Circuit breaker open for ${component}, skipping recovery`);
            return { success: false, reason: 'circuit_breaker_open' };
        }
        
        const strategy = this.recoveryStrategies.get(component);
        if (!strategy) {
            console.log(`⚠️ No recovery strategy for component: ${component}`);
            return { success: false, reason: 'no_strategy' };
        }
        
        this.activeRecoveries.set(component, Date.now());
        console.log(`🔧 Starting recovery for ${component}...`);
        
        try {
            let attempts = 0;
            while (attempts < strategy.attempts) {
                attempts++;
                
                console.log(`🔄 Recovery attempt ${attempts}/${strategy.attempts} for ${component}`);
                
                try {
                    const success = await strategy.strategy(errorInfo, context);
                    
                    if (success) {
                        console.log(`✅ Recovery successful for ${component}`);
                        this.metrics.recoveredErrors++;
                        this.activeRecoveries.delete(component);
                        
                        // Reset circuit breaker on successful recovery
                        this.resetCircuitBreaker(component);
                        
                        this.emit('recoverySuccess', { component, errorInfo, attempts });
                        
                        return {
                            success: true,
                            component: component,
                            attempts: attempts,
                            strategy: 'recovery'
                        };
                    }
                } catch (recoveryError) {
                    console.error(`❌ Recovery attempt ${attempts} failed for ${component}:`, recoveryError.message);
                }
                
                if (attempts < strategy.attempts) {
                    await this.delay(strategy.delay * attempts); // Exponential backoff
                }
            }
            
            console.log(`❌ All recovery attempts failed for ${component}`);
            this.emit('recoveryFailed', { component, errorInfo, attempts });
            
            return { success: false, reason: 'all_attempts_failed', attempts };
            
        } finally {
            this.activeRecoveries.delete(component);
        }
    }

    handleGracefulDegradation(errorInfo, context) {
        console.log(`🏥 Applying graceful degradation for ${errorInfo.component}`);
        
        const degradationStrategies = {
            aiProvider: () => ({
                fallback: 'simple_responses',
                message: "Using simple response mode"
            }),
            wakeWordDetector: () => ({
                fallback: 'manual_activation',
                message: "Wake word detection unavailable, using manual activation"
            }),
            audioStreamService: () => ({
                fallback: 'text_only',
                message: "Audio streaming unavailable, using text mode"
            }),
            ttsService: () => ({
                fallback: 'text_display',
                message: "Voice output unavailable, showing text responses"
            }),
            conversationFlow: () => ({
                fallback: 'single_turn',
                message: "Conversation flow disabled, using single-turn mode"
            })
        };
        
        const strategy = degradationStrategies[errorInfo.component];
        if (strategy) {
            const result = strategy();
            this.emit('gracefulDegradation', { 
                component: errorInfo.component, 
                errorInfo, 
                fallback: result 
            });
            
            return {
                success: true,
                strategy: 'graceful_degradation',
                fallback: result
            };
        }
        
        return {
            success: false,
            reason: 'no_degradation_strategy'
        };
    }

    // Circuit breaker implementation
    shouldTripCircuitBreaker(errorInfo) {
        const component = errorInfo.component;
        const breaker = this.circuitBreakers.get(component) || { failures: 0, state: 'closed' };
        
        breaker.failures++;
        
        // Trip if too many failures in a short time
        const failureThreshold = this.getFailureThreshold(errorInfo.severity);
        if (breaker.failures >= failureThreshold) {
            return true;
        }
        
        return false;
    }

    getFailureThreshold(severity) {
        const thresholds = {
            low: 10,
            medium: 5,
            high: 3,
            critical: 1
        };
        return thresholds[severity] || 5;
    }

    tripCircuitBreaker(component) {
        const breaker = this.circuitBreakers.get(component) || { failures: 0, state: 'closed' };
        breaker.state = 'open';
        breaker.trippedAt = Date.now();
        this.circuitBreakers.set(component, breaker);
        
        console.log(`🔴 Circuit breaker OPEN for ${component}`);
        
        // Auto-reset after timeout
        setTimeout(() => {
            this.resetCircuitBreaker(component);
        }, 60000); // 1 minute timeout
    }

    resetCircuitBreaker(component) {
        const breaker = this.circuitBreakers.get(component);
        if (breaker) {
            breaker.state = 'closed';
            breaker.failures = 0;
            breaker.trippedAt = null;
            this.circuitBreakers.set(component, breaker);
            console.log(`🟢 Circuit breaker CLOSED for ${component}`);
        }
    }

    isCircuitBreakerOpen(component) {
        const breaker = this.circuitBreakers.get(component);
        return breaker && breaker.state === 'open';
    }

    // Utility methods
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    sanitizeContext(context) {
        // Remove sensitive information from context
        const sanitized = { ...context };
        delete sanitized.apiKey;
        delete sanitized.password;
        delete sanitized.token;
        return sanitized;
    }

    logError(errorInfo) {
        if (!this.options.enableLogging) return;
        
        const logLevels = ['low', 'medium', 'high', 'critical'];
        const minLevel = logLevels.indexOf(this.options.logLevel);
        const errorLevel = logLevels.indexOf(errorInfo.severity);
        
        if (errorLevel >= minLevel) {
            const logPrefix = this.getLogPrefix(errorInfo.severity);
            console.error(`${logPrefix} [${errorInfo.component}] ${errorInfo.message}`);
            
            if (errorInfo.severity === 'critical') {
                console.error('Stack trace:', errorInfo.stack);
            }
        }
    }

    getLogPrefix(severity) {
        const prefixes = {
            low: '🔵',
            medium: '🟡',
            high: '🟠',
            critical: '🔴'
        };
        return prefixes[severity] || '⚪';
    }

    updateMetrics(errorInfo) {
        if (!this.options.enableMetrics) return;
        
        this.metrics.totalErrors++;
        
        if (errorInfo.severity === 'critical') {
            this.metrics.criticalErrors++;
        }
        
        // Update category metrics
        if (!this.metrics.errorsByCategory[errorInfo.category]) {
            this.metrics.errorsByCategory[errorInfo.category] = 0;
        }
        this.metrics.errorsByCategory[errorInfo.category]++;
        
        // Update component metrics
        if (!this.metrics.errorsByComponent[errorInfo.component]) {
            this.metrics.errorsByComponent[errorInfo.component] = 0;
        }
        this.metrics.errorsByComponent[errorInfo.component]++;
        
        // Update recovery success rate
        if (this.metrics.totalErrors > 0) {
            this.metrics.recoverySuccessRate = 
                (this.metrics.recoveredErrors / this.metrics.totalErrors * 100).toFixed(2);
        }
    }

    addToHistory(errorInfo) {
        this.errorHistory.push(errorInfo);
        
        // Keep only last 100 errors
        if (this.errorHistory.length > 100) {
            this.errorHistory.shift();
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public API methods
    getMetrics() {
        return {
            ...this.metrics,
            circuitBreakers: Object.fromEntries(this.circuitBreakers),
            activeRecoveries: this.activeRecoveries.size,
            recentErrors: this.errorHistory.slice(-10)
        };
    }

    getComponentHealth() {
        const health = {};
        
        for (const [component, breaker] of this.circuitBreakers) {
            health[component] = {
                status: breaker.state === 'open' ? 'degraded' : 'healthy',
                failures: breaker.failures,
                lastFailure: breaker.trippedAt
            };
        }
        
        return health;
    }

    clearHistory() {
        this.errorHistory.length = 0;
        console.log('📝 Error history cleared');
    }

    resetMetrics() {
        this.metrics = {
            totalErrors: 0,
            recoveredErrors: 0,
            criticalErrors: 0,
            errorsByCategory: {},
            errorsByComponent: {},
            recoverySuccessRate: 0
        };
        console.log('📊 Error metrics reset');
    }

    destroy() {
        this.clearHistory();
        this.circuitBreakers.clear();
        this.activeRecoveries.clear();
        this.removeAllListeners();
        console.log('🗑️ Error Handling Service destroyed');
    }
}

module.exports = ErrorHandlingService;