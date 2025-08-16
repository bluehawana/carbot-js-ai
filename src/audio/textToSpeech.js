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
        try {
            this.client = new textToSpeech.TextToSpeechClient({
                keyFilename: options.keyFilename || process.env.GOOGLE_CLOUD_KEY_FILE,
                projectId: options.projectId || process.env.GOOGLE_CLOUD_PROJECT_ID
            });
            
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
            console.error('[TextToSpeechService CONSTRUCTOR] FATAL ERROR:', error);
        }
    }

    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async synthesizeSpeech(text, outputFile = null) {
        try {
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
            throw error;
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
        }
    }
}

module.exports = TextToSpeechService;