const dgram = require('dgram');
const net = require('net');
const EventEmitter = require('events');
const { Buffer } = require('buffer');

class EnhancedAudioStreamService extends EventEmitter {
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
            protocol: options.protocol || 'udp',
            enableCompression: options.enableCompression || true,
            enableAdaptiveBitrate: options.enableAdaptiveBitrate !== false,
            enableAutoQuality: options.enableAutoQuality !== false,
            enableJitterBuffer: options.enableJitterBuffer !== false,
            jitterBufferSize: options.jitterBufferSize || 50,
            ...options
        };
        
        this.isStreaming = false;
        this.udpSocket = null;
        this.tcpServer = null;
        this.tcpClients = new Set();
        this.audioBuffer = [];
        this.jitterBuffer = [];
        this.sequenceNumber = 0;
        this.lastHeartbeat = Date.now();
        
        // Quality profiles for adaptive streaming
        this.qualityProfiles = {
            'ultra-low': {
                sampleRate: 8000,
                bitDepth: 8,
                chunkSize: 256,
                enableCompression: true,
                description: 'Minimal quality for emergency use'
            },
            'low': {
                sampleRate: 16000,
                bitDepth: 16,
                chunkSize: 512,
                enableCompression: true,
                description: 'Low quality for poor connections'
            },
            'medium': {
                sampleRate: 22050,
                bitDepth: 16,
                chunkSize: 1024,
                enableCompression: true,
                description: 'Balanced quality and performance'
            },
            'high': {
                sampleRate: 44100,
                bitDepth: 16,
                chunkSize: 2048,
                enableCompression: false,
                description: 'High quality for good connections'
            },
            'ultra-high': {
                sampleRate: 48000,
                bitDepth: 24,
                chunkSize: 4096,
                enableCompression: false,
                description: 'Maximum quality for excellent connections'
            }
        };
        
        this.currentQualityProfile = 'medium';
        
        // Enhanced statistics with quality metrics
        this.stats = {
            packetsTransmitted: 0,
            packetsReceived: 0,
            bytesTransmitted: 0,
            bytesReceived: 0,
            latency: 0,
            packetsLost: 0,
            jitter: 0,
            qualityScore: 0,
            networkQuality: 'unknown',
            compressionRatio: 0,
            adaptiveChanges: 0,
            bufferUnderruns: 0,
            bufferOverruns: 0,
            lastUpdate: Date.now()
        };
        
        // Network quality assessment
        this.networkMetrics = {
            latencyHistory: [],
            packetLossHistory: [],
            jitterHistory: [],
            bandwidthHistory: [],
            lastAssessment: Date.now()
        };
        
        // Adaptive streaming control
        this.adaptiveController = {
            enabled: this.options.enableAdaptiveBitrate,
            lastAdjustment: Date.now(),
            adjustmentCooldown: 5000, // 5 seconds between adjustments
            stabilityThreshold: 3, // Require 3 consistent measurements
            degradationThreshold: 0.15, // 15% packet loss triggers downgrade
            improvementThreshold: 0.05 // 5% packet loss allows upgrade
        };
        
        this.packetQueue = [];
        this.expectedSequence = 0;
        this.compressionCache = new Map();
        
        this.initializeProtocol();
        this.startQualityMonitoring();
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
            console.error('🔴 Enhanced UDP socket error:', error);
            this.emit('error', { type: 'network', component: 'udp', error });
        });
        
        this.udpSocket.bind(this.options.udpPort, () => {
            console.log(`🎵 Enhanced UDP audio server listening on port ${this.options.udpPort}`);
            this.emit('ready', { protocol: 'udp', port: this.options.udpPort });
        });
    }
    
    initializeTCP() {
        this.tcpServer = net.createServer((socket) => {
            console.log('🔗 Enhanced TCP audio client connected');
            this.tcpClients.add(socket);
            
            // Set socket options for audio streaming
            socket.setNoDelay(true); // Disable Nagle's algorithm for low latency
            socket.setKeepAlive(true, 30000); // Keep connection alive
            
            socket.on('data', (data) => {
                this.handleIncomingAudio(data, { 
                    address: socket.remoteAddress, 
                    port: socket.remotePort 
                });
            });
            
            socket.on('close', () => {
                console.log('🔌 Enhanced TCP audio client disconnected');
                this.tcpClients.delete(socket);
            });
            
            socket.on('error', (error) => {
                console.error('🔴 Enhanced TCP client error:', error);
                this.tcpClients.delete(socket);
                this.emit('error', { type: 'network', component: 'tcp', error });
            });
        });
        
        this.tcpServer.on('error', (error) => {
            console.error('🔴 Enhanced TCP server error:', error);
            this.emit('error', { type: 'network', component: 'tcp-server', error });
        });
        
        this.tcpServer.listen(this.options.tcpPort, () => {
            console.log(`🎵 Enhanced TCP audio server listening on port ${this.options.tcpPort}`);
            this.emit('ready', { protocol: 'tcp', port: this.options.tcpPort });
        });
    }
    
    startQualityMonitoring() {
        // Monitor network quality and adjust streaming parameters
        this.qualityMonitoringInterval = setInterval(() => {
            this.assessNetworkQuality();
            this.adaptStreamingQuality();
            this.cleanupOldMetrics();
            
            // Emit quality metrics
            this.emit('qualityUpdate', {
                networkQuality: this.stats.networkQuality,
                qualityScore: this.stats.qualityScore,
                currentProfile: this.currentQualityProfile,
                latency: this.stats.latency,
                packetLoss: this.calculatePacketLoss(),
                jitter: this.stats.jitter
            });
            
        }, 2000); // Every 2 seconds
    }
    
    assessNetworkQuality() {
        const now = Date.now();
        
        // Calculate current metrics
        const avgLatency = this.calculateAverageLatency();
        const packetLoss = this.calculatePacketLoss();
        const jitter = this.stats.jitter;
        
        // Store in history
        this.networkMetrics.latencyHistory.push({ value: avgLatency, timestamp: now });
        this.networkMetrics.packetLossHistory.push({ value: packetLoss, timestamp: now });
        this.networkMetrics.jitterHistory.push({ value: jitter, timestamp: now });
        
        // Keep only recent history (last 30 seconds)\n        this.cleanupMetricHistory(this.networkMetrics.latencyHistory, 30000);\n        this.cleanupMetricHistory(this.networkMetrics.packetLossHistory, 30000);\n        this.cleanupMetricHistory(this.networkMetrics.jitterHistory, 30000);\n        \n        // Calculate quality score (0-100)\n        let qualityScore = 100;\n        \n        // Latency impact (0-40 points)\n        if (avgLatency > 200) qualityScore -= 40;\n        else if (avgLatency > 100) qualityScore -= 25;\n        else if (avgLatency > 50) qualityScore -= 10;\n        \n        // Packet loss impact (0-40 points)\n        if (packetLoss > 0.1) qualityScore -= 40;\n        else if (packetLoss > 0.05) qualityScore -= 25;\n        else if (packetLoss > 0.02) qualityScore -= 10;\n        \n        // Jitter impact (0-20 points)\n        if (jitter > 50) qualityScore -= 20;\n        else if (jitter > 25) qualityScore -= 10;\n        else if (jitter > 10) qualityScore -= 5;\n        \n        this.stats.qualityScore = Math.max(0, qualityScore);\n        \n        // Determine network quality category\n        if (this.stats.qualityScore >= 80) {\n            this.stats.networkQuality = 'excellent';\n        } else if (this.stats.qualityScore >= 60) {\n            this.stats.networkQuality = 'good';\n        } else if (this.stats.qualityScore >= 40) {\n            this.stats.networkQuality = 'fair';\n        } else if (this.stats.qualityScore >= 20) {\n            this.stats.networkQuality = 'poor';\n        } else {\n            this.stats.networkQuality = 'critical';\n        }\n    }\n    \n    adaptStreamingQuality() {\n        if (!this.adaptiveController.enabled || !this.options.enableAutoQuality) return;\n        \n        const now = Date.now();\n        const timeSinceLastAdjustment = now - this.adaptiveController.lastAdjustment;\n        \n        // Don't adjust too frequently\n        if (timeSinceLastAdjustment < this.adaptiveController.adjustmentCooldown) return;\n        \n        const currentQuality = this.qualityProfiles[this.currentQualityProfile];\n        const packetLoss = this.calculatePacketLoss();\n        const latency = this.calculateAverageLatency();\n        \n        // Determine if we should change quality\n        let shouldDowngrade = false;\n        let shouldUpgrade = false;\n        \n        // Check for degradation conditions\n        if (packetLoss > this.adaptiveController.degradationThreshold || \n            latency > 200 || \n            this.stats.bufferUnderruns > 5) {\n            shouldDowngrade = true;\n        }\n        \n        // Check for improvement conditions\n        if (packetLoss < this.adaptiveController.improvementThreshold && \n            latency < 100 && \n            this.stats.bufferUnderruns === 0) {\n            shouldUpgrade = true;\n        }\n        \n        if (shouldDowngrade && this.canDowngrade()) {\n            this.downgradQuality();\n        } else if (shouldUpgrade && this.canUpgrade()) {\n            this.upgradeQuality();\n        }\n    }\n    \n    canDowngrade() {\n        const profiles = Object.keys(this.qualityProfiles);\n        const currentIndex = profiles.indexOf(this.currentQualityProfile);\n        return currentIndex > 0;\n    }\n    \n    canUpgrade() {\n        const profiles = Object.keys(this.qualityProfiles);\n        const currentIndex = profiles.indexOf(this.currentQualityProfile);\n        return currentIndex < profiles.length - 1;\n    }\n    \n    downgradeQuality() {\n        const profiles = Object.keys(this.qualityProfiles);\n        const currentIndex = profiles.indexOf(this.currentQualityProfile);\n        const newProfile = profiles[Math.max(0, currentIndex - 1)];\n        \n        if (newProfile !== this.currentQualityProfile) {\n            console.log(`📉 Auto-downgrading audio quality: ${this.currentQualityProfile} → ${newProfile}`);\n            this.setQualityProfile(newProfile);\n            this.stats.adaptiveChanges++;\n            this.adaptiveController.lastAdjustment = Date.now();\n            \n            this.emit('qualityAdjusted', {\n                direction: 'downgrade',\n                from: this.currentQualityProfile,\n                to: newProfile,\n                reason: 'network_degradation'\n            });\n        }\n    }\n    \n    upgradeQuality() {\n        const profiles = Object.keys(this.qualityProfiles);\n        const currentIndex = profiles.indexOf(this.currentQualityProfile);\n        const newProfile = profiles[Math.min(profiles.length - 1, currentIndex + 1)];\n        \n        if (newProfile !== this.currentQualityProfile) {\n            console.log(`📈 Auto-upgrading audio quality: ${this.currentQualityProfile} → ${newProfile}`);\n            this.setQualityProfile(newProfile);\n            this.stats.adaptiveChanges++;\n            this.adaptiveController.lastAdjustment = Date.now();\n            \n            this.emit('qualityAdjusted', {\n                direction: 'upgrade',\n                from: this.currentQualityProfile,\n                to: newProfile,\n                reason: 'network_improvement'\n            });\n        }\n    }\n    \n    setQualityProfile(profileName) {\n        if (!this.qualityProfiles[profileName]) {\n            console.warn(`⚠️ Unknown quality profile: ${profileName}`);\n            return false;\n        }\n        \n        const profile = this.qualityProfiles[profileName];\n        \n        // Update options with new profile\n        this.options.sampleRate = profile.sampleRate;\n        this.options.bitDepth = profile.bitDepth;\n        this.options.chunkSize = profile.chunkSize;\n        this.options.enableCompression = profile.enableCompression;\n        \n        this.currentQualityProfile = profileName;\n        \n        console.log(`🎛️ Audio quality set to ${profileName}: ${profile.description}`);\n        this.emit('qualityChanged', { profile: profileName, config: profile });\n        \n        return true;\n    }\n    \n    startStreaming() {\n        this.isStreaming = true;\n        this.sequenceNumber = 0;\n        this.lastHeartbeat = Date.now();\n        \n        // Reset statistics\n        this.resetStreamingStats();\n        \n        this.emit('streamStarted', {\n            quality: this.currentQualityProfile,\n            config: this.qualityProfiles[this.currentQualityProfile]\n        });\n        \n        console.log(`🎤 Enhanced audio streaming started (${this.currentQualityProfile} quality)`);\n    }\n    \n    stopStreaming() {\n        this.isStreaming = false;\n        this.audioBuffer = [];\n        this.jitterBuffer = [];\n        \n        this.emit('streamStopped', {\n            duration: Date.now() - this.lastHeartbeat,\n            stats: this.getDetailedStats()\n        });\n        \n        console.log('🛑 Enhanced audio streaming stopped');\n    }\n    \n    streamAudioChunk(audioData, metadata = {}) {\n        if (!this.isStreaming) return false;\n        \n        try {\n            // Apply quality-based processing\n            const processedData = this.processAudioForQuality(audioData);\n            \n            // Create enhanced packet\n            const packet = this.createEnhancedAudioPacket(processedData, metadata);\n            \n            // Send packet\n            const success = this.sendPacket(packet);\n            \n            if (success) {\n                this.updateStats('transmitted', packet.length);\n            }\n            \n            return success;\n            \n        } catch (error) {\n            console.error('🔴 Error streaming audio chunk:', error);\n            this.emit('error', { type: 'streaming', component: 'chunk_processing', error });\n            return false;\n        }\n    }\n    \n    processAudioForQuality(audioData) {\n        const profile = this.qualityProfiles[this.currentQualityProfile];\n        let processedData = audioData;\n        \n        // Sample rate conversion (simplified)\n        if (profile.sampleRate !== this.options.sampleRate) {\n            processedData = this.resampleAudio(processedData, profile.sampleRate);\n        }\n        \n        // Bit depth conversion\n        if (profile.bitDepth !== this.options.bitDepth) {\n            processedData = this.convertBitDepth(processedData, profile.bitDepth);\n        }\n        \n        // Apply compression if enabled\n        if (profile.enableCompression) {\n            processedData = this.compressAudio(processedData);\n        }\n        \n        return processedData;\n    }\n    \n    resampleAudio(audioData, targetSampleRate) {\n        // Simplified resampling - in production, use a proper resampling library\n        const ratio = targetSampleRate / this.options.sampleRate;\n        const targetLength = Math.floor(audioData.length * ratio);\n        const resampled = new Float32Array(targetLength);\n        \n        for (let i = 0; i < targetLength; i++) {\n            const sourceIndex = Math.floor(i / ratio);\n            resampled[i] = audioData[Math.min(sourceIndex, audioData.length - 1)];\n        }\n        \n        return resampled;\n    }\n    \n    convertBitDepth(audioData, targetBitDepth) {\n        // Simplified bit depth conversion\n        if (targetBitDepth === 8) {\n            return audioData.map(sample => Math.round(sample * 127));\n        } else if (targetBitDepth === 16) {\n            return audioData.map(sample => Math.round(sample * 32767));\n        } else if (targetBitDepth === 24) {\n            return audioData.map(sample => Math.round(sample * 8388607));\n        }\n        return audioData;\n    }\n    \n    createEnhancedAudioPacket(audioData, metadata = {}) {\n        const headerSize = 24; // Expanded header for enhanced features\n        const header = Buffer.allocUnsafe(headerSize);\n        \n        // Enhanced packet header format:\n        // 0-3: Magic number (0x41554449 = \"AUDI\")\n        // 4-7: Sequence number\n        // 8-11: Timestamp\n        // 12-13: Data length\n        // 14: Flags (compression, quality, etc.)\n        // 15: Checksum\n        // 16-17: Quality profile ID\n        // 18-19: Sample rate\n        // 20: Bit depth\n        // 21: Channels\n        // 22-23: Reserved\n        \n        header.writeUInt32BE(0x41554449, 0); // Magic\n        header.writeUInt32BE(this.sequenceNumber++, 4);\n        header.writeUInt32BE(Date.now(), 8);\n        header.writeUInt16BE(audioData.length, 12);\n        \n        let flags = 0;\n        const profile = this.qualityProfiles[this.currentQualityProfile];\n        if (profile.enableCompression) flags |= 0x01;\n        if (metadata.priority === 'high') flags |= 0x02;\n        if (metadata.isLast) flags |= 0x04;\n        \n        header.writeUInt8(flags, 14);\n        \n        const checksum = this.calculateEnhancedChecksum(audioData);\n        header.writeUInt8(checksum & 0xFF, 15);\n        \n        // Quality information\n        header.writeUInt16BE(this.getQualityProfileId(), 16);\n        header.writeUInt16BE(profile.sampleRate, 18);\n        header.writeUInt8(profile.bitDepth, 20);\n        header.writeUInt8(this.options.channels, 21);\n        header.writeUInt16BE(0, 22); // Reserved\n        \n        return Buffer.concat([header, Buffer.from(audioData)]);\n    }\n    \n    getQualityProfileId() {\n        const profiles = Object.keys(this.qualityProfiles);\n        return profiles.indexOf(this.currentQualityProfile);\n    }\n    \n    sendPacket(packet) {\n        try {\n            if (this.options.protocol === 'udp') {\n                return this.sendUDPPacket(packet);\n            } else {\n                return this.sendTCPPacket(packet);\n            }\n        } catch (error) {\n            console.error('🔴 Packet send error:', error);\n            return false;\n        }\n    }\n    \n    sendUDPPacket(packet) {\n        if (!this.udpSocket) return false;\n        \n        // Use adaptive destination based on network quality\n        const destinations = this.getAdaptiveDestinations();\n        \n        let success = true;\n        for (const dest of destinations) {\n            this.udpSocket.send(packet, dest.port, dest.address, (error) => {\n                if (error) {\n                    console.error('🔴 UDP send error:', error);\n                    this.stats.packetsLost++;\n                    success = false;\n                }\n            });\n        }\n        \n        return success;\n    }\n    \n    sendTCPPacket(packet) {\n        if (this.tcpClients.size === 0) return false;\n        \n        let success = true;\n        for (const client of this.tcpClients) {\n            client.write(packet, (error) => {\n                if (error) {\n                    console.error('🔴 TCP send error:', error);\n                    this.tcpClients.delete(client);\n                    success = false;\n                }\n            });\n        }\n        \n        return success;\n    }\n    \n    getAdaptiveDestinations() {\n        // Return destinations based on network quality\n        const destinations = [];\n        \n        // Primary destination\n        destinations.push({\n            address: '255.255.255.255',\n            port: this.options.udpPort + 1\n        });\n        \n        // Add backup destinations for poor network quality\n        if (this.stats.networkQuality === 'poor' || this.stats.networkQuality === 'critical') {\n            destinations.push({\n                address: 'localhost',\n                port: this.options.udpPort + 2\n            });\n        }\n        \n        return destinations;\n    }\n    \n    handleIncomingAudio(data, rinfo) {\n        if (data.length < 24) { // Enhanced header size\n            console.warn('⚠️ Received invalid audio packet (too short)');\n            return;\n        }\n        \n        try {\n            const header = this.parseEnhancedPacketHeader(data.slice(0, 24));\n            const audioData = data.slice(24);\n            \n            if (header.magic !== 0x41554449) {\n                console.warn('⚠️ Received invalid audio packet (bad magic)');\n                return;\n            }\n            \n            if (!this.verifyEnhancedChecksum(audioData, header.checksum)) {\n                console.warn('⚠️ Received corrupted audio packet');\n                this.stats.packetsLost++;\n                return;\n            }\n            \n            this.processIncomingPacket(header, audioData, rinfo);\n            \n        } catch (error) {\n            console.error('🔴 Error handling incoming audio:', error);\n            this.emit('error', { type: 'receive', component: 'packet_processing', error });\n        }\n    }\n    \n    parseEnhancedPacketHeader(headerBuffer) {\n        return {\n            magic: headerBuffer.readUInt32BE(0),\n            sequence: headerBuffer.readUInt32BE(4),\n            timestamp: headerBuffer.readUInt32BE(8),\n            length: headerBuffer.readUInt16BE(12),\n            flags: headerBuffer.readUInt8(14),\n            checksum: headerBuffer.readUInt8(15),\n            qualityProfile: headerBuffer.readUInt16BE(16),\n            sampleRate: headerBuffer.readUInt16BE(18),\n            bitDepth: headerBuffer.readUInt8(20),\n            channels: headerBuffer.readUInt8(21)\n        };\n    }\n    \n    processIncomingPacket(header, audioData, rinfo) {\n        // Handle out-of-order packets with enhanced jitter buffer\n        if (this.options.enableJitterBuffer) {\n            this.addToJitterBuffer(header, audioData, rinfo);\n        } else {\n            this.processPacketDirectly(header, audioData, rinfo);\n        }\n    }\n    \n    addToJitterBuffer(header, audioData, rinfo) {\n        // Add packet to jitter buffer\n        this.jitterBuffer.push({\n            header: header,\n            data: audioData,\n            rinfo: rinfo,\n            receivedAt: Date.now()\n        });\n        \n        // Sort by sequence number\n        this.jitterBuffer.sort((a, b) => a.header.sequence - b.header.sequence);\n        \n        // Keep buffer size manageable\n        if (this.jitterBuffer.length > this.options.jitterBufferSize) {\n            this.jitterBuffer.shift();\n            this.stats.bufferOverruns++;\n        }\n        \n        // Process packets in order\n        this.processJitterBuffer();\n    }\n    \n    processJitterBuffer() {\n        while (this.jitterBuffer.length > 0) {\n            const packet = this.jitterBuffer[0];\n            \n            // Only process if we have the expected sequence or buffer is getting full\n            if (packet.header.sequence === this.expectedSequence || \n                this.jitterBuffer.length >= this.options.jitterBufferSize * 0.8) {\n                \n                this.jitterBuffer.shift();\n                this.processPacketDirectly(packet.header, packet.data, packet.rinfo);\n            } else {\n                break; // Wait for missing packets\n            }\n        }\n    }\n    \n    processPacketDirectly(header, audioData, rinfo) {\n        // Decompress if needed\n        if (header.flags & 0x01) {\n            audioData = this.decompressAudio(audioData);\n        }\n        \n        // Calculate and update latency\n        const latency = Date.now() - header.timestamp;\n        this.updateLatencyStats(latency);\n        \n        // Check for missing packets\n        if (header.sequence > this.expectedSequence) {\n            const missingPackets = header.sequence - this.expectedSequence;\n            console.warn(`⚠️ Missing ${missingPackets} audio packets`);\n            this.stats.packetsLost += missingPackets;\n            \n            // Handle buffer underrun\n            if (this.audioBuffer.length < 2) {\n                this.stats.bufferUnderruns++;\n            }\n        }\n        \n        this.expectedSequence = header.sequence + 1;\n        \n        // Add to audio buffer with enhanced metadata\n        this.audioBuffer.push({\n            sequence: header.sequence,\n            timestamp: header.timestamp,\n            data: audioData,\n            latency: latency,\n            qualityProfile: header.qualityProfile,\n            sampleRate: header.sampleRate,\n            bitDepth: header.bitDepth,\n            channels: header.channels\n        });\n        \n        // Emit enhanced audio data event\n        this.emit('audioData', {\n            data: audioData,\n            sequence: header.sequence,\n            timestamp: header.timestamp,\n            latency: latency,\n            source: rinfo,\n            quality: {\n                profile: header.qualityProfile,\n                sampleRate: header.sampleRate,\n                bitDepth: header.bitDepth,\n                channels: header.channels\n            }\n        });\n        \n        this.updateStats('received', audioData.length);\n        this.processAudioBuffer();\n    }\n    \n    processAudioBuffer() {\n        // Enhanced buffer management\n        while (this.audioBuffer.length > this.options.bufferSize) {\n            this.audioBuffer.shift();\n            this.stats.bufferOverruns++;\n        }\n        \n        // Sort by sequence number for proper playback order\n        this.audioBuffer.sort((a, b) => a.sequence - b.sequence);\n        \n        // Process audio chunks when we have enough data\n        const minBufferSize = Math.max(2, Math.floor(this.options.bufferSize * 0.1));\n        if (this.audioBuffer.length >= minBufferSize) {\n            const chunkSize = Math.min(4, this.audioBuffer.length);\n            const chunk = this.audioBuffer.splice(0, chunkSize);\n            const combinedData = this.combineAudioChunks(chunk);\n            \n            // Calculate quality metrics\n            const qualityMetrics = this.calculateChunkQuality(chunk);\n            \n            this.emit('processedAudio', {\n                data: combinedData,\n                duration: combinedData.length / this.options.sampleRate,\n                channels: this.options.channels,\n                sampleRate: this.options.sampleRate,\n                quality: qualityMetrics,\n                chunkInfo: {\n                    packetCount: chunk.length,\n                    avgLatency: chunk.reduce((sum, p) => sum + p.latency, 0) / chunk.length,\n                    sequenceRange: [chunk[0].sequence, chunk[chunk.length - 1].sequence]\n                }\n            });\n        }\n    }\n    \n    calculateChunkQuality(chunk) {\n        const avgLatency = chunk.reduce((sum, p) => sum + p.latency, 0) / chunk.length;\n        const latencyScore = Math.max(0, 100 - (avgLatency / 2)); // 0-100 based on latency\n        \n        const sequenceConsistency = this.calculateSequenceConsistency(chunk);\n        const consistencyScore = sequenceConsistency * 100;\n        \n        const overallScore = (latencyScore + consistencyScore) / 2;\n        \n        return {\n            score: overallScore,\n            latency: avgLatency,\n            consistency: sequenceConsistency,\n            packetCount: chunk.length\n        };\n    }\n    \n    calculateSequenceConsistency(chunk) {\n        if (chunk.length < 2) return 1.0;\n        \n        const expectedDiff = 1;\n        let consistentPairs = 0;\n        \n        for (let i = 1; i < chunk.length; i++) {\n            if (chunk[i].sequence - chunk[i-1].sequence === expectedDiff) {\n                consistentPairs++;\n            }\n        }\n        \n        return consistentPairs / (chunk.length - 1);\n    }\n    \n    // Enhanced compression with caching\n    compressAudio(audioData) {\n        const cacheKey = this.generateCompressionCacheKey(audioData);\n        \n        if (this.compressionCache.has(cacheKey)) {\n            return this.compressionCache.get(cacheKey);\n        }\n        \n        // Enhanced delta compression with adaptive prediction\n        const compressed = this.enhancedDeltaCompress(audioData);\n        \n        // Cache result\n        this.compressionCache.set(cacheKey, compressed);\n        \n        // Clean cache if it gets too large\n        if (this.compressionCache.size > 100) {\n            const firstKey = this.compressionCache.keys().next().value;\n            this.compressionCache.delete(firstKey);\n        }\n        \n        // Update compression ratio\n        this.stats.compressionRatio = compressed.length / audioData.length;\n        \n        return compressed;\n    }\n    \n    enhancedDeltaCompress(audioData) {\n        if (audioData.length < 2) return audioData;\n        \n        const compressed = new Int16Array(audioData.length);\n        compressed[0] = audioData[0];\n        \n        // Use adaptive prediction for better compression\n        let predictor = audioData[0];\n        const adaptationRate = 0.1;\n        \n        for (let i = 1; i < audioData.length; i++) {\n            const predicted = predictor;\n            const actual = audioData[i];\n            const delta = actual - predicted;\n            \n            compressed[i] = delta;\n            \n            // Update predictor\n            predictor += delta * adaptationRate;\n        }\n        \n        return compressed;\n    }\n    \n    decompressAudio(compressedData) {\n        if (compressedData.length < 2) return compressedData;\n        \n        const decompressed = new Float32Array(compressedData.length);\n        decompressed[0] = compressedData[0];\n        \n        // Reverse the adaptive prediction\n        let predictor = compressedData[0];\n        const adaptationRate = 0.1;\n        \n        for (let i = 1; i < compressedData.length; i++) {\n            const delta = compressedData[i];\n            const reconstructed = predictor + delta;\n            \n            decompressed[i] = reconstructed;\n            \n            // Update predictor (same as compression)\n            predictor += delta * adaptationRate;\n        }\n        \n        return decompressed;\n    }\n    \n    generateCompressionCacheKey(audioData) {\n        // Generate a simple hash for caching\n        let hash = 0;\n        for (let i = 0; i < Math.min(audioData.length, 16); i++) {\n            hash = ((hash << 5) - hash + audioData[i]) & 0xffffffff;\n        }\n        return hash.toString(36);\n    }\n    \n    calculateEnhancedChecksum(data) {\n        let checksum = 0;\n        for (let i = 0; i < data.length; i++) {\n            checksum = (checksum + data[i]) & 0xffffffff;\n        }\n        // Use CRC-like calculation for better error detection\n        return (checksum ^ (checksum >> 16)) & 0xff;\n    }\n    \n    verifyEnhancedChecksum(data, expectedChecksum) {\n        return this.calculateEnhancedChecksum(data) === expectedChecksum;\n    }\n    \n    // Utility methods for metrics\n    calculateAverageLatency() {\n        const recent = this.networkMetrics.latencyHistory.slice(-10);\n        if (recent.length === 0) return 0;\n        return recent.reduce((sum, item) => sum + item.value, 0) / recent.length;\n    }\n    \n    calculatePacketLoss() {\n        if (this.stats.packetsReceived === 0) return 0;\n        return this.stats.packetsLost / (this.stats.packetsReceived + this.stats.packetsLost);\n    }\n    \n    cleanupMetricHistory(history, maxAge) {\n        const cutoff = Date.now() - maxAge;\n        const index = history.findIndex(item => item.timestamp > cutoff);\n        if (index > 0) {\n            history.splice(0, index);\n        }\n    }\n    \n    cleanupOldMetrics() {\n        // Clean up old network metrics\n        this.cleanupMetricHistory(this.networkMetrics.latencyHistory, 60000);\n        this.cleanupMetricHistory(this.networkMetrics.packetLossHistory, 60000);\n        this.cleanupMetricHistory(this.networkMetrics.jitterHistory, 60000);\n    }\n    \n    updateLatencyStats(latency) {\n        const alpha = 0.1; // Smoothing factor\n        this.stats.latency = this.stats.latency * (1 - alpha) + latency * alpha;\n        \n        // Calculate jitter (variation in latency)\n        const jitter = Math.abs(latency - this.stats.latency);\n        this.stats.jitter = this.stats.jitter * (1 - alpha) + jitter * alpha;\n    }\n    \n    updateStats(direction, bytes) {\n        const now = Date.now();\n        \n        if (direction === 'transmitted') {\n            this.stats.packetsTransmitted++;\n            this.stats.bytesTransmitted += bytes;\n        } else {\n            this.stats.packetsReceived++;\n            this.stats.bytesReceived += bytes;\n        }\n        \n        this.stats.lastUpdate = now;\n    }\n    \n    resetStreamingStats() {\n        this.stats = {\n            ...this.stats,\n            packetsTransmitted: 0,\n            packetsReceived: 0,\n            bytesTransmitted: 0,\n            bytesReceived: 0,\n            packetsLost: 0,\n            adaptiveChanges: 0,\n            bufferUnderruns: 0,\n            bufferOverruns: 0\n        };\n    }\n    \n    getDetailedStats() {\n        const now = Date.now();\n        const duration = (now - this.stats.lastUpdate) / 1000;\n        \n        return {\n            ...this.stats,\n            currentQuality: this.currentQualityProfile,\n            qualityConfig: this.qualityProfiles[this.currentQualityProfile],\n            transmissionRate: duration > 0 ? this.stats.bytesTransmitted / duration : 0,\n            receptionRate: duration > 0 ? this.stats.bytesReceived / duration : 0,\n            packetLossRate: this.calculatePacketLoss(),\n            averageLatency: this.calculateAverageLatency(),\n            bufferSize: this.audioBuffer.length,\n            jitterBufferSize: this.jitterBuffer.length,\n            isStreaming: this.isStreaming,\n            protocol: this.options.protocol,\n            connectedClients: this.tcpClients.size,\n            adaptiveStreamingEnabled: this.adaptiveController.enabled,\n            compressionCacheSize: this.compressionCache.size\n        };\n    }\n    \n    // Public API methods\n    enableAdaptiveStreaming() {\n        this.adaptiveController.enabled = true;\n        console.log('📊 Adaptive streaming enabled');\n    }\n    \n    disableAdaptiveStreaming() {\n        this.adaptiveController.enabled = false;\n        console.log('📊 Adaptive streaming disabled');\n    }\n    \n    getAvailableQualityProfiles() {\n        return Object.keys(this.qualityProfiles).map(key => ({\n            name: key,\n            ...this.qualityProfiles[key]\n        }));\n    }\n    \n    getCurrentQualityProfile() {\n        return {\n            name: this.currentQualityProfile,\n            ...this.qualityProfiles[this.currentQualityProfile]\n        };\n    }\n    \n    combineAudioChunks(chunks) {\n        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);\n        const combined = new Float32Array(totalLength);\n        \n        let offset = 0;\n        for (const chunk of chunks) {\n            combined.set(chunk.data, offset);\n            offset += chunk.data.length;\n        }\n        \n        return combined;\n    }\n    \n    destroy() {\n        this.stopStreaming();\n        \n        // Clear monitoring interval\n        if (this.qualityMonitoringInterval) {\n            clearInterval(this.qualityMonitoringInterval);\n        }\n        \n        // Close network connections\n        if (this.udpSocket) {\n            this.udpSocket.close();\n        }\n        \n        if (this.tcpServer) {\n            for (const client of this.tcpClients) {\n                client.destroy();\n            }\n            this.tcpServer.close();\n        }\n        \n        // Clear caches\n        this.compressionCache.clear();\n        this.audioBuffer = [];\n        this.jitterBuffer = [];\n        \n        this.removeAllListeners();\n        console.log('🗑️ Enhanced Audio Stream Service destroyed');\n    }\n}\n\nmodule.exports = EnhancedAudioStreamService;"