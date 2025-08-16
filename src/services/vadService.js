const EventEmitter = require('events');

class VoiceActivityDetector extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            sampleRate: options.sampleRate || 16000,
            frameSize: options.frameSize || 512,
            energyThreshold: options.energyThreshold || 0.01,
            silenceThreshold: options.silenceThreshold || 0.005,
            minSpeechFrames: options.minSpeechFrames || 5,
            minSilenceFrames: options.minSilenceFrames || 10,
            preSpeechPadding: options.preSpeechPadding || 0.5,
            postSpeechPadding: options.postSpeechPadding || 0.5,
            ...options
        };
        
        this.state = 'silence';
        this.speechFrameCount = 0;
        this.silenceFrameCount = 0;
        this.audioBuffer = [];
        this.isListening = false;
        
        this.frameHistory = [];
        this.energyHistory = [];
        this.maxHistoryLength = 100;
    }
    
    start() {
        this.isListening = true;
        this.state = 'silence';
        this.speechFrameCount = 0;
        this.silenceFrameCount = 0;
        this.audioBuffer = [];
        this.emit('started');
    }
    
    stop() {
        this.isListening = false;
        if (this.state === 'speech' && this.audioBuffer.length > 0) {
            this.emit('speechEnd', this.getBufferedAudio());
        }
        this.emit('stopped');
    }
    
    processAudioFrame(audioData) {
        if (!this.isListening) return;
        
        const energy = this.calculateEnergy(audioData);
        const isSpeech = energy > this.options.energyThreshold;
        
        this.energyHistory.push(energy);
        if (this.energyHistory.length > this.maxHistoryLength) {
            this.energyHistory.shift();
        }
        
        this.frameHistory.push({
            data: audioData,
            energy: energy,
            timestamp: Date.now()
        });
        
        if (this.frameHistory.length > this.maxHistoryLength) {
            this.frameHistory.shift();
        }
        
        this.updateState(isSpeech, audioData);
        
        this.emit('audioFrame', {
            energy: energy,
            isSpeech: isSpeech,
            state: this.state
        });
    }
    
    updateState(isSpeech, audioData) {
        switch (this.state) {
            case 'silence':
                if (isSpeech) {
                    this.speechFrameCount++;
                    if (this.speechFrameCount >= this.options.minSpeechFrames) {
                        this.transitionToSpeech();
                    }
                } else {
                    this.speechFrameCount = 0;
                }
                break;
                
            case 'speech':
                this.audioBuffer.push(audioData);
                
                if (isSpeech) {
                    this.silenceFrameCount = 0;
                } else {
                    this.silenceFrameCount++;
                    if (this.silenceFrameCount >= this.options.minSilenceFrames) {
                        this.transitionToSilence();
                    }
                }
                break;
        }
    }
    
    transitionToSpeech() {
        this.state = 'speech';
        this.speechFrameCount = 0;
        this.silenceFrameCount = 0;
        
        const prePaddingFrames = Math.floor(
            this.options.preSpeechPadding * this.options.sampleRate / this.options.frameSize
        );
        
        const paddingAudio = this.frameHistory
            .slice(-prePaddingFrames)
            .map(frame => frame.data);
        
        this.audioBuffer = [...paddingAudio];
        
        this.emit('speechStart');
    }
    
    transitionToSilence() {
        const bufferedAudio = this.getBufferedAudio();
        
        this.state = 'silence';
        this.speechFrameCount = 0;
        this.silenceFrameCount = 0;
        this.audioBuffer = [];
        
        this.emit('speechEnd', bufferedAudio);
    }
    
    calculateEnergy(audioData) {
        if (!audioData || audioData.length === 0) return 0;
        
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        
        return Math.sqrt(sum / audioData.length);
    }
    
    getBufferedAudio() {
        if (this.audioBuffer.length === 0) return null;
        
        const totalLength = this.audioBuffer.reduce((acc, chunk) => acc + chunk.length, 0);
        const combined = new Float32Array(totalLength);
        
        let offset = 0;
        for (const chunk of this.audioBuffer) {
            combined.set(chunk, offset);
            offset += chunk.length;
        }
        
        return combined;
    }
    
    getAverageEnergy(frames = 10) {
        const recentEnergy = this.energyHistory.slice(-frames);
        if (recentEnergy.length === 0) return 0;
        
        return recentEnergy.reduce((sum, energy) => sum + energy, 0) / recentEnergy.length;
    }
    
    adaptiveThreshold() {
        const avgEnergy = this.getAverageEnergy(50);
        const adaptiveThreshold = Math.max(
            this.options.silenceThreshold,
            avgEnergy * 0.3
        );
        
        this.options.energyThreshold = Math.min(
            adaptiveThreshold,
            this.options.energyThreshold * 1.1
        );
    }
    
    getStats() {
        return {
            state: this.state,
            speechFrameCount: this.speechFrameCount,
            silenceFrameCount: this.silenceFrameCount,
            bufferLength: this.audioBuffer.length,
            averageEnergy: this.getAverageEnergy(),
            currentThreshold: this.options.energyThreshold
        };
    }
}

module.exports = VoiceActivityDetector;