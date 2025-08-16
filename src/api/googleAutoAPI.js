const express = require('express');
const { Server } = require("socket.io");
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');

class GoogleAutoAPI {
    constructor(carSystem, options = {}) {
        this.carSystem = carSystem;
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
        
        // Manual wake word trigger for testing/fallback mode
        this.app.post('/api/wake-word', (req, res) => {
            try {
                if (this.carSystem && this.carSystem.triggerWakeWord) {
                    const success = this.carSystem.triggerWakeWord('api');
                    res.json({ 
                        success: true, 
                        message: 'Wake word triggered successfully',
                        timestamp: new Date().toISOString()
                    });
                } else {
                    res.status(500).json({ 
                        success: false, 
                        error: 'Car system not available' 
                    });
                }
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });
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