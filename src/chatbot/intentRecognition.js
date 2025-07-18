class IntentRecognition {
    constructor() {
        this.intents = {
            navigation: {
                keywords: ['navigate', 'directions', 'route', 'go to', 'drive to', 'find', 'location', 'address'],
                patterns: [
                    /navigate to (.+)/i,
                    /directions to (.+)/i,
                    /how do i get to (.+)/i,
                    /take me to (.+)/i,
                    /go to (.+)/i,
                    /find (.+)/i
                ],
                entities: ['destination', 'location']
            },
            music: {
                keywords: ['play', 'music', 'song', 'artist', 'album', 'playlist', 'radio', 'tune', 'volume'],
                patterns: [
                    /play (.+)/i,
                    /play music by (.+)/i,
                    /play (.+) by (.+)/i,
                    /turn on (.+)/i,
                    /listen to (.+)/i,
                    /volume (up|down|to \d+)/i
                ],
                entities: ['song', 'artist', 'album', 'playlist', 'volume']
            },
            phone: {
                keywords: ['call', 'phone', 'dial', 'contact', 'ring', 'speak to'],
                patterns: [
                    /call (.+)/i,
                    /phone (.+)/i,
                    /dial (.+)/i,
                    /ring (.+)/i,
                    /contact (.+)/i
                ],
                entities: ['contact', 'number']
            },
            weather: {
                keywords: ['weather', 'temperature', 'forecast', 'rain', 'sunny', 'cloudy', 'storm'],
                patterns: [
                    /weather in (.+)/i,
                    /temperature in (.+)/i,
                    /forecast for (.+)/i,
                    /what's the weather like/i
                ],
                entities: ['location', 'time']
            },
            vehicle: {
                keywords: ['fuel', 'gas', 'battery', 'engine', 'oil', 'tire', 'maintenance', 'service'],
                patterns: [
                    /check (.+)/i,
                    /fuel level/i,
                    /battery status/i,
                    /engine temperature/i,
                    /tire pressure/i
                ],
                entities: ['component', 'status']
            },
            emergency: {
                keywords: ['emergency', 'help', 'accident', 'crash', 'medical', 'urgent', 'police', 'fire'],
                patterns: [
                    /emergency/i,
                    /call 911/i,
                    /need help/i,
                    /accident/i,
                    /medical emergency/i
                ],
                entities: ['emergency_type']
            },
            settings: {
                keywords: ['settings', 'preferences', 'configure', 'adjust', 'change', 'temperature', 'ac', 'heat'],
                patterns: [
                    /adjust (.+)/i,
                    /set (.+) to (.+)/i,
                    /change (.+)/i,
                    /temperature to (\d+)/i,
                    /turn (on|off) (.+)/i
                ],
                entities: ['setting', 'value']
            },
            general: {
                keywords: ['hello', 'hi', 'thanks', 'thank you', 'goodbye', 'bye', 'yes', 'no', 'okay'],
                patterns: [
                    /hello|hi|hey/i,
                    /thank you|thanks/i,
                    /goodbye|bye/i,
                    /yes|yeah|ok|okay/i,
                    /no|nope/i
                ],
                entities: ['greeting', 'confirmation']
            }
        };
    }

    recognizeIntent(text) {
        const normalizedText = text.toLowerCase().trim();
        let bestMatch = {
            intent: 'unknown',
            confidence: 0,
            entities: {}
        };

        for (const [intentName, intentData] of Object.entries(this.intents)) {
            const score = this.calculateIntentScore(normalizedText, intentData);
            
            if (score > bestMatch.confidence) {
                bestMatch = {
                    intent: intentName,
                    confidence: score,
                    entities: this.extractEntities(normalizedText, intentData)
                };
            }
        }

        return bestMatch;
    }

    calculateIntentScore(text, intentData) {
        let score = 0;
        const words = text.split(/\s+/);
        
        // Check keyword matches
        for (const keyword of intentData.keywords) {
            if (text.includes(keyword)) {
                score += 0.1;
            }
        }
        
        // Check pattern matches
        for (const pattern of intentData.patterns) {
            if (pattern.test(text)) {
                score += 0.5;
            }
        }
        
        // Normalize score
        return Math.min(score, 1.0);
    }

    extractEntities(text, intentData) {
        const entities = {};
        
        for (const pattern of intentData.patterns) {
            const match = text.match(pattern);
            if (match) {
                // Extract captured groups as entities
                for (let i = 1; i < match.length; i++) {
                    if (match[i]) {
                        const entityType = intentData.entities[i - 1] || 'value';
                        entities[entityType] = match[i].trim();
                    }
                }
            }
        }
        
        return entities;
    }

    // Context-aware intent recognition
    recognizeIntentWithContext(text, context = {}) {
        const baseIntent = this.recognizeIntent(text);
        
        // Adjust confidence based on context
        if (context.navigationActive && baseIntent.intent === 'navigation') {
            baseIntent.confidence += 0.2;
        }
        
        if (context.musicPlaying && baseIntent.intent === 'music') {
            baseIntent.confidence += 0.2;
        }
        
        if (context.speed > 0 && baseIntent.intent === 'emergency') {
            baseIntent.confidence += 0.3;
        }
        
        return baseIntent;
    }

    // Multi-intent recognition for complex sentences
    recognizeMultipleIntents(text) {
        const intents = [];
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        
        for (const sentence of sentences) {
            const intent = this.recognizeIntent(sentence);
            if (intent.confidence > 0.3) {
                intents.push(intent);
            }
        }
        
        return intents;
    }

    // Get suggested actions based on intent
    getSuggestedActions(intent) {
        const actions = {
            navigation: [
                'Start navigation',
                'Find nearby places',
                'Check traffic',
                'Get directions'
            ],
            music: [
                'Play music',
                'Skip track',
                'Adjust volume',
                'Change source'
            ],
            phone: [
                'Make call',
                'View contacts',
                'Check messages',
                'Dial number'
            ],
            weather: [
                'Get current weather',
                'Check forecast',
                'Traffic conditions',
                'Plan route'
            ],
            vehicle: [
                'Check status',
                'View diagnostics',
                'Schedule service',
                'Find gas station'
            ],
            emergency: [
                'Call emergency services',
                'Send location',
                'Contact emergency contact',
                'Find hospital'
            ],
            settings: [
                'Adjust temperature',
                'Change preferences',
                'Configure system',
                'View settings'
            ]
        };

        return actions[intent] || ['Ask for help', 'Try again', 'Speak clearly'];
    }

    // Training data for improving intent recognition
    addTrainingData(text, correctIntent) {
        // In a real implementation, this would update the model
        console.log(`Training: "${text}" -> ${correctIntent}`);
    }
}

module.exports = IntentRecognition;