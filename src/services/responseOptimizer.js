/**
 * Response Optimizer
 * 
 * Optimizes AI responses for voice interaction and driving safety:
 * - Voice-friendly formatting
 * - Interruption handling
 * - Safety-first design
 * - Length optimization based on context
 * - Clarity and pronunciation optimization
 */
class ResponseOptimizer {
    constructor(options = {}) {
        this.options = {
            maxDrivingLength: options.maxDrivingLength || 100, // Max characters while driving
            maxStoppedLength: options.maxStoppedLength || 200, // Max characters when stopped
            urgencyLengthReduction: options.urgencyLengthReduction || 0.3, // 30% reduction for urgent
            abbreviateNumbers: options.abbreviateNumbers ?? true,
            removeMarkdown: options.removeMarkdown ?? true,
            simplifyLanguage: options.simplifyLanguage ?? true,
            ...options
        };

        // Voice optimization rules
        this.voiceRules = {
            // Number replacements for better pronunciation
            numbers: {
                '1st': 'first',
                '2nd': 'second', 
                '3rd': 'third',
                '4th': 'fourth',
                '5th': 'fifth',
                '&': 'and',
                '@': 'at',
                '%': 'percent',
                '$': 'dollars',
                '#': 'number'
            },
            
            // Common abbreviations to expand
            abbreviations: {
                'w/': 'with',
                'w/o': 'without',
                'thru': 'through',
                'ur': 'your',
                'u': 'you',
                'bt': 'but',
                'bc': 'because',
                'b4': 'before',
                'asap': 'as soon as possible',
                'etc': 'and so on',
                'vs': 'versus',
                'aka': 'also known as'
            },
            
            // Complex words to simplify for voice
            simplifications: {
                'approximately': 'about',
                'currently': 'now',
                'immediately': 'right away',
                'extremely': 'very',
                'significantly': 'much',
                'unfortunately': 'sadly',
                'consequently': 'so',
                'therefore': 'so',
                'furthermore': 'also',
                'additionally': 'also',
                'nevertheless': 'but',
                'however': 'but'
            },
            
            // Phrases that are hard to understand when spoken
            clarifications: {
                'i.e.': 'that is',
                'e.g.': 'for example',
                'etc.': 'and so on',
                'viz.': 'namely',
                'cf.': 'compare',
                'ibid.': 'same source'
            }
        };

        // Safety keywords that require immediate attention
        this.safetyKeywords = [
            'emergency', 'accident', 'danger', 'police', 'fire', 'ambulance',
            'crash', 'breakdown', 'stuck', 'help', 'urgent', 'critical'
        ];

        // Context-aware response templates
        this.responseTemplates = {
            emergency: {
                prefix: 'Emergency detected.',
                maxLength: 50,
                tone: 'urgent'
            },
            driving: {
                prefix: '',
                maxLength: this.options.maxDrivingLength,
                tone: 'concise'
            },
            stopped: {
                prefix: '',
                maxLength: this.options.maxStoppedLength,
                tone: 'detailed'
            },
            night: {
                prefix: '',
                maxLength: 80,
                tone: 'gentle'
            }
        };

        console.log('⚡ Response Optimizer initialized');
    }

    /**
     * Optimize response for voice interaction
     */
    async optimizeForVoice(response, context = {}) {
        try {
            let optimizedContent = response.content;
            
            // Determine optimization strategy based on context
            const strategy = this.determineOptimizationStrategy(context);
            
            // Apply optimization steps
            optimizedContent = this.removeMarkdownFormatting(optimizedContent);
            optimizedContent = this.optimizeForPronunciation(optimizedContent);
            optimizedContent = this.adjustForSafety(optimizedContent, context);
            optimizedContent = this.adjustForLength(optimizedContent, strategy);
            optimizedContent = this.enhanceClarity(optimizedContent, context);
            optimizedContent = this.addContextualPrefix(optimizedContent, strategy);
            
            // Calculate optimization metrics
            const metrics = this.calculateOptimizationMetrics(response.content, optimizedContent, context);
            
            return {
                content: optimizedContent,
                originalLength: response.content.length,
                optimizedLength: optimizedContent.length,
                strategy: strategy,
                metrics: metrics,
                voiceOptimized: true,
                pronunciationScore: this.calculatePronunciationScore(optimizedContent),
                safetyScore: this.calculateSafetyScore(optimizedContent, context)
            };
            
        } catch (error) {
            console.error('⚠️ Response optimization failed:', error);
            return {
                content: response.content,
                error: error.message,
                voiceOptimized: false
            };
        }
    }

