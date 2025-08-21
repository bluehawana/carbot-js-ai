const express = require('express');
const { Server } = require("socket.io");
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

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
            console.log('🔌 Conversation dialog connected');

            // Send current status when client connects
            socket.emit('status', {
                icon: '🎤',
                text: 'Ready - Say "Hello My Car"'
            });

            socket.on('disconnect', () => {
                console.log('🔌 Conversation dialog disconnected');
            });
        });
    }
    
    // Broadcast Android Auto popup notifications
    broadcastAndroidAutoPopup(type, message, duration = 5000) {
        const popupData = {
            type: type, // 'bot_speech', 'stt_text', 'status'
            message: message,
            duration: duration,
            timestamp: new Date().toISOString()
        };
        
        // Send to Android Auto MediaBrowserService
        if (this.io) {
            this.io.emit('android_auto_popup', popupData);
        }
        
        console.log(`📱 Android Auto Popup [${type}]: "${message}"`);
    }
    
    broadcastStatus(icon, text) {
        if (this.io) {
            this.io.emit('status', {
                icon: icon,
                text: text,
                timestamp: new Date().toISOString()
            });
        }
    }

    setupMiddleware() {
        // Configure helmet with relaxed CSP for conversation dialog
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrcAttr: ["'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https:"],
                    imgSrc: ["'self'", "data:"],
                    connectSrc: ["'self'", "ws:", "wss:"],
                    fontSrc: ["'self'", "https:", "data:"],
                },
            },
        }));
        
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
                    console.log('Wake word detected: "Hello My Car"');
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

    estimateSpeechDuration(text) {
        // Estimate speech duration at ~220 WPM (natural conversation speed)
        const words = text.split(' ').length;
        const durationMs = (words * 270); // 270ms per word for natural speech
        return Math.max(2000, Math.min(8000, durationMs)); // 2-8 seconds range
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
                    
                    // Show STT text popup for user confirmation
                    this.broadcastAndroidAutoPopup('stt_text', 'Hello My Car', 2000);
                    
                    // Show CarBot response popup after brief delay (reduced timing for better UX)
                    setTimeout(() => {
                        this.broadcastAndroidAutoPopup('bot_speech', 'Hello master, what can I do for you today?', 3000);
                    }, 500); // Reduced from 1000ms to 500ms
                    
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
        
        // Voice command endpoints (both paths for compatibility)
        const handleVoiceCommand = (req, res) => {
            try {
                const { command } = req.body;
                if (!command) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Command text is required' 
                    });
                }
                
                console.log(`🎤 Received voice command: "${command}"`);
                
                // Show STT text popup immediately
                this.broadcastAndroidAutoPopup('stt_text', command, 2000);
                
                // Process the command through the car system
                if (this.carSystem) {
                    this.carSystem.handleVoiceCommand(command)
                        .then(response => {
                            // Show CarBot response popup with auto-dismiss based on speech length
                            const speechDuration = this.estimateSpeechDuration(response.content);
                            this.broadcastAndroidAutoPopup('bot_speech', response.content, speechDuration);
                            
                            res.json({
                                success: true,
                                command: command,
                                response: response.content,
                                audioResponse: response.audioResponse,
                                timestamp: new Date().toISOString()
                            });
                        })
                        .catch(error => {
                            console.error('Voice command processing error:', error);
                            this.broadcastAndroidAutoPopup('bot_speech', 'Sorry, I encountered an error processing that command.', 3000);
                            
                            res.status(500).json({
                                success: false,
                                error: error.message
                            });
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
        };
        
        this.app.post('/api/voice-command', handleVoiceCommand);
        this.app.post('/api/voice', handleVoiceCommand); // Android compatibility

        // Android Auto popup notification endpoint
        this.app.post('/api/show-popup', (req, res) => {
            const { type, message, duration } = req.body;
            
            // Broadcast to Android Auto clients
            this.broadcastAndroidAutoPopup(type, message, duration);
            
            res.json({
                success: true,
                type: type,
                message: message,
                timestamp: new Date().toISOString()
            });
        });
        
        // Legacy test interface
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
            cursor: pointer;
            transition: background 0.2s;
        }
        .command:hover {
            background: rgba(255, 255, 255, 0.2);
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
        
        <div style="margin: 20px 0;">
            <input type="text" id="voiceCommand" placeholder="Type your voice command..." 
                   style="width: 100%; padding: 15px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.3); 
                          background: rgba(255,255,255,0.1); color: white; font-size: 1.1em;"
                   onkeypress="if(event.key==='Enter') sendVoiceCommand()">
            <button class="trigger-btn" onclick="sendVoiceCommand()" style="margin-top: 10px;">
                <span class="icon">💬</span>Send Voice Command
            </button>
        </div>
        
        <div id="status" class="status">
            Ready to trigger wake word...
        </div>
        
        <div class="commands">
            <h3>🎯 Example Voice Commands to Try:</h3>
            <div class="command" onclick="document.getElementById('voiceCommand').value='What\\'s the weather like?'">💬 "What's the weather like?"</div>
            <div class="command" onclick="document.getElementById('voiceCommand').value='Navigate to the nearest gas station'">🧭 "Navigate to the nearest gas station"</div>
            <div class="command" onclick="document.getElementById('voiceCommand').value='Play some music'">🎵 "Play some music"</div>
            <div class="command" onclick="document.getElementById('voiceCommand').value='Call John'">📞 "Call John"</div>
            <div class="command" onclick="document.getElementById('voiceCommand').value='Set temperature to 72 degrees'">🌡️ "Set temperature to 72 degrees"</div>
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
        
        async function sendVoiceCommand() {
            const input = document.getElementById('voiceCommand');
            const command = input.value.trim();
            const status = document.getElementById('status');
            
            if (!command) {
                status.innerHTML = '❌ Please enter a voice command';
                return;
            }
            
            const btns = document.querySelectorAll('.trigger-btn');
            const commandBtn = btns[1]; // Second button is the command button
            commandBtn.disabled = true;
            commandBtn.innerHTML = '<span class="icon">⏳</span>Processing...';
            status.innerHTML = \`🎤 Processing: "\${command}"\`;
            
            try {
                const response = await fetch('/api/voice-command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: command })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    status.innerHTML = \`✅ CarBot: "\${result.response}"\`;
                    input.value = ''; // Clear input
                } else {
                    throw new Error(result.error || 'Failed to process command');
                }
            } catch (error) {
                status.innerHTML = '❌ Error: ' + error.message;
            } finally {
                commandBtn.disabled = false;
                commandBtn.innerHTML = '<span class="icon">💬</span>Send Voice Command';
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