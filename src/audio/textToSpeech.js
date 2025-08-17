console.log(`
+++++++++++++++++++++++++++++++++++++++++
+                                       +
+      LOADING TEXT TO SPEECH MODULE      +
+                                       +
+++++++++++++++++++++++++++++++++++++++++
`);

const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

class TextToSpeechService {
    constructor(options = {}) {
        console.log('[TextToSpeechService CONSTRUCTOR] Creating new instance...');
        
        this.useFallback = false;
        
        try {
            // Try to initialize Google Cloud TTS
            if (process.env.GOOGLE_CLOUD_KEY_FILE && fs.existsSync(process.env.GOOGLE_CLOUD_KEY_FILE)) {
                this.client = new textToSpeech.TextToSpeechClient({
                    keyFilename: options.keyFilename || process.env.GOOGLE_CLOUD_KEY_FILE,
                    projectId: options.projectId || process.env.GOOGLE_CLOUD_PROJECT_ID
                });
                console.log('✅ Google Cloud TTS initialized');
            } else {
                console.log('⚠️  Google Cloud credentials not found, using fallback TTS');
                this.useFallback = true;
            }
            
            this.voice = {
                languageCode: 'en-US',
                name: 'en-US-Neural2-D', // Male voice
                ssmlGender: 'MALE',
                ...options.voice
            };
            
            this.audioConfig = {
                audioEncoding: 'MP3',
                speakingRate: 1.0,
                pitch: 0.0,
                volumeGainDb: 0.0,
                ...options.audioConfig
            };
            
            this.outputDir = options.outputDir || path.join(__dirname, '../../audio-output');
            this.ensureOutputDir();
            console.log('[TextToSpeechService CONSTRUCTOR] Instance created successfully.');
        } catch (error) {
            console.error('[TextToSpeechService CONSTRUCTOR] Error with Google Cloud TTS, using fallback:', error.message);
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
            
            const request = {
                input: { text: text },
                voice: this.voice,
                audioConfig: this.audioConfig,
            };

            console.log('Synthesizing speech:', text);
            const [response] = await this.client.synthesizeSpeech(request);
            
            if (outputFile) {
                const filePath = path.join(this.outputDir, outputFile);
                fs.writeFileSync(filePath, response.audioContent, 'binary');
                console.log(`Audio content written to file: ${filePath}`);
                return filePath;
            }
            
            return response.audioContent;
        } catch (error) {
            console.error('Text-to-speech error:', error);
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
            const request = {
                input: { ssml: ssml },
                voice: this.voice,
                audioConfig: this.audioConfig,
            };

            console.log('Synthesizing SSML:', ssml);
            const [response] = await this.client.synthesizeSpeech(request);
            
            if (outputFile) {
                const filePath = path.join(this.outputDir, outputFile);
                fs.writeFileSync(filePath, response.audioContent, 'binary');
                console.log(`Audio content written to file: ${filePath}`);
                return filePath;
            }
            
            return response.audioContent;
        } catch (error) {
            console.error('SSML synthesis error:', error);
            throw error;
        }
    }

    async getVoices() {
        try {
            const [response] = await this.client.listVoices({});
            return response.voices;
        } catch (error) {
            console.error('Error getting voices:', error);
            throw error;
        }
    }

    setVoice(voice) {
        this.voice = { ...this.voice, ...voice };
    }

    setAudioConfig(config) {
        this.audioConfig = { ...this.audioConfig, ...config };
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
        const urgentSSML = `
            <speak>
                <prosody rate="fast" volume="loud" pitch="+2st">
                    <emphasis level="strong">
                        ${text}
                    </emphasis>
                </prosody>
            </speak>
        `;
        
        return await this.synthesizeSSML(urgentSSML, outputFile);
    }

    // Navigation announcements
    async synthesizeNavigation(text, outputFile = null) {
        const navSSML = `
            <speak>
                <prosody rate="medium" volume="loud">
                    <emphasis level="moderate">
                        ${text}
                    </emphasis>
                </prosody>
            </speak>
        `;
        
        return await this.synthesizeSSML(navSSML, outputFile);
    }

    // Casual conversation
    async synthesizeCasual(text, outputFile = null) {
        const casualSSML = `
            <speak>
                <prosody rate="medium" volume="medium" pitch="-1st">
                    ${text}
                </prosody>
            </speak>
        `;
        
        return await this.synthesizeSSML(casualSSML, outputFile);
    }

    // Play audio using system audio player
    async playAudio(audioContent) {
        try {
            if (this.useFallback || (audioContent && audioContent.toString() === 'fallback-audio')) {
                return await this.playAudioFallback(this.lastSpokenText || 'Response generated');
            }
            
            const tempFile = path.join(this.outputDir, `temp_${Date.now()}.mp3`);
            fs.writeFileSync(tempFile, audioContent, 'binary');
            
            // Use system audio player
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
            // Fall back to system TTS
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