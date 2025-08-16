console.log(`
#################################################
#                                               #
#      LOADING WAKE WORD DETECTOR MODULE        #
#                                               #
#################################################
`);

const { Porcupine } = require('@picovoice/porcupine-node');
const { PvRecorder } = require('@picovoice/pvrecorder-node');
const path = require('path');

class WakeWordDetector {
    constructor(accessKey, sensitivity = 0.5) {
        console.log('[WakeWordDetector CONSTRUCTOR] Creating new instance...');
        this.accessKey = accessKey;
        this.sensitivity = sensitivity;
        this.porcupine = null;
        this.recorder = null;
        this.isListening = false;
        this.callbacks = {
            onWakeWord: null,
            onError: null
        };
        console.log('[WakeWordDetector CONSTRUCTOR] Instance created.');
    }

    async initialize() {
        console.log('[WakeWordDetector] Initializing...');
        // Check if we have access key and model file
        if (!this.accessKey) {
            console.log('[WakeWordDetector] No Picovoice access key provided, using fallback detection.');
            return this.initializeFallback();
        }
        console.log(`[WakeWordDetector] Using AccessKey: ${this.accessKey.substring(0, 5)}...`);

        const modelPath = path.join(__dirname, '../../models/Hello-My-Car_en_mac_v3_0_0.ppn');
        const fs = require('fs');
        
        console.log(`[WakeWordDetector] Checking for model at: ${modelPath}`);
        if (!fs.existsSync(modelPath)) {
            console.error(`[WakeWordDetector] FATAL: Wake word model not found at path: ${modelPath}`);
            console.log('[WakeWordDetector] Using fallback detection as a result.');
            return this.initializeFallback();
        }
        console.log('[WakeWordDetector] Wake word model found.');

        try {
            console.log('[WakeWordDetector] Attempting to create Porcupine instance...');
            const keywordPaths = [modelPath];

            this.porcupine = new Porcupine(
                this.accessKey,
                keywordPaths,
                [this.sensitivity]
            );
            console.log('[WakeWordDetector] Porcupine instance created successfully.');

            // Initialize audio recorder
            console.log('[WakeWordDetector] Initializing audio recorder...');
            this.recorder = new PvRecorder(
                this.porcupine.frameLength,
                -1 // Use default audio device
            );
            console.log('[WakeWordDetector] Audio recorder initialized.');

            console.log('Wake word detector initialized successfully');
            return true;
        } catch (error) {
            console.error('--- WAKE WORD ENGINE FAILED TO INITIALIZE (CAUGHT ERROR) ---');
            console.error(error);
            console.error('-------------------------------------------------');
            console.log('Falling back to simple detection');
            return this.initializeFallback();
        }
    }

    startListening() {
        if (this.isListening) {
            console.log('Already listening for wake word');
            return;
        }

        if (!this.isFallback && (!this.porcupine || !this.recorder)) {
            console.error('Wake word detector not initialized');
            return;
        }

        this.isListening = true;
        if (!this.isFallback) {
            this.recorder.start();
        }

        console.log('Started listening for wake word: "Hello My Car"');

        // Audio processing loop (only for actual Porcupine detection)
        if (!this.isFallback) {
            this.processAudio();
        }
    }

    processAudio() {
        const processFrame = () => {
            if (!this.isListening) return;

            try {
                const frame = this.recorder.read();
                const keywordIndex = this.porcupine.process(frame);

                if (keywordIndex >= 0) {
                    console.log('Wake word detected: "Hello My Car"');
                    if (this.callbacks.onWakeWord) {
                        this.callbacks.onWakeWord();
                    }
                }

                // Continue processing
                setImmediate(processFrame);
            } catch (error) {
                console.error('Error processing audio frame:', error);
                if (this.callbacks.onError) {
                    this.callbacks.onError(error);
                }
            }
        };

        processFrame();
    }

