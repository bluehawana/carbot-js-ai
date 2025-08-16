const express = require('express');
const { Server } = require("socket.io");
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const WakeWordDetector = require('../wakeword/detector');
const AudioRecorder = require('../audio/recorder');
const SpeechRecognition = require('../audio/speechRecognition');
const TextToSpeech = require('../audio/textToSpeech');
const ConversationHandler = require('../chatbot/conversationHandler');
const IntentRecognition = require('../chatbot/intentRecognition');
const WhisperSTTService = require('../services/whisperSTTService');

class GoogleAutoAPI {
    constructor(options = {}) {
        this.app = express();
        this.port = options.port || process.env.PORT || 3000;
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: ["http://localhost:3000", "https://your-car-app.com"],
                credentials: true
            }
        });
        this.setupMiddleware();
        this.setupRoutes();
        this.initializeServices();
        this.setupSocketIO();
    }

    setupSocketIO() {
        this.io.on('connection', (socket) => {
            console.log('A user connected to socket.io');

            socket.on('disconnect', () => {
                console.log('User disconnected from socket.io');
            });
        });
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
            // Validate required API keys
            this.validateAPIKeys();

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
            
            // Initialize local Whisper STT service
            this.localSTT = new WhisperSTTService();
            this.useLocalSTT = process.env.USE_WHISPER_STT === 'true';

            // Initialize conversation handler
            this.conversationHandler = new ConversationHandler({
                apiKey: process.env.OPENAI_API_KEY
            });

            this.intentRecognition = new IntentRecognition();

            // Set up wake word detection
            const initialized = await this.wakeWordDetector.initialize();
            if (initialized) {
                this.wakeWordDetector.onWakeWord(() => {
                    console.log('Wake word detected: "Hej Car"');
                    this.handleWakeWord();
                });
            } else {
                console.log('Wake word detector not initialized - using fallback detection');
            }

            this.wakeWordDetector.startListening();

            // Initialize local STT service if enabled
            if (this.useLocalSTT) {
                try {
                    console.log('🎤 Initializing local Whisper STT service...');
                    await this.localSTT.initialize();
                    console.log('✅ Local STT service ready');
                } catch (error) {
                    console.error('❌ Failed to initialize local STT:', error.message);
                    console.log('🔄 Falling back to cloud STT');
                    this.useLocalSTT = false;
                }
            }

            // Set up wake word status monitoring
            if (this.wakeWordDetector && this.wakeWordDetector.onStatusChange) {
                this.wakeWordDetector.onStatusChange((statusData) => {
                    this.currentStatus = statusData.status;
                    console.log(`🎯 Wake word status: ${statusData.visual.text}`);
                    
                    // Broadcast to connected clients
                    if (this.io) {
                        this.io.emit('wake_word_status', statusData);
                    }
                });
            }

            console.log('All services initialized successfully');
        } catch (error) {
            console.error('Failed to initialize services:', error);
            // Continue without crashing - some services may still work
        }
    }

    validateAPIKeys() {
        const requiredKeys = ['OPENAI_API_KEY'];
        const missingKeys = [];
        const warnings = [];

        // Check required keys
        for (const key of requiredKeys) {
            if (!process.env[key]) {
                missingKeys.push(key);
            }
        }

        // Check optional keys
        if (!process.env.PICOVOICE_ACCESS_KEY) {
            warnings.push('PICOVOICE_ACCESS_KEY not set - using fallback wake word detection');
        }

        if (!process.env.GOOGLE_CLOUD_KEY_FILE && !process.env.GOOGLE_CLOUD_PROJECT_ID) {
            warnings.push('Google Cloud credentials not set - speech services may not work');
        }

        if (missingKeys.length > 0) {
            console.error('❌ Missing required API keys:', missingKeys.join(', '));
            console.error('Please check your .env file and add the missing keys');
        }

        if (warnings.length > 0) {
            warnings.forEach(warning => console.warn('⚠️', warning));
        }

        console.log('✅ API key validation completed');
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });

        // Status endpoint for visual feedback
        this.app.get('/api/status', (req, res) => {
            const status = this.wakeWordDetector ? {
                listening: this.wakeWordDetector.isListening,
                status: this.currentStatus || 'listening',
                visual: this.wakeWordDetector.getVisualStatus ? 
                       this.wakeWordDetector.getVisualStatus(this.currentStatus || 'listening') : 
                       { color: '#4285f4', animation: 'pulse', text: '🎤 Listening...' }
            } : { listening: false, status: 'offline' };
            
            res.json(status);
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

        // Android Auto integration endpoints
        this.app.post('/api/voice', async (req, res) => {
            try {
                const { command, type, audioData } = req.body;
                console.log('Voice command received from Android:', command || 'audio data');
                
                let result;
                if (audioData && this.useLocalSTT) {
                    // Process audio with local STT
                    result = await this.processVoiceInput(audioData);
                } else if (command) {
                    // Process text command
                    result = await this.processTextInput(command);
                } else {
                    throw new Error('No command or audio data provided');
                }
                
                res.json({
                    success: true,
                    response: result.text || 'Command processed',
                    actions: result.actions || [],
                    audioResponse: result.audioResponse
                });
            } catch (error) {
                res.status(500).json({ error: error.message, success: false });
            }
        });

        this.app.get('/api/car/status', (req, res) => {
            try {
                // In real implementation, get actual car data
                const mockCarStatus = {
                    speed: 65,
                    fuelLevel: 75,
                    batteryLevel: 85,
                    temperature: 72,
                    location: {
                        lat: 37.7749,
                        lon: -122.4194,
                        address: "San Francisco, CA"
                    },
                    engineRunning: true,
                    doorLocked: true,
                    lightsOn: false
                };
                
                res.json({
                    success: true,
                    status: mockCarStatus
                });
            } catch (error) {
                res.status(500).json({ error: error.message, success: false });
            }
        });

        this.app.post('/api/car/action', async (req, res) => {
            try {
                const { action, params } = req.body;
                console.log('Car action requested:', action, params);
                
                // Process car action
                let response = '';
                switch (action) {
                    case 'lock_doors':
                        response = 'Doors locked';
                        break;
                    case 'unlock_doors':
                        response = 'Doors unlocked';
                        break;
                    case 'start_engine':
                        response = 'Engine started';
                        break;
                    case 'set_temperature':
                        response = `Temperature set to ${params.temperature}°F`;
                        break;
                    case 'turn_on_lights':
                        response = 'Lights turned on';
                        break;
                    case 'turn_off_lights':
                        response = 'Lights turned off';
                        break;
                    default:
                        response = `Action ${action} executed`;
                }
                
                const audioResponse = await this.textToSpeech.synthesizeCasual(response);
                
                res.json({
                    success: true,
                    response: response,
                    audioResponse: audioResponse.toString('base64')
                });
            } catch (error) {
                res.status(500).json({ error: error.message, success: false });
            }
        });

        this.app.post('/api/navigation', async (req, res) => {
            try {
                const { destination } = req.body;
                const result = await this.startNavigation(destination);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message, success: false });
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
            let speechResult;
            
            if (this.useLocalSTT && this.localSTT) {
                console.log('🎤 Using local Whisper STT...');
                // Convert audio to text using local Whisper model
                speechResult = await this.localSTT.processVoiceCommand(audioData);
                console.log('🎯 Local STT result:', speechResult);
            } else {
                console.log('🎤 Using cloud STT...');
                // Fallback to cloud STT
                speechResult = await this.speechRecognition.recognizeAudio(audioData);
            }
            
            if (!speechResult || !speechResult.success || !speechResult.text) {
                return { error: 'Could not understand audio', sttResult: speechResult };
            }

            console.log(`📝 Transcribed: "${speechResult.text}" (confidence: ${speechResult.confidence})`);
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
        this.server.listen(this.port, () => {
            console.log(`CarBot API server running on port ${this.port}`);
        });
    }

    stop() {
        if (this.wakeWordDetector) {
            this.wakeWordDetector.destroy();
        }
        console.log('CarBot API server stopped');
    }
}

module.exports = GoogleAutoAPI;