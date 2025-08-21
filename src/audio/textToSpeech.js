console.log(`
+++++++++++++++++++++++++++++++++++++++++
+                                       +
+    LOADING MICROSOFT EDGE TTS MODULE   +
+                                       +
+++++++++++++++++++++++++++++++++++++++++
`);

const EdgeTTSService = require('./edgeTTSService');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

class TextToSpeechService {
    constructor(options = {}) {
        console.log('[TextToSpeechService CONSTRUCTOR] Creating new Edge TTS instance...');
        
        this.useFallback = false;
        
        try {
            // Initialize Microsoft Edge TTS (FREE - no credentials needed!)
            this.edgeTTS = new EdgeTTSService(options);
            console.log('✅ Microsoft Edge TTS initialized (FREE)');
            
            // Edge TTS voice configuration (much better than Google Cloud!)
            this.voiceProfile = options.voiceProfile || 'default';
            this.voice = options.voice || 'en-US-AriaNeural';
            this.rate = options.rate || '0%';
            this.pitch = options.pitch || '0%';
            this.volume = options.volume || '0%';
            
            this.outputDir = options.outputDir || path.join(__dirname, '../../audio-output');
            this.ensureOutputDir();
            console.log('[TextToSpeechService CONSTRUCTOR] Edge TTS instance created successfully.');
        } catch (error) {
            console.error('[TextToSpeechService CONSTRUCTOR] Error with Edge TTS, using fallback:', error.message);
            this.useFallback = true;
        }
    }

    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async synthesizeSpeech(text, outputFile = null) {
        try {
            if (this.useFallback) {
                return await this.synthesizeFallback(text, outputFile);
            }
            
            console.log('🤖 Synthesizing speech with Edge TTS (FREE):', text);
            const audioContent = await this.edgeTTS.synthesizeSpeech(text, outputFile, this.voiceProfile);
            
            if (outputFile) {
                const filePath = path.join(this.outputDir, outputFile);
                if (Buffer.isBuffer(audioContent)) {
                    fs.writeFileSync(filePath, audioContent, 'binary');
                    console.log(`Audio content written to file: ${filePath}`);
                }
                return filePath;
            }
            
            return audioContent;
        } catch (error) {
            console.error('Edge TTS error:', error);
            console.log('🔄 Falling back to system TTS');
            this.useFallback = true;
            return await this.synthesizeFallback(text, outputFile);
        }
    }
    
    async synthesizeFallback(text, outputFile = null) {
        try {
            console.log('🔊 Using system TTS for synthesis:', text);
            
            // Store the text for later playback
            this.lastSpokenText = text;
            
            if (outputFile) {
                const filePath = path.join(this.outputDir, outputFile);
                return filePath;
            }
            
            // For direct playback, return a placeholder with the text encoded
            return Buffer.from('fallback-audio');
        } catch (error) {
            console.error('Fallback TTS error:', error);
            return null;
        }
    }

    async synthesizeSSML(ssml, outputFile = null) {
        try {
            console.log('🤖 Synthesizing SSML with Edge TTS:', ssml);
            
            // Extract text from SSML for Edge TTS
            const textContent = this.extractTextFromSSML(ssml);
            return await this.synthesizeSpeech(textContent, outputFile);
        } catch (error) {
            console.error('SSML synthesis error:', error);
            throw error;
        }
    }
    
    extractTextFromSSML(ssml) {
        // Simple SSML text extraction
        return ssml
            .replace(/<[^>]*>/g, '') // Remove all XML tags
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();
    }

    async getVoices() {
        // Return available Edge TTS voices
        return [
            { name: 'en-US-AriaNeural', gender: 'FEMALE', description: 'High-quality female voice' },
            { name: 'en-US-DavisNeural', gender: 'MALE', description: 'Deep, clear male voice' },
            { name: 'en-US-JennyNeural', gender: 'FEMALE', description: 'Clear and authoritative' },
            { name: 'en-US-GuyNeural', gender: 'MALE', description: 'Strong, clear voice' },
            { name: 'en-US-AndrewNeural', gender: 'MALE', description: 'Natural male voice' },
            { name: 'en-US-EmmaNeural', gender: 'FEMALE', description: 'Warm female voice' },
            { name: 'en-US-BrianNeural', gender: 'MALE', description: 'Professional male voice' },
            { name: 'en-US-AvaNeural', gender: 'FEMALE', description: 'Young adult female voice' }
        ];
    }

    setVoice(voice) {
        if (typeof voice === 'string') {
            this.voice = voice;
        } else {
            this.voice = voice.name || voice.voice || 'en-US-AriaNeural';
        }
        console.log(`🎤 Voice set to: ${this.voice}`);
    }

    setVoiceProfile(profile) {
        this.voiceProfile = profile;
        console.log(`🎛️ Voice profile set to: ${profile}`);
    }

    setRate(rate) {
        this.rate = rate;
        console.log(`⚡ Speech rate set to: ${rate}`);
    }

