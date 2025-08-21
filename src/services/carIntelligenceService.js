const EventEmitter = require('events');

/**
 * Car Intelligence Service
 * 
 * Provides intelligent car-specific features:
 * - Location-based recommendations
 * - Traffic-aware suggestions
 * - Proactive assistance based on driving context
 * - Emergency and safety intelligence
 * - Route optimization with contextual awareness
 */
class CarIntelligenceService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            proactiveMode: options.proactiveMode ?? true,
            locationRadius: options.locationRadius || 5000, // 5km default
            trafficUpdateInterval: options.trafficUpdateInterval || 60000, // 1 minute
            fuelThreshold: options.fuelThreshold || 20, // 20% fuel level
            maintenanceReminder: options.maintenanceReminder ?? true,
            ...options
        };

        // Intelligence databases
        this.locationDatabase = new Map(); // POI and location intelligence
        this.routeMemory = new Map(); // Learned routes and preferences
        this.trafficPatterns = new Map(); // Traffic pattern intelligence
        this.userBehavior = new Map(); // Learned user behavior patterns
        
        // Current car state
        this.carState = {
            location: null,
            speed: 0,
            isMoving: false,
            fuelLevel: null,
            batteryLevel: null,
            engineHealth: 'good',
            mileage: null,
            lastMaintenance: null
        };

        // Trip intelligence
        this.currentTrip = {
            origin: null,
            destination: null,
            route: null,
            traffic: null,
            alternatives: [],
            suggestions: []
        };

        // Points of Interest categories
        this.poiCategories = {
            fuel: ['gas_station', 'petrol_station', 'fuel_station'],
            food: ['restaurant', 'fast_food', 'cafe', 'food_court'],
            rest: ['rest_area', 'hotel', 'motel', 'parking'],
            shopping: ['shopping_mall', 'grocery_store', 'supermarket'],
            emergency: ['hospital', 'police', 'fire_station'],
            maintenance: ['car_repair', 'car_wash', 'tire_shop']
        };

        // Real-time data cache
        this.realtimeCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

        console.log('🚗 Car Intelligence Service initialized');
    }

    /**
     * Update car state
     */
    updateCarState(newState) {
        const previousState = { ...this.carState };
        this.carState = { ...this.carState, ...newState };
        
        // Analyze state changes for proactive suggestions
        if (this.options.proactiveMode) {
            this.analyzeStateChanges(previousState, this.carState);
        }
        
        this.emit('carStateUpdated', this.carState);
    }

    /**
     * Set current trip information
     */
    setCurrentTrip(tripData) {
        this.currentTrip = {
            origin: tripData.origin || this.carState.location,
            destination: tripData.destination,
            route: tripData.route || null,
            startTime: Date.now(),
            estimatedDuration: tripData.estimatedDuration,
            purpose: tripData.purpose || 'general'
        };
        
        // Generate initial trip intelligence
        this.generateTripIntelligence();
        
        this.emit('tripSet', this.currentTrip);
    }

    /**
     * Get contextual suggestions based on current situation
     */
    async getContextualSuggestions(userQuery, drivingContext) {
        const suggestions = [];
        
        try {
            // Location-based suggestions
            const locationSuggestions = await this.getLocationBasedSuggestions(drivingContext);
            suggestions.push(...locationSuggestions);
            
            // Route optimization suggestions
            if (this.currentTrip.destination) {
                const routeSuggestions = await this.getRouteOptimizationSuggestions();
                suggestions.push(...routeSuggestions);
            }
            
            // Maintenance and car health suggestions
            const maintenanceSuggestions = this.getMaintenanceSuggestions();
            suggestions.push(...maintenanceSuggestions);
            
            // Traffic and timing suggestions
            const trafficSuggestions = await this.getTrafficSuggestions(drivingContext);
            suggestions.push(...trafficSuggestions);
            
            // Query-specific suggestions
            const querySpecificSuggestions = this.getQuerySpecificSuggestions(userQuery, drivingContext);
            suggestions.push(...querySpecificSuggestions);
            
            // Rank suggestions by relevance and importance
            const rankedSuggestions = this.rankSuggestions(suggestions, userQuery, drivingContext);
            
            return rankedSuggestions;
            
        } catch (error) {
            console.error('🚗 Error generating contextual suggestions:', error);
            return [];
        }
    }

    /**
     * Get proactive suggestions without user query
     */
    async getProactiveSuggestions(drivingContext, conversationAnalysis = {}) {
        if (!this.options.proactiveMode) return [];
        
        const suggestions = [];
        
        try {
            // Fuel/battery level suggestions
            if (this.carState.fuelLevel && this.carState.fuelLevel < this.options.fuelThreshold) {
                suggestions.push({
                    type: 'fuel_low',
                    priority: 'high',
                    message: `Your fuel is low at ${this.carState.fuelLevel}%. I found a gas station 2 miles ahead.`,
                    action: 'navigate_to_fuel',
                    data: await this.findNearestPOI('fuel')
                });
            }
            
            // Traffic delay suggestions
            if (this.currentTrip.destination && drivingContext.trafficCondition === 'heavy') {
                suggestions.push({
                    type: 'traffic_delay',
                    priority: 'medium',
                    message: 'Heavy traffic ahead. Would you like me to find an alternative route?',
                    action: 'suggest_alternative_route',
                    data: await this.findAlternativeRoute()
                });
            }
            
            // Time-based suggestions
            const timeSuggestions = this.getTimeBasedSuggestions(drivingContext);
            suggestions.push(...timeSuggestions);
            
            // Weather-based suggestions
            if (drivingContext.weatherCondition && drivingContext.weatherCondition !== 'clear') {
                suggestions.push({
                    type: 'weather_advisory',
                    priority: 'medium',
                    message: `${drivingContext.weatherCondition} conditions ahead. Drive safely and consider reducing speed.`,
                    action: 'weather_precaution'
                });
            }
            
            // Destination arrival suggestions
            if (this.currentTrip.destination && this.isNearDestination()) {
                const arrivalSuggestions = await this.getArrivalSuggestions();
                suggestions.push(...arrivalSuggestions);
            }
            
            return this.rankSuggestions(suggestions, null, drivingContext);
            
        } catch (error) {
            console.error('🚗 Error generating proactive suggestions:', error);
            return [];
        }
    }

    /**
     * Get location-based suggestions
     */
    async getLocationBasedSuggestions(drivingContext) {
        const suggestions = [];
        
        if (!this.carState.location) return suggestions;
        
        try {
            // Find nearby POIs based on context
            const nearbyRestaurants = await this.findNearbyPOI('food', 3);
            const nearbyFuel = await this.findNearbyPOI('fuel', 2);
            
            // Add contextual suggestions
            if (this.isLunchTime() && nearbyRestaurants.length > 0) {
                suggestions.push({
                    type: 'meal_suggestion',
                    priority: 'low',
                    message: `It's lunch time. I found some good restaurants nearby. ${nearbyRestaurants[0].name} is just 0.5 miles away.`,
                    action: 'navigate_to_restaurant',
                    data: nearbyRestaurants[0]
                });
            }
            
            if (this.carState.fuelLevel < 50 && nearbyFuel.length > 0) {
                suggestions.push({
                    type: 'fuel_suggestion',
                    priority: 'medium',
                    message: `Your fuel is at ${this.carState.fuelLevel}%. There's a gas station ${nearbyFuel[0].distance} away.`,
                    action: 'navigate_to_fuel',
                    data: nearbyFuel[0]
                });
            }
            
        } catch (error) {
            console.warn('⚠️ Location-based suggestions failed:', error.message);
        }
        
        return suggestions;
    }

    /**
     * Get route optimization suggestions
     */
    async getRouteOptimizationSuggestions() {
        const suggestions = [];
        
        if (!this.currentTrip.destination) return suggestions;
        
        try {
            // Check for better routes
            const alternativeRoutes = await this.findAlternativeRoute();
            
            if (alternativeRoutes && alternativeRoutes.length > 0) {
                const bestAlternative = alternativeRoutes[0];
                
                if (bestAlternative.timeSaving > 5) { // 5 minutes or more
                    suggestions.push({
                        type: 'route_optimization',
                        priority: 'medium',
                        message: `I found a faster route that saves ${bestAlternative.timeSaving} minutes. Would you like to take it?`,
                        action: 'switch_route',
                        data: bestAlternative
                    });
                }
            }
            
            // Suggest scenic routes for leisure trips
            if (this.currentTrip.purpose === 'leisure') {
                suggestions.push({
                    type: 'scenic_route',
                    priority: 'low',
                    message: 'Since you have time, would you like to take the scenic route? It adds 10 minutes but has beautiful views.',
                    action: 'suggest_scenic_route'
                });
            }
            
        } catch (error) {
            console.warn('⚠️ Route optimization suggestions failed:', error.message);
        }
        
        return suggestions;
    }

    /**
     * Get maintenance suggestions
     */
    getMaintenanceSuggestions() {
        const suggestions = [];
        
        if (!this.options.maintenanceReminder) return suggestions;
        
        // Oil change reminder
        if (this.carState.mileage && this.needsOilChange()) {
            suggestions.push({
                type: 'maintenance_oil',
                priority: 'medium',
                message: `You're due for an oil change. Current mileage: ${this.carState.mileage}. Shall I find a nearby service center?`,
                action: 'find_maintenance'
            });
        }
        
        // Engine health warnings
        if (this.carState.engineHealth !== 'good') {
            suggestions.push({
                type: 'maintenance_engine',
                priority: 'high',
                message: `Engine diagnostics show potential issues. I recommend visiting a mechanic soon.`,
                action: 'find_mechanic'
            });
        }
        
        // Tire pressure (simulated)
        if (Math.random() < 0.1) { // 10% chance for demo
            suggestions.push({
                type: 'maintenance_tires',
                priority: 'medium',
                message: 'Your tire pressure seems low. Check it at the next gas station.',
                action: 'tire_check_reminder'
            });
        }
        
        return suggestions;
    }

    /**
     * Get traffic-based suggestions
     */
    async getTrafficSuggestions(drivingContext) {
        const suggestions = [];
        
        try {
            // Rush hour warnings
            if (this.isRushHour() && drivingContext.isMoving) {
                suggestions.push({
                    type: 'traffic_timing',
                    priority: 'low',
                    message: 'Traffic is heavy during rush hour. Consider leaving 15 minutes earlier next time.',
                    action: 'traffic_advisory'
                });
            }
            
            // Traffic incident warnings
            if (drivingContext.trafficCondition === 'heavy') {
                suggestions.push({
                    type: 'traffic_incident',
                    priority: 'medium',
                    message: 'Heavy traffic detected ahead. Estimated delay: 10 minutes.',
                    action: 'traffic_update'
                });
            }
            
        } catch (error) {
            console.warn('⚠️ Traffic suggestions failed:', error.message);
        }
        
        return suggestions;
    }

    /**
     * Get query-specific suggestions
     */
    getQuerySpecificSuggestions(userQuery, drivingContext) {
        const suggestions = [];
        const lowerQuery = userQuery.toLowerCase();
        
        // Music suggestions
        if (lowerQuery.includes('music') || lowerQuery.includes('play')) {
            suggestions.push({
                type: 'music_suggestion',
                priority: 'low',
                message: 'Based on your usual preferences, would you like me to play your driving playlist?',
                action: 'play_driving_playlist'
            });
        }
        
        // Navigation suggestions
        if (lowerQuery.includes('navigate') || lowerQuery.includes('directions')) {
            const recentDestinations = this.getRecentDestinations();
            if (recentDestinations.length > 0) {
                suggestions.push({
                    type: 'navigation_suggestion',
                    priority: 'medium',
                    message: `Would you like to go to one of your recent destinations? ${recentDestinations[0].name}?`,
                    action: 'navigate_recent',
                    data: recentDestinations[0]
                });
            }
        }
        
        // Food suggestions
        if (lowerQuery.includes('food') || lowerQuery.includes('restaurant') || lowerQuery.includes('eat')) {
            suggestions.push({
                type: 'food_suggestion',
                priority: 'medium',
                message: 'I can find restaurants along your route. What type of cuisine are you in the mood for?',
                action: 'food_search'
            });
        }
        
        return suggestions;
    }

    /**
     * Get time-based suggestions
     */
    getTimeBasedSuggestions(drivingContext) {
        const suggestions = [];
        const hour = new Date().getHours();
        
        // Morning suggestions
        if (hour >= 6 && hour <= 9) {
            suggestions.push({
                type: 'morning_routine',
                priority: 'low',
                message: 'Good morning! Would you like me to check traffic to your usual work location?',
                action: 'check_work_traffic'
            });
        }
        
        // Evening suggestions
        if (hour >= 17 && hour <= 19) {
            suggestions.push({
                type: 'evening_routine',
                priority: 'low',
                message: 'Evening traffic can be heavy. Would you like me to find the best route home?',
                action: 'navigate_home'
            });
        }
        
        // Late night safety
        if (hour >= 22 || hour <= 5) {
            suggestions.push({
                type: 'night_safety',
                priority: 'medium',
                message: 'Driving late at night. Please stay alert and consider taking breaks if you feel tired.',
                action: 'safety_reminder'
            });
        }
        
        return suggestions;
    }

    /**
     * Get arrival suggestions
     */
    async getArrivalSuggestions() {
        const suggestions = [];
        
        if (!this.currentTrip.destination) return suggestions;
        
        try {
            // Parking suggestions
            const nearbyParking = await this.findNearbyPOI('parking', 3);
            if (nearbyParking.length > 0) {
                suggestions.push({
                    type: 'parking_suggestion',
                    priority: 'medium',
                    message: `You'll arrive in 5 minutes. I found parking options nearby. ${nearbyParking[0].name} has availability.`,
                    action: 'show_parking',
                    data: nearbyParking[0]
                });
            }
            
            // Meeting preparation
            if (this.currentTrip.purpose === 'work') {
                suggestions.push({
                    type: 'meeting_prep',
                    priority: 'low',
                    message: 'You\'ll arrive at your destination soon. Would you like me to set a reminder for your meeting?',
                    action: 'meeting_reminder'
                });
            }
            
        } catch (error) {
            console.warn('⚠️ Arrival suggestions failed:', error.message);
        }
        
        return suggestions;
    }

    /**
     * Find nearby POI
     */
    async findNearbyPOI(category, limit = 5) {
        // Simulated POI data - in real implementation, this would use Google Places API
        const simulatedPOIs = {
            fuel: [
                { name: 'Shell Station', distance: '0.5 miles', price: '$3.89/gal', rating: 4.2 },
                { name: 'Chevron', distance: '1.2 miles', price: '$3.92/gal', rating: 4.0 }
            ],
            food: [
                { name: 'McDonald\'s', distance: '0.3 miles', type: 'fast_food', rating: 3.8 },
                { name: 'Olive Garden', distance: '0.8 miles', type: 'restaurant', rating: 4.3 },
                { name: 'Starbucks', distance: '0.4 miles', type: 'cafe', rating: 4.1 }
            ],
            parking: [
                { name: 'Downtown Parking Garage', distance: '0.2 miles', hourlyRate: '$5', availability: 'high' },
                { name: 'Street Parking', distance: '0.1 miles', hourlyRate: '$2', availability: 'medium' }
            ]
        };
        
        return simulatedPOIs[category] || [];
    }

    /**
     * Find alternative routes
     */
    async findAlternativeRoute() {
        // Simulated alternative route data
        return [
            {
                name: 'Highway Route',
                timeSaving: 8,
                distance: '15.2 miles',
                trafficLevel: 'light',
                tolls: '$2.50'
            },
            {
                name: 'Scenic Route',
                timeSaving: -10,
                distance: '18.5 miles',
                trafficLevel: 'none',
                tolls: '$0'
            }
        ];
    }

    /**
     * Rank suggestions by relevance and importance
     */
    rankSuggestions(suggestions, userQuery, drivingContext) {
        return suggestions
            .map(suggestion => ({
                ...suggestion,
                relevanceScore: this.calculateRelevanceScore(suggestion, userQuery, drivingContext)
            }))
            .sort((a, b) => {
                // Sort by priority first, then by relevance score
                const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                
                if (priorityDiff !== 0) return priorityDiff;
                
                return b.relevanceScore - a.relevanceScore;
            })
            .slice(0, 3); // Return top 3 suggestions
    }

    /**
     * Calculate relevance score for a suggestion
     */
    calculateRelevanceScore(suggestion, userQuery, drivingContext) {
        let score = 0.5; // Base score
        
        // Query relevance
        if (userQuery) {
            const queryLower = userQuery.toLowerCase();
            if (queryLower.includes(suggestion.type) || 
                suggestion.message.toLowerCase().includes(queryLower.split(' ')[0])) {
                score += 0.3;
            }
        }
        
        // Context relevance
        if (drivingContext.isMoving && suggestion.type.includes('traffic')) {
            score += 0.2;
        }
        
        if (!drivingContext.isMoving && suggestion.type.includes('parking')) {
            score += 0.2;
        }
        
        // Time relevance
        if (this.isTimeRelevant(suggestion)) {
            score += 0.2;
        }
        
        // Safety relevance
        if (suggestion.type.includes('safety') || suggestion.type.includes('maintenance')) {
            score += 0.1;
        }
        
        return Math.min(1.0, score);
    }

    /**
     * Helper methods
     */
    analyzeStateChanges(previous, current) {
        // Analyze significant state changes for proactive suggestions
        if (current.fuelLevel < 20 && previous.fuelLevel >= 20) {
            this.emit('lowFuelDetected', current.fuelLevel);
        }
        
        if (!previous.isMoving && current.isMoving) {
            this.emit('tripStarted', current);
        }
        
        if (previous.isMoving && !current.isMoving) {
            this.emit('tripEnded', current);
        }
    }

    generateTripIntelligence() {
        // Generate intelligent insights for the current trip
        if (!this.currentTrip.destination) return;
        
        // Store trip pattern for learning
        const tripPattern = {
            origin: this.currentTrip.origin,
            destination: this.currentTrip.destination,
            time: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            purpose: this.currentTrip.purpose
        };
        
        this.storeRouteMemory(tripPattern);
    }

    storeRouteMemory(tripPattern) {
        const routeKey = `${tripPattern.origin}_${tripPattern.destination}`;
        
        if (!this.routeMemory.has(routeKey)) {
            this.routeMemory.set(routeKey, {
                count: 0,
                avgDuration: 0,
                commonTimes: [],
                purposes: new Set()
            });
        }
        
        const routeData = this.routeMemory.get(routeKey);
        routeData.count++;
        routeData.commonTimes.push(tripPattern.time);
        routeData.purposes.add(tripPattern.purpose);
        
        this.routeMemory.set(routeKey, routeData);
    }

    getRecentDestinations() {
        // Return recent destinations based on route memory
        const recentDestinations = [];
        
        for (const [route, data] of this.routeMemory.entries()) {
            const [origin, destination] = route.split('_');
            recentDestinations.push({
                name: destination,
                count: data.count,
                lastUsed: Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000) // Random recent time
            });
        }
        
        return recentDestinations
            .sort((a, b) => b.lastUsed - a.lastUsed)
            .slice(0, 3);
    }

    isNearDestination() {
        // Simulate being near destination
        return this.currentTrip.destination && Math.random() < 0.3;
    }

    isLunchTime() {
        const hour = new Date().getHours();
        return hour >= 11 && hour <= 14;
    }

    isRushHour() {
        const hour = new Date().getHours();
        return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
    }

    needsOilChange() {
        if (!this.carState.mileage) return false;
        return this.carState.mileage % 5000 < 100; // Due every 5000 miles
    }

    isTimeRelevant(suggestion) {
        const hour = new Date().getHours();
        
        if (suggestion.type === 'morning_routine' && hour >= 6 && hour <= 9) return true;
        if (suggestion.type === 'evening_routine' && hour >= 17 && hour <= 19) return true;
        if (suggestion.type === 'meal_suggestion' && this.isLunchTime()) return true;
        
        return false;
    }

    /**
     * Get car intelligence statistics
     */
    getIntelligenceStats() {
        return {
            routeMemory: this.routeMemory.size,
            locationDatabase: this.locationDatabase.size,
            trafficPatterns: this.trafficPatterns.size,
            userBehavior: this.userBehavior.size,
            currentTrip: this.currentTrip.destination ? {
                hasDestination: true,
                purpose: this.currentTrip.purpose
            } : { hasDestination: false },
            carState: {
                location: !!this.carState.location,
                fuelLevel: this.carState.fuelLevel,
                isMoving: this.carState.isMoving
            }
        };
    }

    /**
     * Test intelligence capabilities
     */
    async testIntelligence() {
        const testResults = [];
        
        // Test location-based suggestions
        try {
            const locationSuggestions = await this.getLocationBasedSuggestions({
                isMoving: true,
                location: 'Test Location'
            });
            testResults.push({
                test: 'location_suggestions',
                success: true,
                suggestions: locationSuggestions.length
            });
        } catch (error) {
            testResults.push({
                test: 'location_suggestions',
                success: false,
                error: error.message
            });
        }
        
        // Test proactive suggestions
        try {
            const proactiveSuggestions = await this.getProactiveSuggestions({
                isMoving: false,
                trafficCondition: 'heavy'
            });
            testResults.push({
                test: 'proactive_suggestions',
                success: true,
                suggestions: proactiveSuggestions.length
            });
        } catch (error) {
            testResults.push({
                test: 'proactive_suggestions',
                success: false,
                error: error.message
            });
        }
        
        return testResults;
    }

    /**
     * Clear intelligence data
     */
    clearIntelligenceData() {
        this.routeMemory.clear();
        this.locationDatabase.clear();
        this.trafficPatterns.clear();
        this.userBehavior.clear();
        this.realtimeCache.clear();
        console.log('🗑️ Car intelligence data cleared');
    }

    /**
     * Destroy service
     */
    destroy() {
        this.clearIntelligenceData();
        this.removeAllListeners();
        console.log('🗑️ Car Intelligence Service destroyed');
    }
}

module.exports = CarIntelligenceService;