    /**
     * Handle interruption during response
     */
    handleInterruption(currentResponse, interruptionType, context = {}) {
        switch (interruptionType) {
            case 'emergency':
                return this.generateEmergencyInterruptionResponse();
            
            case 'urgent':
                return this.generateUrgentInterruptionResponse(currentResponse, context);
            
            case 'clarification':
                return this.generateClarificationResponse(currentResponse);
            
            case 'continuation':
                return this.generateContinuationPrompt(currentResponse);
            
            default:
                return this.generateGenericInterruptionResponse();
        }
    }

    /**
     * Determine optimization strategy based on context
     */
    determineOptimizationStrategy(context) {
        // Emergency context
        if (context.isEmergency || this.containsSafetyKeywords(context.content || '')) {
            return 'emergency';
        }
        
        // Driving context
        if (context.isMoving) {
            return 'driving';
        }
        
        // Time-based context
        const hour = new Date().getHours();
        if (hour >= 22 || hour <= 6) {
            return 'night';
        }
        
        // High urgency
        if (context.urgency > 0.7) {
            return 'urgent';
        }
        
        // Default to stopped/detailed
        return 'stopped';
    }

    /**
     * Remove markdown formatting for voice
     */
    removeMarkdownFormatting(content) {
        if (!this.options.removeMarkdown) return content;
        
        return content
            // Remove bold formatting
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            
            // Remove italic formatting
            .replace(/_([^_]+)_/g, '$1')
            
            // Remove code formatting
            .replace(/`([^`]+)`/g, '$1')
            
            // Remove headers
            .replace(/^#{1,6}\s+/gm, '')
            
            // Remove links but keep text
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            
            // Remove bullet points
            .replace(/^\s*[-*+]\s+/gm, '')
            
            // Remove numbered lists
            .replace(/^\s*\d+\.\s+/gm, '')
            
            // Clean up extra whitespace
            .replace(/\n+/g, '. ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Optimize for pronunciation and voice clarity
     */
    optimizeForPronunciation(content) {
        let optimized = content;
        
        // Replace numbers and symbols
        for (const [symbol, replacement] of Object.entries(this.voiceRules.numbers)) {
            const regex = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            optimized = optimized.replace(regex, replacement);
        }
        
        // Expand abbreviations
        for (const [abbrev, expansion] of Object.entries(this.voiceRules.abbreviations)) {
            const regex = new RegExp(`\\b${abbrev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            optimized = optimized.replace(regex, expansion);
        }
        
        // Simplify complex words if enabled
        if (this.options.simplifyLanguage) {
            for (const [complex, simple] of Object.entries(this.voiceRules.simplifications)) {
                const regex = new RegExp(`\\b${complex}\\b`, 'gi');
                optimized = optimized.replace(regex, simple);
            }
        }
        
