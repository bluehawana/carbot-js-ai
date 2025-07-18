class CarFeatures {
    constructor() {
        this.features = {
            navigation: {
                active: false,
                destination: null,
                currentLocation: null,
                route: null,
                eta: null,
                trafficInfo: null
            },
            music: {
                playing: false,
                currentSong: null,
                volume: 50,
                source: 'radio',
                playlist: null
            },
            phone: {
                connected: false,
                activeCall: false,
                contacts: [],
                recentCalls: []
            },
            vehicle: {
                speed: 0,
                fuelLevel: 100,
                batteryLevel: 100,
                engineTemperature: 90,
                oilLevel: 100,
                tirePressure: {
                    frontLeft: 32,
                    frontRight: 32,
                    rearLeft: 32,
                    rearRight: 32
                }
            },
            climate: {
                temperature: 72,
                fanSpeed: 3,
                acOn: false,
                heaterOn: false,
                autoMode: true
            },
            safety: {
                seatbeltFastened: true,
                doorsLocked: true,
                emergencyMode: false,
                blindSpotDetection: true,
                laneKeepAssist: true
            }
        };
    }

    // Navigation features
    startNavigation(destination, currentLocation) {
        this.features.navigation = {
            active: true,
            destination: destination,
            currentLocation: currentLocation,
            route: this.calculateRoute(currentLocation, destination),
            eta: this.calculateETA(currentLocation, destination),
            trafficInfo: this.getTrafficInfo(currentLocation, destination)
        };
        
        return {
            success: true,
            message: `Navigation started to ${destination}`,
            eta: this.features.navigation.eta,
            distance: this.features.navigation.route.distance
        };
    }

    stopNavigation() {
        this.features.navigation.active = false;
        this.features.navigation.destination = null;
        this.features.navigation.route = null;
        
        return {
            success: true,
            message: 'Navigation stopped'
        };
    }

    calculateRoute(from, to) {
        // Mock route calculation
        return {
            distance: '15.3 miles',
            duration: '22 minutes',
            via: 'I-95 N'
        };
    }

    calculateETA(from, to) {
        // Mock ETA calculation
        const now = new Date();
        const eta = new Date(now.getTime() + (22 * 60 * 1000)); // 22 minutes from now
        return eta.toLocaleTimeString();
    }

    getTrafficInfo(from, to) {
        // Mock traffic info
        return {
            status: 'light',
            delays: 0,
            accidents: 0,
            construction: 1
        };
    }

    // Music features
    playMusic(query) {
        this.features.music = {
            playing: true,
            currentSong: query,
            volume: this.features.music.volume,
            source: 'streaming',
            playlist: null
        };
        
        return {
            success: true,
            message: `Now playing: ${query}`,
            song: query
        };
    }

    pauseMusic() {
        this.features.music.playing = false;
        
        return {
            success: true,
            message: 'Music paused'
        };
    }

    nextTrack() {
        // Mock next track
        const nextSong = 'Next Song Title';
        this.features.music.currentSong = nextSong;
        
        return {
            success: true,
            message: `Now playing: ${nextSong}`,
            song: nextSong
        };
    }

    adjustVolume(level) {
        this.features.music.volume = Math.max(0, Math.min(100, level));
        
        return {
            success: true,
            message: `Volume set to ${this.features.music.volume}%`,
            volume: this.features.music.volume
        };
    }

    // Phone features
    makeCall(contact) {
        this.features.phone = {
            connected: true,
            activeCall: true,
            contacts: this.features.phone.contacts,
            recentCalls: [...this.features.phone.recentCalls, contact]
        };
        
        return {
            success: true,
            message: `Calling ${contact}`,
            contact: contact
        };
    }

    endCall() {
        this.features.phone.activeCall = false;
        
        return {
            success: true,
            message: 'Call ended'
        };
    }

    // Vehicle status
    getVehicleStatus() {
        return {
            speed: this.features.vehicle.speed,
            fuelLevel: this.features.vehicle.fuelLevel,
            batteryLevel: this.features.vehicle.batteryLevel,
            engineTemperature: this.features.vehicle.engineTemperature,
            oilLevel: this.features.vehicle.oilLevel,
            tirePressure: this.features.vehicle.tirePressure
        };
    }

    checkFuelLevel() {
        const level = this.features.vehicle.fuelLevel;
        let message = `Fuel level is at ${level}%`;
        
        if (level < 20) {
            message += '. You should refuel soon.';
        } else if (level < 10) {
            message += '. Please refuel immediately!';
        }
        
        return {
            level: level,
            message: message,
            warning: level < 20
        };
    }

    // Climate control
    setTemperature(temperature) {
        this.features.climate.temperature = Math.max(60, Math.min(85, temperature));
        
        return {
            success: true,
            message: `Temperature set to ${this.features.climate.temperature}°F`,
            temperature: this.features.climate.temperature
        };
    }

    toggleAC() {
        this.features.climate.acOn = !this.features.climate.acOn;
        
        return {
            success: true,
            message: `Air conditioning ${this.features.climate.acOn ? 'on' : 'off'}`,
            acOn: this.features.climate.acOn
        };
    }

    // Safety features
    checkSafetyStatus() {
        const safety = this.features.safety;
        let warnings = [];
        
        if (!safety.seatbeltFastened) {
            warnings.push('Seatbelt not fastened');
        }
        
        if (!safety.doorsLocked) {
            warnings.push('Doors not locked');
        }
        
        return {
            status: warnings.length === 0 ? 'safe' : 'warning',
            warnings: warnings,
            blindSpotDetection: safety.blindSpotDetection,
            laneKeepAssist: safety.laneKeepAssist
        };
    }

    // Emergency features
    activateEmergencyMode() {
        this.features.safety.emergencyMode = true;
        
        return {
            success: true,
            message: 'Emergency mode activated',
            actions: [
                'Calling emergency services',
                'Sending location to emergency contacts',
                'Activating hazard lights',
                'Unlocking doors'
            ]
        };
    }

    // Convenience features
    findNearbyServices(serviceType) {
        const services = {
            gas: ['Shell Station - 0.5 miles', 'BP - 1.2 miles', 'Exxon - 1.8 miles'],
            restaurant: ['McDonald\'s - 0.3 miles', 'Subway - 0.7 miles', 'Starbucks - 1.1 miles'],
            hospital: ['City Hospital - 2.5 miles', 'Urgent Care - 1.8 miles'],
            parking: ['City Parking Garage - 0.4 miles', 'Street Parking - 0.2 miles']
        };
        
        return {
            serviceType: serviceType,
            locations: services[serviceType] || [],
            message: `Found ${(services[serviceType] || []).length} nearby ${serviceType} locations`
        };
    }

    // Get all features status
    getAllFeatures() {
        return {
            navigation: this.features.navigation,
            music: this.features.music,
            phone: this.features.phone,
            vehicle: this.features.vehicle,
            climate: this.features.climate,
            safety: this.features.safety
        };
    }

    // Update vehicle data (called by car systems)
    updateVehicleData(data) {
        this.features.vehicle = { ...this.features.vehicle, ...data };
    }

    // Get context for conversation
    getCarContext() {
        return {
            speed: this.features.vehicle.speed,
            location: this.features.navigation.currentLocation,
            destination: this.features.navigation.destination,
            navigationActive: this.features.navigation.active,
            musicPlaying: this.features.music.playing,
            currentSong: this.features.music.currentSong,
            activeCall: this.features.phone.activeCall,
            emergencyMode: this.features.safety.emergencyMode
        };
    }
}

module.exports = CarFeatures;