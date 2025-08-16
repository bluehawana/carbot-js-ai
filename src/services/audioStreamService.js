const dgram = require('dgram');
const net = require('net');
const EventEmitter = require('events');
const { Buffer } = require('buffer');

class AudioStreamService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            sampleRate: options.sampleRate || 16000,
            channels: options.channels || 1,
            bitDepth: options.bitDepth || 16,
            chunkSize: options.chunkSize || 1024,
            udpPort: options.udpPort || 8080,
            tcpPort: options.tcpPort || 8081,
            maxLatency: options.maxLatency || 50, // ms
            bufferSize: options.bufferSize || 4096,
            protocol: options.protocol || 'udp', // 'udp' or 'tcp'
            enableCompression: options.enableCompression || false,
            ...options
        };
        
        this.isStreaming = false;
        this.udpSocket = null;
        this.tcpServer = null;
        this.tcpClients = new Set();
        this.audioBuffer = [];
        this.sequenceNumber = 0;
        this.lastHeartbeat = Date.now();
        
        // Statistics
        this.stats = {
            packetsTransmitted: 0,
            packetsReceived: 0,
            bytesTransmitted: 0,
            bytesReceived: 0,
            latency: 0,
            packetsLost: 0,
            jitter: 0,
            lastUpdate: Date.now()
        };
        
        this.packetQueue = [];
        this.expectedSequence = 0;
        
        this.initializeProtocol();
    }
    
    initializeProtocol() {
        if (this.options.protocol === 'udp') {
            this.initializeUDP();
        } else {
            this.initializeTCP();
        }
    }
    
    initializeUDP() {
        this.udpSocket = dgram.createSocket('udp4');
        
        this.udpSocket.on('message', (message, rinfo) => {
            this.handleIncomingAudio(message, rinfo);
        });
        
        this.udpSocket.on('error', (error) => {
            console.error('UDP socket error:', error);
            this.emit('error', error);
        });
        
        this.udpSocket.bind(this.options.udpPort, () => {
            console.log(`🎵 UDP audio server listening on port ${this.options.udpPort}`);
            this.emit('ready', { protocol: 'udp', port: this.options.udpPort });
        });
    }
    
    initializeTCP() {
        this.tcpServer = net.createServer((socket) => {
            console.log('🔗 New TCP audio client connected');
            this.tcpClients.add(socket);
            
            socket.on('data', (data) => {
                this.handleIncomingAudio(data, { address: socket.remoteAddress, port: socket.remotePort });
            });
            
            socket.on('close', () => {
                console.log('🔌 TCP audio client disconnected');
                this.tcpClients.delete(socket);
            });
            
            socket.on('error', (error) => {
                console.error('TCP client error:', error);
                this.tcpClients.delete(socket);
            });
        });
        
        this.tcpServer.on('error', (error) => {
            console.error('TCP server error:', error);
            this.emit('error', error);
        });
        
        this.tcpServer.listen(this.options.tcpPort, () => {
            console.log(`🎵 TCP audio server listening on port ${this.options.tcpPort}`);
            this.emit('ready', { protocol: 'tcp', port: this.options.tcpPort });
        });
    }
    
    startStreaming() {
        this.isStreaming = true;
        this.sequenceNumber = 0;
        this.lastHeartbeat = Date.now();
        
        this.emit('streamStarted');
        console.log('🎤 Audio streaming started');
    }
    
    stopStreaming() {
        this.isStreaming = false;
        this.audioBuffer = [];
        
        this.emit('streamStopped');
        console.log('🛑 Audio streaming stopped');
    }
    
    streamAudioChunk(audioData) {
        if (!this.isStreaming) return;
        
        const packet = this.createAudioPacket(audioData);
        
        if (this.options.protocol === 'udp') {
            this.sendUDPPacket(packet);
        } else {
            this.sendTCPPacket(packet);
        }
        
        this.updateStats('transmitted', packet.length);
    }
    
    createAudioPacket(audioData) {
        const header = Buffer.allocUnsafe(16);
        
        // Packet header format:
        // 0-3: Magic number (0x41554449 = "AUDI")
        // 4-7: Sequence number
        // 8-11: Timestamp
        // 12-13: Data length
        // 14: Flags (compression, etc.)
        // 15: Checksum
        
        header.writeUInt32BE(0x41554449, 0); // Magic
        header.writeUInt32BE(this.sequenceNumber++, 4);
        header.writeUInt32BE(Date.now(), 8);
        header.writeUInt16BE(audioData.length, 12);
        
        let flags = 0;
        if (this.options.enableCompression) {
            flags |= 0x01;
            audioData = this.compressAudio(audioData);
        }
        header.writeUInt8(flags, 14);
        
        const checksum = this.calculateChecksum(audioData);
        header.writeUInt8(checksum & 0xFF, 15);
        
        return Buffer.concat([header, audioData]);
    }
    
    sendUDPPacket(packet) {
        if (!this.udpSocket) return;
        
        // Broadcast to all known clients (in real implementation, maintain client list)
        const broadcastAddress = '255.255.255.255';
        
        this.udpSocket.send(packet, this.options.udpPort + 1, broadcastAddress, (error) => {
            if (error) {
                console.error('UDP send error:', error);
                this.stats.packetsLost++;
            }
        });
    }
    
    sendTCPPacket(packet) {
        for (const client of this.tcpClients) {
            client.write(packet, (error) => {
                if (error) {
                    console.error('TCP send error:', error);
                    this.tcpClients.delete(client);
                }
            });
        }
    }
    
    handleIncomingAudio(data, rinfo) {
        if (data.length < 16) {
            console.warn('Received invalid audio packet (too short)');
            return;
        }
        
        const header = this.parsePacketHeader(data.slice(0, 16));
        const audioData = data.slice(16);
        
        if (header.magic !== 0x41554449) {
            console.warn('Received invalid audio packet (bad magic)');
            return;
        }
        
        if (!this.verifyChecksum(audioData, header.checksum)) {
            console.warn('Received corrupted audio packet');
            this.stats.packetsLost++;
            return;
        }
        
        this.processIncomingPacket(header, audioData, rinfo);
    }
    
    parsePacketHeader(headerBuffer) {
        return {
            magic: headerBuffer.readUInt32BE(0),
            sequence: headerBuffer.readUInt32BE(4),
            timestamp: headerBuffer.readUInt32BE(8),
            length: headerBuffer.readUInt16BE(12),
            flags: headerBuffer.readUInt8(14),
            checksum: headerBuffer.readUInt8(15)
        };
    }
    
    processIncomingPacket(header, audioData, rinfo) {
        // Handle out-of-order packets
        if (header.sequence < this.expectedSequence) {
            console.log(`Received late packet: ${header.sequence}, expected: ${this.expectedSequence}`);
            return; // Discard late packets
        }
        
        // Decompress if needed
        if (header.flags & 0x01) {
            audioData = this.decompressAudio(audioData);
        }
        
        // Calculate latency
        const latency = Date.now() - header.timestamp;
        this.updateLatencyStats(latency);
        
        // Check for missing packets
        if (header.sequence > this.expectedSequence) {
            const missingPackets = header.sequence - this.expectedSequence;
            console.warn(`Missing ${missingPackets} audio packets`);
            this.stats.packetsLost += missingPackets;
            
            // Request retransmission for TCP
            if (this.options.protocol === 'tcp') {
                this.requestRetransmission(this.expectedSequence, header.sequence - 1);
            }
        }
        
        this.expectedSequence = header.sequence + 1;
        
        // Add to audio buffer
        this.audioBuffer.push({
            sequence: header.sequence,
            timestamp: header.timestamp,
            data: audioData,
            latency: latency
        });
        
        // Emit audio data event
        this.emit('audioData', {
            data: audioData,
            sequence: header.sequence,
            timestamp: header.timestamp,
            latency: latency,
            source: rinfo
        });
        
        this.updateStats('received', audioData.length);
        
        // Process buffered audio if enough data
        this.processAudioBuffer();
    }
    
    processAudioBuffer() {
        // Keep buffer size manageable
        while (this.audioBuffer.length > this.options.bufferSize) {
            this.audioBuffer.shift();
        }
        
        // Sort by sequence number
        this.audioBuffer.sort((a, b) => a.sequence - b.sequence);
        
        // Emit processed audio chunks
        if (this.audioBuffer.length >= 4) { // Minimum buffer size
            const chunk = this.audioBuffer.splice(0, 2);
            const combinedData = this.combineAudioChunks(chunk);
            
            this.emit('processedAudio', {
                data: combinedData,
                duration: combinedData.length / this.options.sampleRate,
                channels: this.options.channels,
                sampleRate: this.options.sampleRate
            });
        }
    }
    
    combineAudioChunks(chunks) {
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
        const combined = new Float32Array(totalLength);
        
        let offset = 0;
        for (const chunk of chunks) {
            combined.set(chunk.data, offset);
            offset += chunk.data.length;
        }
        
        return combined;
    }
    
    compressAudio(audioData) {
        // Simple delta compression
        if (audioData.length < 2) return audioData;
        
        const compressed = new Int16Array(audioData.length);
        compressed[0] = audioData[0];
        
        for (let i = 1; i < audioData.length; i++) {
            compressed[i] = audioData[i] - audioData[i - 1];
        }
        
        return compressed;
    }
    
    decompressAudio(compressedData) {
        // Reverse delta compression
        if (compressedData.length < 2) return compressedData;
        
        const decompressed = new Float32Array(compressedData.length);
        decompressed[0] = compressedData[0];
        
        for (let i = 1; i < compressedData.length; i++) {
            decompressed[i] = decompressed[i - 1] + compressedData[i];
        }
        
        return decompressed;
    }
    
    calculateChecksum(data) {
        let checksum = 0;
        for (let i = 0; i < data.length; i++) {
            checksum += data[i];
        }
        return checksum & 0xFF;
    }
    
    verifyChecksum(data, expectedChecksum) {
        return this.calculateChecksum(data) === expectedChecksum;
    }
    
    updateLatencyStats(latency) {
        const alpha = 0.1; // Smoothing factor
        this.stats.latency = this.stats.latency * (1 - alpha) + latency * alpha;
        
        // Calculate jitter (variation in latency)
        const jitter = Math.abs(latency - this.stats.latency);
        this.stats.jitter = this.stats.jitter * (1 - alpha) + jitter * alpha;
    }
    
    updateStats(direction, bytes) {
        const now = Date.now();
        
        if (direction === 'transmitted') {
            this.stats.packetsTransmitted++;
            this.stats.bytesTransmitted += bytes;
        } else {
            this.stats.packetsReceived++;
            this.stats.bytesReceived += bytes;
        }
        
        this.stats.lastUpdate = now;
    }
    
    requestRetransmission(startSeq, endSeq) {
        const request = {
            type: 'retransmit',
            startSequence: startSeq,
            endSequence: endSeq,
            timestamp: Date.now()
        };
        
        this.emit('retransmissionRequest', request);
    }
    
    getStats() {
        const now = Date.now();
        const duration = (now - this.stats.lastUpdate) / 1000;
        
        return {
            ...this.stats,
            transmissionRate: this.stats.bytesTransmitted / duration,
            receptionRate: this.stats.bytesReceived / duration,
            packetLossRate: this.stats.packetsLost / (this.stats.packetsReceived + this.stats.packetsLost),
            bufferSize: this.audioBuffer.length,
            isStreaming: this.isStreaming,
            protocol: this.options.protocol,
            connectedClients: this.tcpClients.size
        };
    }
    
    setQualityProfile(profile) {
        const profiles = {
            'high': {
                sampleRate: 48000,
                bitDepth: 24,
                chunkSize: 2048,
                enableCompression: false
            },
            'medium': {
                sampleRate: 22050,
                bitDepth: 16,
                chunkSize: 1024,
                enableCompression: true
            },
            'low': {
                sampleRate: 16000,
                bitDepth: 16,
                chunkSize: 512,
                enableCompression: true
            }
        };
        
        if (profiles[profile]) {
            Object.assign(this.options, profiles[profile]);
            console.log(`🎛️ Audio quality set to ${profile}`);
            this.emit('qualityChanged', profile);
        }
    }
    
    destroy() {
        this.stopStreaming();
        
        if (this.udpSocket) {
            this.udpSocket.close();
        }
        
        if (this.tcpServer) {
            for (const client of this.tcpClients) {
                client.destroy();
            }
            this.tcpServer.close();
        }
        
        this.removeAllListeners();
        console.log('🗑️ Audio stream service destroyed');
    }
}

module.exports = AudioStreamService;