    // Create SSML with car-specific context
    createCarContextSSML(text, context = {}) {
        const { speed = 'medium', emphasis = 'none', volume = 'medium' } = context;
        
        let ssml = '<speak>';
        
        // Add prosody for car environment
        ssml += `<prosody rate="${speed}" volume="${volume}">`;
        
        if (emphasis !== 'none') {
            ssml += `<emphasis level="${emphasis}">`;
        }
        
        ssml += text;
        
        if (emphasis !== 'none') {
            ssml += '</emphasis>';
        }
        
        ssml += '</prosody>';
        ssml += '</speak>';
        
        return ssml;
    }

    // Emergency/urgent announcements
    async synthesizeUrgent(text, outputFile = null) {
        return await this.edgeTTS.speakUrgent(text);
    }

    // Navigation announcements
    async synthesizeNavigation(text, outputFile = null) {
        return await this.edgeTTS.speakNavigation(text);
    }

    // Casual conversation
    async synthesizeCasual(text, outputFile = null) {
        return await this.edgeTTS.speakCasual(text);
    }

    // Play audio using Edge TTS or system audio player
    async playAudio(audioContent) {
        try {
            if (this.useFallback || (audioContent && audioContent.toString() === 'fallback-audio')) {
                return await this.playAudioFallback(this.lastSpokenText || 'Response generated');
            }
            
            // Use Edge TTS service's optimized audio playback
            if (this.edgeTTS) {
                return await this.edgeTTS.playAudio(audioContent);
            }
            
            // Fallback to basic playback
            const tempFile = path.join(this.outputDir, `temp_${Date.now()}.mp3`);
            fs.writeFileSync(tempFile, audioContent, 'binary');
            
            const { exec } = require('child_process');
            const command = process.platform === 'darwin' ? 'afplay' : 
                          process.platform === 'win32' ? 'start' : 'aplay';
            
            exec(`${command} "${tempFile}"`, (error) => {
                if (error) {
                    console.error('Error playing audio:', error);
                } else {
                    console.log('Audio played successfully');
                }
                
                // Clean up temp file
                setTimeout(() => {
                    if (fs.existsSync(tempFile)) {
                        fs.unlinkSync(tempFile);
                    }
                }, 5000);
            });
            
        } catch (error) {
            console.error('Error playing audio:', error);
            await this.playAudioFallback(this.lastSpokenText || 'Error occurred');
        }
    }
    
    async playAudioFallback(text) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            
            // Store the text for potential retry
            this.lastSpokenText = text;
            
            // Adaptive speech rate based on content
            const speechRate = this.calculateOptimalSpeechRate(text);
            
            // Use system TTS based on platform - with adaptive speech rate
            let command;
            if (process.platform === 'darwin') {
                // macOS - adaptive rate based on content
                command = `say -v Samantha -r ${speechRate} "${text.replace(/"/g, '\\"')}"`;
            } else if (process.platform === 'win32') {
                // Windows - adaptive rate (0-10 scale)
                const winRate = Math.max(-10, Math.min(10, Math.round((speechRate - 200) / 20)));
                command = `powershell -Command "Add-Type -AssemblyName System.speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Rate = ${winRate}; $synth.Speak('${text.replace(/'/g, "''")}')"`;
            } else {
                // Linux - adaptive rate
                const linuxRate = Math.max(80, Math.min(300, speechRate));
                command = `espeak -s ${linuxRate} -p 60 "${text.replace(/"/g, '\\"')}" 2>/dev/null || echo "Audio: ${text}"`;
            }
            
            console.log(`🔊 System TTS (${speechRate} WPM): "${text}"`);
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error('System TTS error:', error.message);
                    console.log(`📢 CarBot says: "${text}"`);
                } else {
                    console.log('✅ System TTS played successfully');
                }
                resolve();
            });
        });
    }
    
    calculateOptimalSpeechRate(text) {
        const textLength = text.length;
        const wordCount = text.split(' ').length;
        
        // Natural conversational speeds - not too fast, not robotic
        let baseRate = 220; // Normal conversation speed
        
        // Adjust based on content type
        if (text.includes('Navigation') || text.includes('navigate') || text.includes('directions')) {
            baseRate = 200; // Slower for navigation instructions
        } else if (text.includes('Emergency') || text.includes('emergency') || text.includes('urgent')) {
            baseRate = 180; // Slow and clear for emergencies
        } else if (text.includes('Hello') || text.includes('Hi') || text.includes('Good')) {
            baseRate = 240; // Slightly faster for greetings
        } else if (text.includes('music') || text.includes('play') || text.includes('volume')) {
            baseRate = 250; // Moderate speed for controls
        } else if (text.includes('take care') || text.includes('right away')) {
            baseRate = 200; // Slower for important confirmations
        }
        
        // Adjust based on length - natural variation
        if (wordCount <= 3) {
            // Very short responses (OK, Yes, Sure)
            return Math.min(280, baseRate + 40);
        } else if (wordCount <= 8) {
            // Short responses 
            return Math.min(260, baseRate + 20);
        } else if (wordCount <= 15) {
            // Medium responses
            return baseRate;
        } else if (wordCount <= 25) {
            // Longer responses
            return Math.max(180, baseRate - 20);
        } else {
            // Very long responses
            return Math.max(160, baseRate - 40);
        }
    }
}

module.exports = TextToSpeechService;