console.log(`
+++++++++++++++++++++++++++++++++++++++++
+                                       +
+   LOADING OPTIMIZED EDGE TTS SERVICE   +
+                                       +
+++++++++++++++++++++++++++++++++++++++++
`);

const EdgeTTSService = require('./edgeTTSService');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const EventEmitter = require('events');

class OptimizedTextToSpeechService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        console.log('[OptimizedTTS] Creating optimized Edge TTS service...');
        
        this.options = {
            prioritizeLatency: options.prioritizeLatency !== false,
            enableCaching: options.enableCaching !== false,
            maxCacheSize: options.maxCacheSize || 100,
            cacheTimeout: options.cacheTimeout || 3600000, // 1 hour
            fallbackTimeout: options.fallbackTimeout || 3000, // 3 seconds for cloud TTS
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
        
        // System TTS optimization
        this.systemTTSProfiles = this.initializeSystemProfiles();
        this.currentProfile = 'default';
        
        // Performance metrics
        this.metrics = {
            edgeSynthesis: { count: 0, totalTime: 0, errors: 0 },
            systemSynthesis: { count: 0, totalTime: 0, errors: 0 },
            cacheHits: 0,
            averageLatency: 0
        };
        
        // Initialize Edge TTS service
        this.edgeTTS = new EdgeTTSService(options);
        
        this.outputDir = options.outputDir || path.join(__dirname, '../../audio-output');
        
        this.initialize();
    }

    async initialize() {
        if (this.isInitialized) {
            console.log('[OptimizedTTS] Already initialized, skipping...');
            return;
        }
        
        try {
            await this.ensureOutputDir();
            await this.initializeEdgeTTS();
            await this.optimizeSystemTTS();
            
            // Only pre-generate if TTS is working properly
            if (this.edgeTTSAvailable || await this.testSystemTTS()) {
                await this.preGenerateCommonResponses();
            } else {
                console.log('⚠️ TTS not fully available, skipping pre-generation');
                this.options.enablePreSynthesis = false;
            }
            
            this.isInitialized = true;
            console.log('✅ Optimized TTS service initialized');
            
            this.emit('ready', {
                edgeTTS: this.edgeTTSAvailable,
                systemTTS: true,
                caching: this.options.enableCaching,
                preGenerated: this.preGeneratedResponses.size
            });
            
        } catch (error) {
            console.error('[OptimizedTTS] Initialization error:', error.message);
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
            // Edge TTS doesn't require credentials - it's free!
            await this.edgeTTS.initialize();
            this.edgeTTSAvailable = true;
            this.useFallback = false;
            console.log('✅ Microsoft Edge TTS available and tested (FREE)');
        } catch (error) {
            console.log('⚠️ Microsoft Edge TTS not available:', error.message);
            this.edgeTTSAvailable = false;
            this.useFallback = true;
        }
    }


    initializeSystemProfiles() {
        const platform = process.platform;
        
        const profiles = {
            default: { rate: 230, volume: 0.8, pitch: 0 }, // Slightly faster default
            fast: { rate: 320, volume: 0.9, pitch: 2 }, // Much faster for urgent responses
            slow: { rate: 180, volume: 0.8, pitch: -2 }, // Less extreme slowdown
            navigation: { rate: 210, volume: 1.0, pitch: 0 }, // Optimal for car navigation
            emergency: { rate: 190, volume: 1.0, pitch: 0 }, // Clear but not too slow for emergencies
            casual: { rate: 250, volume: 0.7, pitch: 0 }, // Faster for natural conversation
            greeting: { rate: 280, volume: 0.85, pitch: 1 }, // Optimized for startup greeting speed
            natural: { rate: 240, volume: 0.8, pitch: 0 } // Natural pace for pre-generated responses
        };
        
        // Platform-specific optimizations
        if (platform === 'darwin') {
            profiles.default.voice = 'Samantha';
            profiles.fast.voice = 'Alex';
            profiles.navigation.voice = 'Victoria';
        } else if (platform === 'win32') {
            profiles.default.voice = 'Microsoft Zira Desktop';
            profiles.navigation.voice = 'Microsoft David Desktop';
        }
        
        return profiles;
    }

    async optimizeSystemTTS() {
        // Pre-warm system TTS by testing different voices and speeds
        const testPhrase = "System optimization test";
        
        try {
            await this.synthesizeSystemTTS(testPhrase, 'fast', false);
            console.log('🔧 System TTS optimized and pre-warmed');
        } catch (error) {
            console.warn('⚠️ System TTS optimization failed:', error.message);
        }
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
            // Simplified synthesis for pre-generation (no caching, no complex checks)
            if (this.edgeTTSAvailable) {
                return await this.edgeTTS.synthesizeSpeech(text, null, profile);
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
        const maxFailures = 3; // Stop if too many failures
        
        for (const response of commonResponses) {
            try {
                // Add timeout to prevent hanging
                // Use natural profile for pre-generated responses (better for car environment)
                const audio = await Promise.race([
                    this.synthesizeSpeechForPreGeneration(response.text, 'natural'),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Pre-generation timeout')), 5000)
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
                
                // Stop pre-generation if too many failures
                if (failureCount >= maxFailures) {
                    console.log(`⚠️ Too many pre-generation failures (${failureCount}), stopping early`);
                    this.options.enablePreSynthesis = false;
                    break;
                }
            }
        }
        
        console.log(`✅ Pre-generated ${successCount} common responses (${failureCount} failed)`);
        
        // Disable pre-synthesis if success rate is too low
        if (successCount === 0 && failureCount > 0) {
            console.log('❌ Pre-generation completely failed, disabling pre-synthesis');
            this.options.enablePreSynthesis = false;
        }
    }

    async synthesizeSpeech(text, outputFile = null, profile = 'default', priority = 'normal') {
        if (!this.isInitialized) {
            console.log('[OptimizedTTS] Initializing TTS service...');
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
            
            // Choose synthesis method based on priority and latency requirements
            let audio;
            if (this.options.prioritizeLatency || !this.edgeTTSAvailable || priority === 'urgent') {
                audio = await this.synthesizeSystemTTS(text, profile, true);
            } else {
                try {
                    audio = await this.edgeTTS.synthesizeSpeech(text, null, profile);
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


    async synthesizeSystemTTS(text, profile = 'default', playback = false) {
        const profileConfig = this.systemTTSProfiles[profile] || this.systemTTSProfiles.default;
        const optimizedText = this.optimizeTextForSpeech(text);
        
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            let command;
            const platform = process.platform;
            
            if (platform === 'darwin') {
                const voice = profileConfig.voice || 'Samantha';
                const rate = Math.max(120, Math.min(400, profileConfig.rate));
                command = `say -v "${voice}" -r ${rate} "${optimizedText.replace(/"/g, '\\"')}"`;
            } else if (platform === 'win32') {
                const voice = profileConfig.voice || 'Microsoft Zira Desktop';
                const rate = Math.max(-10, Math.min(10, Math.round((profileConfig.rate - 200) / 20)));
                const escapedText = optimizedText.replace(/'/g, "''");
                command = `powershell -Command "Add-Type -AssemblyName System.speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.SelectVoice('${voice}'); $synth.Rate = ${rate}; $synth.Speak('${escapedText}')"`;
            } else {
                const rate = Math.max(80, Math.min(400, profileConfig.rate));
                const pitch = Math.max(0, Math.min(100, 50 + profileConfig.pitch * 10));
                command = `espeak -s ${rate} -p ${pitch} "${optimizedText.replace(/"/g, '\\"')}" 2>/dev/null`;
            }
            
            if (playback) {
                console.log(`🔊 System TTS (${profile}): "${optimizedText}"`);
            }
            
            const child = spawn('sh', ['-c', command]);
            let output = '';
            
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
            .substring(0, 300); // Limit length for faster processing
    }


    mapVolumeToDb(volume) {
        // Map volume (0-1) to dB (-20 to +6)
        return Math.max(-20, Math.min(6, (volume - 0.5) * 26));
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
            // Remove oldest cache entry
            const oldestKey = this.audioCache.keys().next().value;
            this.audioCache.delete(oldestKey);
        }
        
        this.audioCache.set(key, {
            audio: audio,
            timestamp: Date.now()
        });
    }

    // Queue management for batch processing
    async queueSynthesis(requests) {
        this.synthesisQueue.push(...requests);
        
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.synthesisQueue.length === 0) {
            this.isProcessingQueue = false;
            return;
        }
        
        this.isProcessingQueue = true;
        const batch = this.synthesisQueue.splice(0, 5); // Process 5 at a time
        
        const promises = batch.map(async (request) => {
            try {
                const audio = await this.synthesizeSpeech(
                    request.text, 
                    request.outputFile, 
                    request.profile, 
                    request.priority
                );
                
                if (request.callback) {
                    request.callback(null, audio);
                }
                
                return audio;
            } catch (error) {
                if (request.callback) {
                    request.callback(error, null);
                }
                console.error('Queue processing error:', error);
            }
        });
        
        await Promise.all(promises);
        
        // Continue processing queue
        setTimeout(() => this.processQueue(), 100);
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
        const edgeMetrics = this.edgeTTS ? this.edgeTTS.getMetrics() : {};
        return {
            ...this.metrics,
            edgeTTSAvailable: this.edgeTTSAvailable,
            cacheSize: this.audioCache.size,
            preGeneratedCount: this.preGeneratedResponses.size,
            queueSize: this.synthesisQueue.length,
            averageEdgeLatency: edgeMetrics.averageEdgeLatency || 0,
            averageSystemLatency: this.metrics.systemSynthesis.count > 0 ? 
                this.metrics.systemSynthesis.totalTime / this.metrics.systemSynthesis.count : 0
        };
    }

    // Profile management
    setProfile(profileName) {
        if (this.systemTTSProfiles[profileName]) {
            this.currentProfile = profileName;
            console.log(`🎛️ TTS profile set to: ${profileName}`);
        } else {
            console.warn(`Unknown TTS profile: ${profileName}`);
        }
    }

    createCustomProfile(name, config) {
        this.systemTTSProfiles[name] = {
            ...this.systemTTSProfiles.default,
            ...config
        };
        console.log(`✅ Created custom TTS profile: ${name}`);
    }

    // Audio playback method - the missing critical component
    async playAudio(audioData) {
        try {
            if (!audioData) {
                console.warn('🔇 No audio data provided for playback');
                return;
            }
            
            // If it's pre-generated system TTS, the audio was already played during synthesis
            if (Buffer.isBuffer(audioData) && audioData.toString() === 'system-tts-audio') {
                console.log('✅ System TTS audio already played during synthesis');
                return;
            }
            
            // For Cloud TTS MP3 data, save and play
            if (Buffer.isBuffer(audioData)) {
                const tempFile = path.join(this.outputDir, `temp_${Date.now()}.mp3`);
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
                    console.log('🔊 Audio file played successfully');
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

    // Adaptive optimization based on performance
    async adaptiveOptimization() {
        const metrics = this.getMetrics();
        
        // If system TTS is significantly faster, prefer it
        if (metrics.averageSystemLatency < metrics.averageEdgeLatency * 0.5) {
            this.options.prioritizeLatency = true;
            console.log('🔧 Adaptive optimization: Prioritizing system TTS for speed');
        }
        
        // Adjust cache size based on hit rate
        const hitRate = metrics.cacheHits / (metrics.edgeSynthesis.count + metrics.systemSynthesis.count);
        if (hitRate < 0.1 && this.options.maxCacheSize > 50) {
            this.options.maxCacheSize = 50;
            console.log('🔧 Adaptive optimization: Reducing cache size due to low hit rate');
        }
    }

    destroy() {
        this.audioCache.clear();
        this.preGeneratedResponses.clear();
        this.synthesisQueue.length = 0;
        if (this.edgeTTS) {
            this.edgeTTS.destroy();
        }
        this.removeAllListeners();
        console.log('🗑️ Optimized Edge TTS service destroyed');
    }
}

module.exports = OptimizedTextToSpeechService;