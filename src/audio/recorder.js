const record = require('node-record-lpcm16');
const fs = require('fs');
const path = require('path');

class AudioRecorder {
    constructor(options = {}) {
        this.options = {
            sampleRate: options.sampleRate || 16000,
            channels: options.channels || 1,
            audioType: options.audioType || 'raw',
            silence: options.silence || '2.0',
            verbose: options.verbose || false,
            ...options
        };
        
        this.recording = null;
        this.isRecording = false;
        this.audioBuffer = [];
        this.callbacks = {
            onData: null,
            onEnd: null,
            onError: null
        };
    }

    startRecording() {
        if (this.isRecording) {
            console.log('Already recording');
            return;
        }

        console.log('Starting audio recording...');
        
        this.recording = record.record(this.options);
        this.isRecording = true;
        this.audioBuffer = [];

        this.recording.stream().on('data', (chunk) => {
            this.audioBuffer.push(chunk);
            if (this.callbacks.onData) {
                this.callbacks.onData(chunk);
            }
        });

        this.recording.stream().on('end', () => {
            console.log('Recording ended');
            this.isRecording = false;
            
            const fullBuffer = Buffer.concat(this.audioBuffer);
            if (this.callbacks.onEnd) {
                this.callbacks.onEnd(fullBuffer);
            }
        });

        this.recording.stream().on('error', (error) => {
            console.error('Recording error:', error);
            this.isRecording = false;
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
        });
    }

    stopRecording() {
        if (!this.isRecording) {
            console.log('Not currently recording');
            return;
        }

        console.log('Stopping audio recording...');
        
        if (this.recording) {
            this.recording.stop();
            this.recording = null;
        }
        
        this.isRecording = false;
    }

    saveRecording(filename) {
        if (this.audioBuffer.length === 0) {
            console.log('No audio data to save');
            return;
        }

        const filePath = path.join(__dirname, '../../recordings', filename);
        const buffer = Buffer.concat(this.audioBuffer);
        
        // Ensure recordings directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, buffer);
        console.log(`Recording saved to: ${filePath}`);
        
        return filePath;
    }

    onData(callback) {
        this.callbacks.onData = callback;
    }

    onEnd(callback) {
        this.callbacks.onEnd = callback;
    }

    onError(callback) {
        this.callbacks.onError = callback;
    }

    getBuffer() {
        return Buffer.concat(this.audioBuffer);
    }

    clearBuffer() {
        this.audioBuffer = [];
    }
}

module.exports = AudioRecorder;