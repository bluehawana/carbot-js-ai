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
        
        // Browser-based wake word trigger interface
        this.app.get('/test-wake-word', (req, res) => {
            res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>CarBot Wake Word Test</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px; 
            margin: 50px auto; 
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        h1 { 
            text-align: center; 
            margin-bottom: 30px;
            font-size: 2.5em;
        }
        .trigger-btn {
            background: linear-gradient(45deg, #FF6B6B, #4ECDC4);
            border: none;
            color: white;
            padding: 20px 40px;
            font-size: 1.2em;
            border-radius: 50px;
            cursor: pointer;
            width: 100%;
            margin: 10px 0;
            transition: transform 0.2s, box-shadow 0.2s;
            font-weight: bold;
        }
        .trigger-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
        .trigger-btn:active {
            transform: translateY(0);
        }
        .status {
            margin: 20px 0;
            padding: 15px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.1);
            border-left: 4px solid #4ECDC4;
        }
        .commands {
            margin-top: 30px;
            padding: 20px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 10px;
        }
        .command {
            background: rgba(255, 255, 255, 0.1);
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
            font-family: monospace;
        }
        .icon { font-size: 1.5em; margin-right: 10px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🚗 CarBot Wake Word Test</h1>
        
        <button class="trigger-btn" onclick="triggerWakeWord()">
            <span class="icon">🎤</span>Trigger "Hello My Car"
        </button>
        
        <div id="status" class="status">
            Ready to trigger wake word...
        </div>
        
        <div class="commands">
            <h3>🎯 Example Voice Commands to Try:</h3>
            <div class="command">💬 "What's the weather like?"</div>
            <div class="command">🧭 "Navigate to the nearest gas station"</div>
            <div class="command">🎵 "Play some music"</div>
            <div class="command">📞 "Call John"</div>
            <div class="command">🌡️ "Set temperature to 72 degrees"</div>
        </div>
        
        <div style="margin-top: 30px; text-align: center; opacity: 0.8;">
            <p>💡 This triggers the same wake word as saying "Hello My Car"</p>
            <p>🔄 Auto-demo triggers every 45 seconds if you prefer to wait</p>
        </div>
    </div>

    <script>
        async function triggerWakeWord() {
            const btn = document.querySelector('.trigger-btn');
            const status = document.getElementById('status');
            
            btn.disabled = true;
            btn.innerHTML = '<span class="icon">⏳</span>Triggering...';
            status.innerHTML = '🎯 Activating wake word...';
            
            try {
                const response = await fetch('/api/wake-word', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const result = await response.json();
                
                if (result.success) {
                    status.innerHTML = '✅ Wake word activated! CarBot is now listening...';
                    btn.innerHTML = '<span class="icon">✅</span>Activated Successfully!';
                    
                    setTimeout(() => {
                        btn.disabled = false;
                        btn.innerHTML = '<span class="icon">🎤</span>Trigger "Hello My Car"';
                        status.innerHTML = 'Ready to trigger wake word again...';
                    }, 3000);
                } else {
                    throw new Error(result.error || 'Failed to trigger wake word');
                }
            } catch (error) {
                status.innerHTML = '❌ Error: ' + error.message;
                btn.disabled = false;
                btn.innerHTML = '<span class="icon">🎤</span>Trigger "Hello My Car"';
            }
        }
        
        // Auto-refresh status every 5 seconds
        setInterval(() => {
            const now = new Date().toLocaleTimeString();
            if (document.getElementById('status').innerHTML.includes('Ready')) {
                document.getElementById('status').innerHTML = 'Ready to trigger wake word... (' + now + ')';
            }
        }, 5000);
    </script>
</body>
</html>
            `);
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