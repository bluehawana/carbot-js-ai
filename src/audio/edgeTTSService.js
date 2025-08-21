console.log(`
+++++++++++++++++++++++++++++++++++++++++
+                                       +
+    LOADING MICROSOFT EDGE TTS SERVICE  +
+                                       +
+++++++++++++++++++++++++++++++++++++++++
`);

const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const EventEmitter = require('events');

class EdgeTTSService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        console.log('[EdgeTTS] Creating Microsoft Edge TTS service...');
        
        this.options = {
            prioritizeLatency: options.prioritizeLatency !== false,
            enableCaching: options.enableCaching !== false,
            maxCacheSize: options.maxCacheSize || 100,
            cacheTimeout: options.cacheTimeout || 3600000, // 1 hour
            fallbackTimeout: options.fallbackTimeout || 3000,
            enablePreSynthesis: options.enablePreSynthesis !== false,
            adaptiveBitrate: options.adaptiveBitrate !== false,
            ...options
        };
        
        this.useFallback = false;
        this.edgeTTSAvailable = false;
        this.isInitialized = false;
        
        // Performance optimization features
        this.audioCache = new Map();
        this.preGeneratedResponses = new Map();
        this.synthesisQueue = [];
        this.isProcessingQueue = false;
        
        // Edge TTS voice profiles optimized for car environment
        this.voiceProfiles = this.initializeVoiceProfiles();
        this.currentProfile = 'default';
        
        // Performance metrics
        this.metrics = {
            edgeSynthesis: { count: 0, totalTime: 0, errors: 0 },
            systemSynthesis: { count: 0, totalTime: 0, errors: 0 },
            cacheHits: 0,
            averageLatency: 0
        };
        
        this.outputDir = options.outputDir || path.join(__dirname, '../../audio-output');
        
        this.initialize();
    }

    async initialize() {
        if (this.isInitialized) {
            console.log('[EdgeTTS] Already initialized, skipping...');
            return;
        }
        
        try {
            await this.ensureOutputDir();
            await this.initializeEdgeTTS();
            
            // Only pre-generate if TTS is working properly
            if (this.edgeTTSAvailable || await this.testSystemTTS()) {
                await this.preGenerateCommonResponses();
            } else {
                console.log('⚠️ TTS not fully available, skipping pre-generation');
                this.options.enablePreSynthesis = false;
            }
            
            this.isInitialized = true;
            console.log('✅ Edge TTS service initialized');
            
            this.emit('ready', {
                edgeTTS: this.edgeTTSAvailable,
                systemTTS: true,
                caching: this.options.enableCaching,
                preGenerated: this.preGeneratedResponses.size
            });
            
        } catch (error) {
            console.error('[EdgeTTS] Initialization error:', error.message);
            this.useFallback = true;
            this.isInitialized = true;
            this.options.enablePreSynthesis = false;
            
            console.log('🔧 Fallback mode enabled, TTS will work with reduced functionality');
            
            this.emit('ready', {
                edgeTTS: false,
                systemTTS: true,
                caching: this.options.enableCaching,
                preGenerated: 0,
                fallbackMode: true
            });
        }
    }

    async initializeEdgeTTS() {
        try {
            // Test Edge TTS availability with a quick synthesis
            await this.testEdgeConnection();
            this.edgeTTSAvailable = true;
            this.useFallback = false;
            console.log('✅ Microsoft Edge TTS available and tested');
        } catch (error) {
            console.log('⚠️ Microsoft Edge TTS not available:', error.message);
            this.edgeTTSAvailable = false;
            this.useFallback = true;
        }
    }

    async testEdgeConnection() {
        try {
            const tts = new MsEdgeTTS();
            await tts.setMetadata('en-US-AriaNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
            const readable = tts.toStream('Test');
            // Test that we can create a stream
            return true;
        } catch (error) {
            throw new Error('Edge TTS test failed: ' + error.message);
        }
    }

    initializeVoiceProfiles() {
        // High-quality Edge TTS voices optimized for different car scenarios
        return {
            default: {
                voice: 'en-US-AriaNeural', // Clear, professional female voice
                rate: '+5%', // Slightly faster for better responsiveness
                pitch: '0Hz',
                volume: '0%'
            },
            male: {
                voice: 'en-US-DavisNeural', // Deep, clear male voice for navigation
                rate: '+5%',
                pitch: '0Hz',
                volume: '0%'
            },
            navigation: {
                voice: 'en-US-JennyNeural', // Clear and authoritative for directions
                rate: '0%', // Normal speed for navigation clarity
                pitch: '0Hz',
                volume: '+10%'
            },
            emergency: {
                voice: 'en-US-GuyNeural', // Strong, clear voice for emergencies
                rate: '-15%', // Slightly slower but still urgent
                pitch: '+50Hz',
                volume: '+20%'
            },
            casual: {
                voice: 'en-US-AriaNeural', // Friendly for casual conversation
                rate: '+15%', // Moderately fast for natural conversation
                pitch: '0Hz',
                volume: '0%'
            },
            fast: {
                voice: 'en-US-JennyNeural', // Quick responses for instant feedback
                rate: '+35%', // Very fast for immediate responses
                pitch: '0Hz',
                volume: '0%'
            },
            greeting: {
                voice: 'en-US-AriaNeural', // Optimized specifically for startup greeting
                rate: '+25%', // Fast enough to reduce 3596ms delay
                pitch: '0Hz',
                volume: '+5%' // Slightly louder for car environment
            },
            slow: {
                voice: 'en-US-AriaNeural', // Slow and clear for important information
                rate: '-20%', // Less extreme slowdown for better flow
                pitch: '0Hz',
                volume: '0%'
            },
            natural: {
                voice: 'en-US-AriaNeural', // Natural pace for pre-generated responses
                rate: '+8%', // Slightly faster than normal but still natural
                pitch: '0Hz',
                volume: '0%'
            }
        };
    }

    async testSystemTTS() {
        try {
            await this.synthesizeSystemTTS("Test", 'default', false);
            return true;
        } catch (error) {
            console.warn('⚠️ System TTS test failed:', error.message);
            return false;
        }
    }

    async synthesizeSpeechForPreGeneration(text, profile = 'default') {
        try {
            if (this.edgeTTSAvailable) {
                return await this.synthesizeEdgeTTS(text, profile);
            } else {
                return await this.synthesizeSystemTTS(text, profile, false);
            }
        } catch (error) {
            console.warn(`Pre-generation synthesis failed for "${text}":`, error.message);
            return null;
        }
    }

    async preGenerateCommonResponses() {
        if (!this.options.enablePreSynthesis) {
            console.log('ℹ️ Pre-synthesis disabled, skipping pre-generation');
            return;
        }
        
        const commonResponses = [
            { text: "I understand", context: "acknowledgment" },
            { text: "Hello master, how can I help you today?", context: "startup_greeting" },
            { text: "How can I help you?", context: "greeting" },
            { text: "Navigation started", context: "navigation" },
            { text: "Music is playing", context: "music" },
            { text: "Call initiated", context: "phone" },
            { text: "I'm sorry, I didn't understand that", context: "error" },
            { text: "Please repeat your request", context: "clarification" },
            { text: "Emergency services contacted", context: "emergency" },
            { text: "Volume adjusted", context: "control" },
            { text: "Climate control activated", context: "climate" }
        ];
        
        console.log('🎯 Pre-generating common responses for instant playback...');
        
        let successCount = 0;
        let failureCount = 0;
        const maxFailures = 3;
        
        for (const response of commonResponses) {
            try {
                // Use natural profile for pre-generated responses (better for car environment)
                const audio = await Promise.race([
                    this.synthesizeSpeechForPreGeneration(response.text, 'natural'),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Pre-generation timeout')), 8000)
                    )
                ]);
                
                if (audio) {
                    this.preGeneratedResponses.set(response.text, {
                        audio: audio,
                        context: response.context,
                        generated: Date.now()
                    });
                    successCount++;
                }
            } catch (error) {
                failureCount++;
                console.warn(`Failed to pre-generate: "${response.text}" - ${error.message}`);
                
                if (failureCount >= maxFailures) {
                    console.log(`⚠️ Too many pre-generation failures (${failureCount}), stopping early`);
                    this.options.enablePreSynthesis = false;
                    break;
                }
            }
        }
        
        console.log(`✅ Pre-generated ${successCount} common responses (${failureCount} failed)`);
        
        if (successCount === 0 && failureCount > 0) {
            console.log('❌ Pre-generation completely failed, disabling pre-synthesis');
            this.options.enablePreSynthesis = false;
        }
    }

    async synthesizeSpeech(text, outputFile = null, profile = 'default', priority = 'normal') {
        if (!this.isInitialized) {
            console.log('[EdgeTTS] Initializing TTS service...');
            await this.initialize();
        }
        
        const startTime = Date.now();
        
        try {
            // Check pre-generated responses first
            const preGenerated = this.preGeneratedResponses.get(text);
            if (preGenerated && Date.now() - preGenerated.generated < this.options.cacheTimeout) {
                console.log('⚡ Using pre-generated response (instant)');
                return preGenerated.audio;
            }
            
            // Check cache
            const cacheKey = this.getCacheKey(text, profile);
            if (this.options.enableCaching) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    console.log('💾 Using cached audio');
                    this.metrics.cacheHits++;
                    return cached;
                }
            }
            
            // Choose synthesis method based on priority and availability
            let audio;
            if (this.options.prioritizeLatency || !this.edgeTTSAvailable || priority === 'urgent') {
                audio = await this.synthesizeSystemTTS(text, profile, true);
            } else {
                try {
                    audio = await this.synthesizeEdgeTTS(text, profile);
                } catch (error) {
                    console.log('🔄 Edge TTS failed, using system TTS');
                    audio = await this.synthesizeSystemTTS(text, profile, true);
                }
            }
            
            // Cache the result
            if (this.options.enableCaching && audio) {
                this.cacheAudio(cacheKey, audio);
            }
            
            // Update metrics
            const latency = Date.now() - startTime;
            this.updateLatencyMetrics(latency);
            
            if (outputFile) {
                const filePath = path.join(this.outputDir, outputFile);
                if (Buffer.isBuffer(audio)) {
                    await fs.writeFile(filePath, audio);
                }
                return filePath;
            }
            
            return audio;
            
        } catch (error) {
            console.error('TTS synthesis error:', error.message);
            this.emit('error', error);
            return null;
        }
    }

    async synthesizeEdgeTTS(text, profile = 'default') {
        const profileConfig = this.voiceProfiles[profile] || this.voiceProfiles.default;
        const optimizedText = this.optimizeTextForSpeech(text);
        
        const startTime = Date.now();
        
        try {
            console.log(`🤖 Edge TTS (${profileConfig.voice}): "${optimizedText}"`);
            
            const tts = new MsEdgeTTS();
            await tts.setMetadata(profileConfig.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
            
            // Create SSML for better voice control
            const ssml = this.createSSML(optimizedText, profileConfig);
            
            const audioBuffer = await Promise.race([
                this.synthesizeWithMSEdgeTTS(tts, ssml),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Edge TTS timeout')), this.options.fallbackTimeout)
                )
            ]);
            
            this.metrics.edgeSynthesis.count++;
            this.metrics.edgeSynthesis.totalTime += Date.now() - startTime;
            
            return audioBuffer;
            
        } catch (error) {
            this.metrics.edgeSynthesis.errors++;
            throw error;
        }
    }
    
    async synthesizeWithMSEdgeTTS(tts, ssml) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            const readable = tts.toStream(ssml);
            
            readable.on('data', (data) => {
                chunks.push(data);
            });
            
            readable.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
            
            readable.on('error', (error) => {
                reject(error);
            });
        });
    }

    createSSML(text, profileConfig) {
        return `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" version="1.0" xml:lang="en-US"><voice name="${profileConfig.voice}"><prosody rate="${profileConfig.rate}" pitch="${profileConfig.pitch}" volume="${profileConfig.volume}">${text}</prosody></voice></speak>`;
    }

    async synthesizeSystemTTS(text, profile = 'default', playback = false) {
        const profileConfig = this.voiceProfiles[profile] || this.voiceProfiles.default;
        const optimizedText = this.optimizeTextForSpeech(text);
        
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            let command;
            const platform = process.platform;
            
            // Map Edge TTS rate to system TTS rate
            const rate = this.mapEdgeRateToSystemRate(profileConfig.rate);
            
            if (platform === 'darwin') {
                const voice = 'Samantha'; // High-quality macOS voice
                command = `say -v "${voice}" -r ${rate} "${optimizedText.replace(/"/g, '\\"')}"`;
            } else if (platform === 'win32') {
                const voice = 'Microsoft Zira Desktop';
                const winRate = Math.max(-10, Math.min(10, Math.round((rate - 200) / 20)));
                const escapedText = optimizedText.replace(/'/g, "''");
                command = `powershell -Command "Add-Type -AssemblyName System.speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.SelectVoice('${voice}'); $synth.Rate = ${winRate}; $synth.Speak('${escapedText}')"`;
            } else {
                const linuxRate = Math.max(80, Math.min(400, rate));
                const pitch = 50; // Default pitch for Linux
                command = `espeak -s ${linuxRate} -p ${pitch} "${optimizedText.replace(/"/g, '\\"')}" 2>/dev/null`;
            }
            
            if (playback) {
                console.log(`🔊 System TTS (${profile}): "${optimizedText}"`);
            }
            
            const child = spawn('sh', ['-c', command]);
            
            child.on('close', (code) => {
                const latency = Date.now() - startTime;
                
                this.metrics.systemSynthesis.count++;
                this.metrics.systemSynthesis.totalTime += latency;
                
                if (code === 0) {
                    if (playback) {
                        console.log(`✅ System TTS completed (${latency}ms)`);
                    }
                    resolve(Buffer.from('system-tts-audio'));
                } else {
                    this.metrics.systemSynthesis.errors++;
                    reject(new Error(`System TTS failed with code ${code}`));
                }
            });
            
            child.on('error', (error) => {
                this.metrics.systemSynthesis.errors++;
                reject(error);
            });
        });
    }

    mapEdgeRateToSystemRate(edgeRate) {
        // Convert Edge TTS percentage rate to system rate
        const rateValue = parseInt(edgeRate.replace('%', '')) || 0;
        const baseRate = 220; // Normal conversation speed
        return Math.max(120, Math.min(400, baseRate + (rateValue * 2)));
    }

    optimizeTextForSpeech(text) {
        return text
            .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove markdown bold
            .replace(/\*([^*]+)\*/g, '$1') // Remove markdown italic
            .replace(/`([^`]+)`/g, '$1') // Remove code formatting
            .replace(/\n+/g, '. ') // Convert line breaks to periods
            .replace(/\s+/g, ' ') // Normalize spaces
            .replace(/\.\s*\./g, '.') // Remove double periods
            .replace(/([.!?])\s*([.!?])/g, '$1 $2') // Fix punctuation spacing
            .replace(/\b(http[s]?:\/\/[^\s]+)\b/g, 'link') // Replace URLs
            .trim()
            .substring(0, 500); // Edge TTS can handle longer text
    }

    // Fast playback methods for common responses
    async speakUrgent(text) {
        return await this.synthesizeSpeech(text, null, 'emergency', 'urgent');
    }

    async speakNavigation(text) {
        return await this.synthesizeSpeech(text, null, 'navigation', 'normal');
    }

    async speakCasual(text) {
        return await this.synthesizeSpeech(text, null, 'casual', 'normal');
    }

    async speakFast(text) {
        return await this.synthesizeSpeech(text, null, 'fast', 'urgent');
    }

    // Cache management
    getCacheKey(text, profile) {
        const textHash = this.simpleHash(text);
        return `${textHash}_${profile}`;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    getFromCache(key) {
        const cached = this.audioCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.options.cacheTimeout) {
            return cached.audio;
        }
        return null;
    }

    cacheAudio(key, audio) {
        if (this.audioCache.size >= this.options.maxCacheSize) {
            const oldestKey = this.audioCache.keys().next().value;
            this.audioCache.delete(oldestKey);
        }
        
        this.audioCache.set(key, {
            audio: audio,
            timestamp: Date.now()
        });
    }

    // Audio playback method
    async playAudio(audioData) {
        try {
            if (!audioData) {
                console.warn('🔇 No audio data provided for playback');
                return;
            }
            
            // If it's system TTS, audio was already played during synthesis
            if (Buffer.isBuffer(audioData) && audioData.toString() === 'system-tts-audio') {
                console.log('✅ System TTS audio already played during synthesis');
                return;
            }
            
            // For Edge TTS audio data, save and play
            if (Buffer.isBuffer(audioData)) {
                const tempFile = path.join(this.outputDir, `temp_edge_${Date.now()}.mp3`);
                await fs.writeFile(tempFile, audioData);
                
                await this.playAudioFile(tempFile);
                
                // Clean up temp file
                try {
                    await fs.unlink(tempFile);
                } catch (error) {
                    console.warn('Failed to clean up temp audio file:', error.message);
                }
                return;
            }
            
            console.log('✅ Audio playback completed');
            
        } catch (error) {
            console.error('🔊 Audio playback error:', error.message);
            throw error;
        }
    }

    async playAudioFile(filePath) {
        const platform = process.platform;
        
        return new Promise((resolve, reject) => {
            let command;
            
            if (platform === 'darwin') {
                command = `afplay "${filePath}"`;
            } else if (platform === 'win32') {
                command = `powershell -Command "(New-Object Media.SoundPlayer '${filePath}').PlaySync();"`;
            } else {
                // Linux - try multiple players
                command = `paplay "${filePath}" 2>/dev/null || aplay "${filePath}" 2>/dev/null || mpg123 "${filePath}" 2>/dev/null`;
            }
            
            const child = spawn('sh', ['-c', command]);
            
            child.on('close', (code) => {
                if (code === 0) {
                    console.log('🔊 Edge TTS audio played successfully');
                    resolve();
                } else {
                    reject(new Error(`Audio playback failed with code ${code}`));
                }
            });
            
            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    // Performance monitoring
    updateLatencyMetrics(latency) {
        if (this.metrics.averageLatency === 0) {
            this.metrics.averageLatency = latency;
        } else {
            this.metrics.averageLatency = (this.metrics.averageLatency * 0.8) + (latency * 0.2);
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            edgeTTSAvailable: this.edgeTTSAvailable,
            cacheSize: this.audioCache.size,
            preGeneratedCount: this.preGeneratedResponses.size,
            queueSize: this.synthesisQueue.length,
            averageEdgeLatency: this.metrics.edgeSynthesis.count > 0 ? 
                this.metrics.edgeSynthesis.totalTime / this.metrics.edgeSynthesis.count : 0,
            averageSystemLatency: this.metrics.systemSynthesis.count > 0 ? 
                this.metrics.systemSynthesis.totalTime / this.metrics.systemSynthesis.count : 0
        };
    }

    // Profile management
    setProfile(profileName) {
        if (this.voiceProfiles[profileName]) {
            this.currentProfile = profileName;
            console.log(`🎛️ TTS profile set to: ${profileName}`);
        } else {
            console.warn(`Unknown TTS profile: ${profileName}`);
        }
    }

    createCustomProfile(name, config) {
        this.voiceProfiles[name] = {
            ...this.voiceProfiles.default,
            ...config
        };
        console.log(`✅ Created custom TTS profile: ${name}`);
    }

    // Utility methods
    async ensureOutputDir() {
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    destroy() {
        this.audioCache.clear();
        this.preGeneratedResponses.clear();
        this.synthesisQueue.length = 0;
        this.removeAllListeners();
        console.log('🗑️ Edge TTS service destroyed');
    }
}

module.exports = EdgeTTSService;