        // Clarify unclear phrases
        for (const [unclear, clear] of Object.entries(this.voiceRules.clarifications)) {
            const regex = new RegExp(`\\b${unclear.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            optimized = optimized.replace(regex, clear);
        }
        
        // Format numbers for better pronunciation
        optimized = this.formatNumbersForVoice(optimized);
        
        // Add pauses for better pacing
        optimized = this.addVoicePauses(optimized);
        
        return optimized;
    }

    /**
     * Format numbers for voice pronunciation
     */
    formatNumbersForVoice(content) {
        // Convert large numbers to more pronounceable format
        return content
            // Convert percentages
            .replace(/(\d+)%/g, '$1 percent')
            
            // Convert currency
            .replace(/\$(\d+)(?:\.(\d{2}))?/g, (match, dollars, cents) => {
                if (cents && cents !== '00') {
                    return `${dollars} dollars and ${cents} cents`;
                }
                return `${dollars} dollars`;
            })
            
            // Convert times (24-hour to 12-hour)
            .replace(/(\d{1,2}):(\d{2})/g, (match, hours, minutes) => {
                const hour = parseInt(hours);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const hour12 = hour % 12 || 12;
                
                if (minutes === '00') {
                    return `${hour12} ${ampm}`;
                }
                return `${hour12}:${minutes} ${ampm}`;
            })
            
            // Convert phone numbers
            .replace(/(\d{3})-(\d{3})-(\d{4})/g, '$1 $2 $3')
            
            // Convert years
            .replace(/\b(19|20)(\d{2})\b/g, (match, century, year) => {
                if (century === '20' && year === '00') return 'two thousand';
                if (century === '20' && parseInt(year) < 10) return `two thousand ${year}`;
                return match; // Keep as is for complex years
            });
    }

    /**
     * Add strategic pauses for better voice pacing
     */
    addVoicePauses(content) {
        return content
            // Add pause after introductory phrases
            .replace(/^(Well|So|Now|Okay|Alright),?\s*/i, '$1, ')
            
            // Add pause before important information
            .replace(/\b(however|but|although|meanwhile|furthermore)\b/gi, '$1,')
            
            // Add pause around parenthetical information
            .replace(/\s*\([^)]+\)\s*/g, ', ')
            
            // Ensure proper punctuation for pauses
            .replace(/([.!?])\s*([A-Z])/g, '$1 $2')
            
            // Add pause before lists
            .replace(/:\s*([A-Z])/g, ': $1');
    }

    /**
     * Adjust response for safety requirements
     */
    adjustForSafety(content, context) {
        // If driving, prioritize critical information first
        if (context.isMoving) {
            // Extract critical information
            const criticalInfo = this.extractCriticalInformation(content);
            
            if (criticalInfo) {
                // Put critical info first, then details
                const nonCritical = content.replace(criticalInfo, '').trim();
                return criticalInfo + (nonCritical ? '. ' + nonCritical : '');
            }
        }
        
        // Add safety warnings if necessary
        if (this.needsSafetyWarning(content, context)) {
            content = this.addSafetyWarning(content, context);
        }
        
        return content;
    }

    /**
     * Extract critical information from response
     */
    extractCriticalInformation(content) {
        const criticalPatterns = [
            /emergency[^.!?]*/i,
            /urgent[^.!?]*/i,
            /danger[^.!?]*/i,
            /warning[^.!?]*/i,
            /immediate[^.!?]*/i,
            /right now[^.!?]*/i,
            /call 911[^.!?]*/i
        ];
        
        for (const pattern of criticalPatterns) {
            const match = content.match(pattern);
            if (match) {
                return match[0];
            }
        }
        
        return null;
    }

    /**
     * Check if safety warning is needed
     */
    needsSafetyWarning(content, context) {
        // Check for operations that require attention while driving
        const attentionRequiredPatterns = [
            /look at/i,
            /read this/i,
            /check your/i,
            /see the/i,
            /view/i,
            /display/i
        ];
        
        return context.isMoving && 
               attentionRequiredPatterns.some(pattern => pattern.test(content));
    }

    /**
     * Add appropriate safety warning
     */
    addSafetyWarning(content, context) {
        if (context.isMoving) {
            return `Please keep your eyes on the road. ${content}`;
        }
        
        return content;
    }

    /**
     * Adjust response length based on strategy
     */
    adjustForLength(content, strategy) {
        const maxLength = this.responseTemplates[strategy]?.maxLength || this.options.maxStoppedLength;
        
        if (content.length <= maxLength) {
            return content;
        }
        
        // Intelligently truncate while preserving meaning
        return this.intelligentTruncate(content, maxLength);
    }

    /**
     * Intelligently truncate content while preserving meaning
     */
    intelligentTruncate(content, maxLength) {
        if (content.length <= maxLength) return content;
        
        // Try to break at sentence boundaries
        const sentences = content.split(/[.!?]+\s*/);
        let truncated = '';
        
        for (const sentence of sentences) {
            if ((truncated + sentence).length <= maxLength - 3) { // -3 for "..."
                truncated += (truncated ? '. ' : '') + sentence;
            } else {
                break;
            }
        }
        
        // If we couldn't fit even one sentence, truncate at word boundary
        if (!truncated) {
            const words = content.split(' ');
            while (words.length > 0 && words.join(' ').length > maxLength - 3) {
                words.pop();
            }
            truncated = words.join(' ');
        }
        
        return truncated + (truncated.length < content.length ? '...' : '');
    }

    /**
     * Enhance clarity for voice interaction
     */
    enhanceClarity(content, context) {
        let enhanced = content;
        
        // Add context markers for better understanding
        if (context.isResponseToQuestion) {
            enhanced = this.addAnswerMarkers(enhanced);
        }
        
        // Improve list presentation for voice
        enhanced = this.improveListsForVoice(enhanced);
        
        // Add emphasis markers for important information
        enhanced = this.addEmphasisForVoice(enhanced, context);
        
        return enhanced;
    }

    /**
     * Add answer markers for questions
     */
    addAnswerMarkers(content) {
        // Don't add markers if they already exist
        if (/^(yes|no|sure|absolutely|definitely|unfortunately|sadly)/i.test(content)) {
            return content;
        }
        
        // Add appropriate answer markers
        if (content.includes('cannot') || content.includes("can't") || content.includes('unable')) {
            return `Unfortunately, ${content.charAt(0).toLowerCase() + content.slice(1)}`;
        }
        
        return content;
    }

    /**
     * Improve lists for voice presentation
     */
    improveListsForVoice(content) {
        // Convert numbered lists to voice-friendly format
        return content.replace(/^\d+\.\s*/gm, 'Next, ');
    }

    /**
     * Add emphasis for important information
     */
    addEmphasisForVoice(content, context) {
        if (context.urgency > 0.7) {
            // Emphasize urgent information
            content = content.replace(/\b(urgent|emergency|immediately|now)\b/gi, 
                (match) => `${match.toLowerCase()}`);
        }
        
        return content;
    }

    /**
     * Add contextual prefix based on strategy
     */
    addContextualPrefix(content, strategy) {
        const template = this.responseTemplates[strategy];
        
        if (template?.prefix) {
            return `${template.prefix} ${content}`;
        }
        
        return content;
    }

    /**
     * Generate interruption responses
     */
    generateEmergencyInterruptionResponse() {
        return {
            content: "Emergency detected. Stopping previous response. How can I help you immediately?",
            type: 'emergency_interruption',
            priority: 'critical'
        };
    }

    generateUrgentInterruptionResponse(currentResponse, context) {
        return {
            content: "I understand this is urgent. Let me help you with that right away.",
            type: 'urgent_interruption',
            priority: 'high',
            resumable: currentResponse
        };
    }

    generateClarificationResponse(currentResponse) {
        return {
            content: "Let me clarify that for you.",
            type: 'clarification_interruption',
            priority: 'medium',
            resumable: currentResponse
        };
    }

    generateContinuationPrompt(currentResponse) {
        return {
            content: "Would you like me to continue with my previous response?",
            type: 'continuation_prompt',
            priority: 'low',
            resumable: currentResponse
        };
    }

    generateGenericInterruptionResponse() {
        return {
            content: "I'm here. What can I help you with?",
            type: 'generic_interruption',
            priority: 'medium'
        };
    }

    /**
     * Calculate optimization metrics
     */
    calculateOptimizationMetrics(original, optimized, context) {
        return {
            lengthReduction: ((original.length - optimized.length) / original.length * 100).toFixed(1),
            wordsReduced: original.split(' ').length - optimized.split(' ').length,
            pronunciationImprovements: this.countPronunciationImprovements(original, optimized),
            safetyEnhancements: this.countSafetyEnhancements(original, optimized, context),
            clarityScore: this.calculateClarityScore(optimized),
            voiceReadiness: this.calculateVoiceReadiness(optimized, context)
        };
    }

    /**
     * Calculate pronunciation score (0-100)
     */
    calculatePronunciationScore(content) {
        let score = 100;
        
        // Deduct points for hard-to-pronounce elements
        const difficultPatterns = [
            /[^\w\s.,!?;:]/g, // Special characters
            /\w{15,}/g, // Very long words
            /\d{4,}/g, // Long numbers
            /[A-Z]{3,}/g // Long acronyms
        ];
        
        difficultPatterns.forEach(pattern => {
            const matches = content.match(pattern) || [];
            score -= matches.length * 5;
        });
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate safety score (0-100)
     */
    calculateSafetyScore(content, context) {
        let score = 100;
        
        if (context.isMoving) {
            // Deduct points for distracting elements
            if (content.length > this.options.maxDrivingLength) {
                score -= 20;
            }
            
            const distractingPatterns = [
                /look at/gi,
                /check your/gi,
                /read/gi,
                /view/gi
            ];
            
            distractingPatterns.forEach(pattern => {
                if (pattern.test(content)) {
                    score -= 15;
                }
            });
        }
        
        return Math.max(0, score);
    }

    /**
     * Helper methods
     */
    containsSafetyKeywords(content) {
        return this.safetyKeywords.some(keyword => 
            content.toLowerCase().includes(keyword));
    }

    countPronunciationImprovements(original, optimized) {
        let improvements = 0;
        
        // Count symbol replacements
        improvements += (original.match(/[&@%$#]/g) || []).length;
        
        // Count abbreviation expansions  
        Object.keys(this.voiceRules.abbreviations).forEach(abbrev => {
            const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
            improvements += (original.match(regex) || []).length;
        });
        
        return improvements;
    }

    countSafetyEnhancements(original, optimized, context) {
        let enhancements = 0;
        
        if (context.isMoving && optimized.includes('keep your eyes on the road')) {
            enhancements += 1;
        }
        
        if (original.length > optimized.length) {
            enhancements += 1; // Length reduction is a safety enhancement
        }
        
        return enhancements;
    }

    calculateClarityScore(content) {
        let score = 50; // Base score
        
        // Bonus for proper punctuation
        if ((content.match(/[.!?]/g) || []).length > 0) score += 10;
        
        // Bonus for reasonable sentence length
        const sentences = content.split(/[.!?]+/);
        const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
        
        if (avgSentenceLength < 80) score += 20;
        if (avgSentenceLength < 50) score += 20;
        
        return Math.min(100, score);
    }

    calculateVoiceReadiness(content, context) {
        const pronunciation = this.calculatePronunciationScore(content);
        const safety = this.calculateSafetyScore(content, context);
        const clarity = this.calculateClarityScore(content);
        
        return Math.round((pronunciation + safety + clarity) / 3);
    }

    /**
     * Get optimization statistics
     */
    getOptimizationStats() {
        return {
            voiceRules: {
                numbers: Object.keys(this.voiceRules.numbers).length,
                abbreviations: Object.keys(this.voiceRules.abbreviations).length,
                simplifications: Object.keys(this.voiceRules.simplifications).length,
                clarifications: Object.keys(this.voiceRules.clarifications).length
            },
            safetyKeywords: this.safetyKeywords.length,
            responseTemplates: Object.keys(this.responseTemplates).length,
            options: this.options
        };
    }
}

module.exports = ResponseOptimizer;