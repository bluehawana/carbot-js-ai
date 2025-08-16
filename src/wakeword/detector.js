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
            console.log(`[WakeWordDetector] Frame length required: ${this.porcupine.frameLength}`);
            
            // Get available devices and use the first one
            const devices = PvRecorder.getAvailableDevices();
            console.log('[WakeWordDetector] Available audio devices:', devices);
            
            this.recorder = new PvRecorder(
                this.porcupine.frameLength,
                -1 // Use default audio device (index -1)
            );
            console.log('[WakeWordDetector] Audio recorder initialized with default device.');

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
            try {
                console.log('[WakeWordDetector] Starting audio recorder...');
                this.recorder.start();
                console.log('[WakeWordDetector] Audio recorder started successfully');
            } catch (error) {
                console.error('[WakeWordDetector] Failed to start audio recorder:', error);
                console.log('[WakeWordDetector] Falling back to fallback detection');
                this.initializeFallback();
                return;
            }
        }

        console.log('Started listening for wake word: "Hello My Car"');
        this.broadcastListeningStatus('listening');

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
                
                // Check if frame is valid before processing
                if (!frame || frame === undefined) {
                    // Audio recorder might not have permission or device access
                    if (!this.permissionWarningShown) {
                        console.warn('⚠️  Audio recorder not returning frames - likely microphone permission issue');
                        console.log('🔄 Falling back to fallback detection mode');
                        this.permissionWarningShown = true;
                        
                        // Switch to fallback mode
                        this.stopListening();
                        this.initializeFallback();
                        this.startListening();
                        return;
                    }
                    setTimeout(processFrame, 100);
                    return;
                }
                
                if (frame.length === 0) {
                    setTimeout(processFrame, 10);
                    return;
                }
                
                // Verify frame length matches expected
                if (frame.length !== this.porcupine.frameLength) {
                    console.warn(`Frame length mismatch: got ${frame.length}, expected ${this.porcupine.frameLength}`);
                    setTimeout(processFrame, 10);
                    return;
                }

                const keywordIndex = this.porcupine.process(frame);

                if (keywordIndex >= 0) {
                    console.log('🎯 Wake word detected: "Hello My Car"');
                    this.broadcastListeningStatus('activated');
                    if (this.callbacks.onWakeWord) {
                        this.callbacks.onWakeWord();
                    }
                } else {
                    // Periodically update listening status
                    if (Math.random() > 0.995) { // ~0.5% chance each frame
                        this.broadcastListeningStatus('listening');
                    }
                }

                // Continue processing with small delay to prevent overwhelming
                setTimeout(processFrame, 5);
            } catch (error) {
                console.error('Error processing audio frame:', error);
                
                // Try to restart recorder if it failed
                if (error.message && error.message.includes('frame')) {
                    console.log('Attempting to restart audio recorder...');
                    try {
                        this.recorder.stop();
                        setTimeout(() => {
                            if (this.isListening) {
                                this.recorder.start();
                                setTimeout(processFrame, 100);
                            }
                        }, 500);
                    } catch (restartError) {
                        console.error('Failed to restart recorder:', restartError);
                        if (this.callbacks.onError) {
                            this.callbacks.onError(error);
                        }
                    }
                } else {
                    if (this.callbacks.onError) {
                        this.callbacks.onError(error);
                    }
                    // Continue trying after error
                    setTimeout(processFrame, 100);
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
        console.log('🔄 Initializing fallback wake word detection...');
        console.log('💡 TIP: Since microphone access is not available, you can:');
        console.log('   1. Send POST request to http://localhost:3000/api/wake-word');
        console.log('   2. Or wait for the automatic test activation every 30 seconds');
        console.log('   3. Check microphone permissions in System Preferences > Security & Privacy');
        
        this.isFallback = true;
        this.audioBuffer = Buffer.alloc(0);
        this.lastAudioTime = Date.now();
        
        // Clear any existing timers
        if (this.wakeWordTimer) clearInterval(this.wakeWordTimer);
        if (this.testTimer) clearInterval(this.testTimer);
        
        // Status update timer
        this.wakeWordTimer = setInterval(() => {
            if (this.isListening) {
                console.log('🎤 Fallback mode active - listening for manual activation or API call');
                this.broadcastListeningStatus('listening');
            }
        }, 15000);
        
        // Test voice activation every 30 seconds for demo
        this.testTimer = setInterval(() => {
            if (this.isListening) {
                console.log('🎯 Auto-activating wake word for demo (every 30s)');
                console.log('💬 Say: "Hello My Car, what\'s the weather like?"');
                this.broadcastListeningStatus('activated');
                if (this.callbacks.onWakeWord) {
                    this.callbacks.onWakeWord();
                }
            }
        }, 30000);

        console.log('✅ Fallback detection initialized');
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
    
    // Manual wake word trigger for fallback mode
    triggerWakeWord(source = 'manual') {
        console.log(`🎯 Wake word triggered manually (${source})`);
        this.broadcastListeningStatus('activated');
        if (this.callbacks.onWakeWord) {
            this.callbacks.onWakeWord();
        }
        return true;
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