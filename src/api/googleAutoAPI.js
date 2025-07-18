const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const WakeWordDetector = require('../wakeword/detector');
const AudioRecorder = require('../audio/recorder');
const SpeechRecognition = require('../audio/speechRecognition');
const TextToSpeech = require('../audio/textToSpeech');
const ConversationHandler = require('../chatbot/conversationHandler');
const IntentRecognition = require('../chatbot/intentRecognition');

class GoogleAutoAPI {
    constructor(options = {}) {
        this.app = express();
        this.port = options.port || process.env.PORT || 3000;
        this.setupMiddleware();
        this.setupRoutes();
        this.initializeServices();
    }

    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors({
            origin: ['http://localhost:3000', 'https://your-car-app.com'],
            credentials: true
        }));
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    }

    async initializeServices() {
        try {
            // Initialize wake word detector
            this.wakeWordDetector = new WakeWordDetector(
                process.env.PICOVOICE_ACCESS_KEY,
                parseFloat(process.env.WAKE_WORD_SENSITIVITY) || 0.5
            );

            // Initialize audio services
            this.audioRecorder = new AudioRecorder({
                sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE) || 16000,
                channels: parseInt(process.env.AUDIO_CHANNELS) || 1
            });

            this.speechRecognition = new SpeechRecognition();
            this.textToSpeech = new TextToSpeech();

            // Initialize conversation handler
            this.conversationHandler = new ConversationHandler({
                apiKey: process.env.OPENAI_API_KEY
            });

            this.intentRecognition = new IntentRecognition();

            // Set up wake word detection
            await this.wakeWordDetector.initialize();
            this.wakeWordDetector.onWakeWord(() => {
                console.log('Wake word detected: "hi ecarx"');
                this.handleWakeWord();
            });

            this.wakeWordDetector.startListening();

            console.log('All services initialized successfully');
        } catch (error) {
            console.error('Failed to initialize services:', error);
        }
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });

        // Wake word endpoint
        this.app.post('/wake-word', async (req, res) => {
            try {
                await this.handleWakeWord();
                res.json({ success: true, message: 'Wake word processed' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Voice input endpoint
        this.app.post('/voice-input', async (req, res) => {
            try {
                const { audioData, carContext } = req.body;
                const result = await this.processVoiceInput(audioData, carContext);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Text input endpoint
        this.app.post('/text-input', async (req, res) => {
            try {
                const { text, carContext } = req.body;
                const result = await this.processTextInput(text, carContext);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Car context update
        this.app.post('/update-context', (req, res) => {
            try {
                const { context } = req.body;
                this.conversationHandler.updateCarContext(context);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Emergency endpoint
        this.app.post('/emergency', async (req, res) => {
            try {
                const { emergencyType, location } = req.body;
                const result = await this.handleEmergency(emergencyType, location);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Navigation endpoints
        this.app.post('/navigation/start', async (req, res) => {
            try {
                const { destination, currentLocation } = req.body;
                const result = await this.startNavigation(destination, currentLocation);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Music control endpoints
        this.app.post('/music/play', async (req, res) => {
            try {
                const { query } = req.body;
                const result = await this.playMusic(query);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Phone endpoints
        this.app.post('/phone/call', async (req, res) => {
            try {
                const { contact } = req.body;
                const result = await this.makePhoneCall(contact);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Settings endpoints
        this.app.get('/settings', (req, res) => {
            res.json({
                wakeWordSensitivity: process.env.WAKE_WORD_SENSITIVITY,
                audioSampleRate: process.env.AUDIO_SAMPLE_RATE,
                language: 'en-US'
            });
        });

        this.app.post('/settings', (req, res) => {
            try {
                const { settings } = req.body;
                // Update settings (in a real app, save to database)
                console.log('Settings updated:', settings);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    async handleWakeWord() {
        console.log('Processing wake word activation');
        
        // Start recording audio
        this.audioRecorder.startRecording();
        
        // Play acknowledgment sound
        const acknowledgment = await this.textToSpeech.synthesizeCasual("Yes, I'm listening");
        await this.textToSpeech.playAudio(acknowledgment);
        
        // Set timeout for voice input
        setTimeout(() => {
            if (this.audioRecorder.isRecording) {
                this.audioRecorder.stopRecording();
            }
        }, 5000);
        
        this.audioRecorder.onEnd(async (audioBuffer) => {
            const result = await this.processVoiceInput(audioBuffer);
            console.log('Voice input processed:', result);
        });
    }

    async processVoiceInput(audioData, carContext = null) {
        try {
            // Convert audio to text
            const speechResult = await this.speechRecognition.recognizeAudio(audioData);
            
            if (!speechResult) {
                return { error: 'Could not understand audio' };
            }

            return await this.processTextInput(speechResult.text, carContext);
        } catch (error) {
            console.error('Voice input processing error:', error);
            return { error: 'Failed to process voice input' };
        }
    }

    async processTextInput(text, carContext = null) {
        try {
            // Recognize intent
            const intent = this.intentRecognition.recognizeIntentWithContext(text, carContext);
            
            // Process conversation
            const conversationResult = await this.conversationHandler.processMessage(text, carContext);
            
            // Generate audio response
            const audioResponse = await this.textToSpeech.synthesizeCasual(conversationResult.response);
            
            return {
                text: conversationResult.response,
                intent: intent,
                actions: conversationResult.actions,
                audioResponse: audioResponse.toString('base64'),
                context: conversationResult.context
            };
        } catch (error) {
            console.error('Text input processing error:', error);
            return { error: 'Failed to process text input' };
        }
    }

    async handleEmergency(emergencyType, location) {
        console.log('Emergency detected:', emergencyType, location);
        
        const emergencyResponse = this.conversationHandler.handleEmergency(emergencyType);
        const audioResponse = await this.textToSpeech.synthesizeUrgent(emergencyResponse.response);
        
        return {
            ...emergencyResponse,
            audioResponse: audioResponse.toString('base64'),
            location: location
        };
    }

    async startNavigation(destination, currentLocation) {
        // In a real implementation, integrate with Google Maps API
        console.log('Starting navigation to:', destination);
        
        const response = `Starting navigation to ${destination}`;
        const audioResponse = await this.textToSpeech.synthesizeNavigation(response);
        
        return {
            success: true,
            message: response,
            audioResponse: audioResponse.toString('base64'),
            destination: destination,
            currentLocation: currentLocation
        };
    }

    async playMusic(query) {
        // In a real implementation, integrate with music streaming APIs
        console.log('Playing music:', query);
        
        const response = `Playing ${query}`;
        const audioResponse = await this.textToSpeech.synthesizeCasual(response);
        
        return {
            success: true,
            message: response,
            audioResponse: audioResponse.toString('base64'),
            query: query
        };
    }

    async makePhoneCall(contact) {
        // In a real implementation, integrate with phone system
        console.log('Making phone call to:', contact);
        
        const response = `Calling ${contact}`;
        const audioResponse = await this.textToSpeech.synthesizeCasual(response);
        
        return {
            success: true,
            message: response,
            audioResponse: audioResponse.toString('base64'),
            contact: contact
        };
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`ECARX Bot API server running on port ${this.port}`);
        });
    }

    stop() {
        if (this.wakeWordDetector) {
            this.wakeWordDetector.destroy();
        }
        console.log('ECARX Bot API server stopped');
    }
}

module.exports = GoogleAutoAPI;