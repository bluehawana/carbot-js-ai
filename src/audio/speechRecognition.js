const speech = require('@google-cloud/speech');
const fs = require('fs');

class SpeechRecognition {
    constructor(options = {}) {
        this.client = new speech.SpeechClient({
            keyFilename: options.keyFilename || process.env.GOOGLE_CLOUD_KEY_FILE,
            projectId: options.projectId || process.env.GOOGLE_CLOUD_PROJECT_ID
        });
        
        this.config = {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: 'en-US',
            enableAutomaticPunctuation: true,
            enableWordTimeOffsets: true,
            model: 'command_and_search',
            useEnhanced: true,
            ...options.config
        };
    }

    async recognizeAudio(audioBuffer) {
        try {
            const request = {
                audio: {
                    content: audioBuffer.toString('base64'),
                },
                config: this.config,
            };

            console.log('Sending audio to Google Speech-to-Text...');
            const [response] = await this.client.recognize(request);
            
            if (response.results && response.results.length > 0) {
                const transcription = response.results
                    .map(result => result.alternatives[0].transcript)
                    .join('\n');
                
                console.log('Speech recognition result:', transcription);
                return {
                    text: transcription,
                    confidence: response.results[0].alternatives[0].confidence,
                    words: response.results[0].alternatives[0].words
                };
            }
            
            return null;
        } catch (error) {
            console.error('Speech recognition error:', error);
            throw error;
        }
    }

    async recognizeAudioFile(filePath) {
        try {
            const audioBytes = fs.readFileSync(filePath);
            return await this.recognizeAudio(audioBytes);
        } catch (error) {
            console.error('Error reading audio file:', error);
            throw error;
        }
    }

    async streamingRecognize(audioStream) {
        const request = {
            config: this.config,
            interimResults: true,
        };

        const recognizeStream = this.client
            .streamingRecognize(request)
            .on('error', (error) => {
                console.error('Streaming recognition error:', error);
            })
            .on('data', (response) => {
                if (response.results[0] && response.results[0].alternatives[0]) {
                    const transcription = response.results[0].alternatives[0].transcript;
                    const isFinal = response.results[0].isFinal;
                    
                    console.log(`Transcript: ${transcription}`);
                    
                    if (isFinal) {
                        console.log('Final transcript:', transcription);
                        return transcription;
                    }
                }
            });

        audioStream.pipe(recognizeStream);
        return recognizeStream;
    }

    // Fallback speech recognition using Web Speech API (for browser environments)
    initializeFallback() {
        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            
            return true;
        }
        return false;
    }

    startFallbackRecognition() {
        if (!this.recognition) {
            console.error('Fallback speech recognition not available');
            return;
        }

        this.recognition.start();
        
        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                }
            }
            
            if (finalTranscript) {
                console.log('Fallback speech recognition:', finalTranscript);
                return finalTranscript;
            }
        };
    }
}

module.exports = SpeechRecognition;