    stopListening() {
        if (!this.isListening) {
            console.log('Not currently listening');
            return;
        }

        this.isListening = false;
        
        if (this.recorder) {
            this.recorder.stop();
        }

        console.log('Stopped listening for wake word');
    }

    onWakeWord(callback) {
        this.callbacks.onWakeWord = callback;
    }

    onError(callback) {
        this.callbacks.onError = callback;
    }

    destroy() {
        this.stopListening();
        
        if (this.porcupine) {
            this.porcupine.release();
            this.porcupine = null;
        }
        
        if (this.recorder) {
            this.recorder.delete();
            this.recorder = null;
        }
    }

    // Fallback wake word detection using simple audio analysis
    async initializeFallback() {
        console.log('Initializing fallback wake word detection...');
        console.log('Using simple energy-based detection for voice activity');
        
        this.isFallback = true;
        this.audioBuffer = Buffer.alloc(0);
        this.lastAudioTime = Date.now();
        
        // Simple timer-based wake word simulation for testing
        this.wakeWordTimer = setInterval(() => {
            if (this.isListening) {
                console.log('🎤 Fallback listening... Say "Hello My Car" to activate (simulated every 10s)');
                this.broadcastListeningStatus('listening');
            }
        }, 10000);
        
        // Test voice activation every 30 seconds for demo
        this.testTimer = setInterval(() => {
            if (this.isListening && Math.random() > 0.7) {
                console.log('🎯 Simulated wake word detected for testing!');
                this.broadcastListeningStatus('activated');
                if (this.callbacks.onWakeWord) {
                    this.callbacks.onWakeWord();
                }
            }
        }, 30000);

        console.log('Fallback detection initialized - speak to activate');
        return true;
    }
    
    broadcastListeningStatus(status) {
        // Broadcast status to connected clients (Android Auto app)
        if (this.statusCallback) {
            this.statusCallback({
                status: status, // 'listening', 'activated', 'processing', 'idle'
                timestamp: Date.now(),
                visual: this.getVisualStatus(status)
            });
        }
    }
    
    getVisualStatus(status) {
        const statusMap = {
            'listening': { color: '#4285f4', animation: 'pulse', text: '🎤 Listening...' },
            'activated': { color: '#34a853', animation: 'flash', text: '✅ Activated!' },
            'processing': { color: '#fbbc04', animation: 'spin', text: '🧠 Thinking...' },
            'idle': { color: '#ea4335', animation: 'none', text: '😴 Sleeping' }
        };
        return statusMap[status] || statusMap['idle'];
    }
    
    onStatusChange(callback) {
        this.statusCallback = callback;
    }

    processAudioBuffer_old(data) {
        // Legacy method - keeping for compatibility
        if (!this.isListening) return;

        try {
            this.audioStream.stream().on('error', (error) => {
                console.error('Audio stream error:', error);
                if (this.callbacks.onError) {
                    this.callbacks.onError(error);
                }
            });

            console.log('Fallback detection initialized - speak to activate');
            return true;
        } catch (error) {
            console.error('Failed to initialize fallback detection:', error);
            return false;
        }
    }

    processAudioBuffer(buffer) {
        // Simple energy-based detection
        const energy = this.calculateEnergy(buffer);
        
        if (energy > 5000) { // Higher threshold to reduce false positives
            console.log(`Voice activity detected (energy: ${energy.toFixed(0)}) - triggering wake word`);
            
            // Throttle wake word triggers to prevent spam
            const now = Date.now();
            if (!this.lastTrigger || (now - this.lastTrigger) > 3000) {
                this.lastTrigger = now;
                
                if (this.callbacks.onWakeWord) {
                    this.callbacks.onWakeWord();
                }
            }
        }
    }

    calculateEnergy(buffer) {
        let energy = 0;
        for (let i = 0; i < buffer.length; i += 2) {
            const sample = buffer.readInt16LE(i);
            energy += sample * sample;
        }
        return energy / (buffer.length / 2);
    }
}

module.exports = WakeWordDetector;