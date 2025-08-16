const axios = require('axios');

class LocationService {
    constructor(config = {}) {
        this.cache = new Map();
        this.cacheTimeout = config.cacheTimeout || 30 * 60 * 1000; // 30 minutes for location data
        
        // Configure location search providers
        this.providers = {
            // Google Places API (requires API key)
            googlePlaces: {
                enabled: !!process.env.GOOGLE_PLACES_API_KEY,
                baseUrl: 'https://maps.googleapis.com/maps/api/place/',
                apiKey: process.env.GOOGLE_PLACES_API_KEY,
                name: 'Google Places'
            },
            // Foursquare Places API (requires API key)
            foursquare: {
                enabled: !!process.env.FOURSQUARE_API_KEY,
                baseUrl: 'https://api.foursquare.com/v3/places/',
                apiKey: process.env.FOURSQUARE_API_KEY,
                name: 'Foursquare'
            },
            // OpenStreetMap Nominatim (free, no API key needed)
            nominatim: {
                enabled: true,
                baseUrl: 'https://nominatim.openstreetmap.org/',
                name: 'OpenStreetMap'
            },
            // Yelp Fusion API (requires API key)
            yelp: {
                enabled: !!process.env.YELP_API_KEY,
                baseUrl: 'https://api.yelp.com/v3/businesses/',
                apiKey: process.env.YELP_API_KEY,
                name: 'Yelp'
            },
            // TripAdvisor API (requires API key)
            tripadvisor: {
                enabled: !!process.env.TRIPADVISOR_API_KEY,
                baseUrl: 'https://api.tripadvisor.com/api/partner/2.0/',
                apiKey: process.env.TRIPADVISOR_API_KEY,
                name: 'TripAdvisor'
            }
        };

        // Default location (can be updated based on car GPS)
        this.currentLocation = {
            lat: config.defaultLat || 57.7089, // Gothenburg default
            lng: config.defaultLng || 11.9746,
            city: config.defaultCity || 'Gothenburg',
            country: config.defaultCountry || 'Sweden'
        };

        console.log('📍 Location Service initialized');
        this.logAvailableProviders();
    }

    logAvailableProviders() {
        Object.entries(this.providers).forEach(([key, provider]) => {
            if (provider.enabled) {
                console.log(`✅ ${provider.name} available`);
            } else {
                console.log(`⚠️  ${provider.name} not configured`);
            }
        });
    }

    /**
     * Update current location from car GPS
     */
    updateLocation(lat, lng, city = null, country = null) {
        this.currentLocation = {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            city: city || this.currentLocation.city,
            country: country || this.currentLocation.country
        };
        console.log(`📍 Location updated: ${lat}, ${lng}`);
    }

    /**
     * Get cached data or fetch new data
     */
    async getCachedOrFetch(cacheKey, fetchFunction) {
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            console.log(`📍 Using cached location data for ${cacheKey}`);
            return cached.data;
        }

        try {
            const data = await fetchFunction();
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
            return data;
        } catch (error) {
            // Return cached data if available, even if expired
            if (cached) {
                console.warn(`⚠️  Location search failed, using stale cache for ${cacheKey}`);
                return cached.data;
            }
            throw error;
        }
    }

    /**
     * Search for restaurants using multiple sources
     */
    async searchRestaurants(query, location = null, radius = 5000) {
        const searchLocation = location || this.currentLocation;
        const cacheKey = `restaurants_${encodeURIComponent(query)}_${searchLocation.lat}_${searchLocation.lng}_${radius}`;
        
        return this.getCachedOrFetch(cacheKey, async () => {
            const results = [];
            
            // Try Google Places first
            if (this.providers.googlePlaces.enabled) {
                try {
                    const googleResults = await this.searchGooglePlaces(query, 'restaurant', searchLocation, radius);
                    results.push(...googleResults.places);
                } catch (error) {
                    console.warn('Google Places restaurant search failed:', error.message);
                }
            }
            
            // Try Foursquare
            if (this.providers.foursquare.enabled) {
                try {
                    const foursquareResults = await this.searchFoursquare(query, 'restaurant', searchLocation, radius);
                    results.push(...foursquareResults.places);
                } catch (error) {
                    console.warn('Foursquare restaurant search failed:', error.message);
                }
            }
            
            // Try Yelp
            if (this.providers.yelp.enabled) {
                try {
                    const yelpResults = await this.searchYelp(query, searchLocation, radius);
                    results.push(...yelpResults.places);
                } catch (error) {
                    console.warn('Yelp restaurant search failed:', error.message);
                }
            }
            
            // Try TripAdvisor
            if (this.providers.tripadvisor.enabled) {
                try {
                    const tripAdvisorResults = await this.searchTripAdvisor(query, searchLocation, radius);
                    results.push(...tripAdvisorResults.places);
                } catch (error) {
                    console.warn('TripAdvisor restaurant search failed:', error.message);
                }
            }
            
            // Fallback to Nominatim if no other results
            if (results.length === 0) {
                try {
                    const nominatimResults = await this.searchNominatim(query + ' restaurant', searchLocation);
                    results.push(...nominatimResults.places);
                } catch (error) {
                    console.warn('Nominatim restaurant search failed:', error.message);
                }
            }
            
            return {
                query: query,
                location: searchLocation,
                radius: radius,
                places: this.removeDuplicates(results),
                timestamp: new Date().toISOString()
            };
        });
    }

    /**
     * Search for general places/points of interest
     */
    async searchPlaces(query, type = 'establishment', location = null, radius = 10000) {
        const searchLocation = location || this.currentLocation;
        const cacheKey = `places_${encodeURIComponent(query)}_${type}_${searchLocation.lat}_${searchLocation.lng}_${radius}`;
        
        return this.getCachedOrFetch(cacheKey, async () => {
            const results = [];
            
            // Try Google Places first
            if (this.providers.googlePlaces.enabled) {
                try {
                    const googleResults = await this.searchGooglePlaces(query, type, searchLocation, radius);
                    results.push(...googleResults.places);
                } catch (error) {
                    console.warn('Google Places search failed:', error.message);
                }
            }
            
            // Try Foursquare
            if (this.providers.foursquare.enabled) {
                try {
                    const foursquareResults = await this.searchFoursquare(query, type, searchLocation, radius);
                    results.push(...foursquareResults.places);
                } catch (error) {
                    console.warn('Foursquare search failed:', error.message);
                }
            }
            
            // Try Nominatim
            try {
                const nominatimResults = await this.searchNominatim(query, searchLocation);
                results.push(...nominatimResults.places);
            } catch (error) {
                console.warn('Nominatim search failed:', error.message);
            }
            
            return {
                query: query,
                type: type,
                location: searchLocation,
                radius: radius,
                places: this.removeDuplicates(results),
                timestamp: new Date().toISOString()
            };
        });
    }

    /**
     * Search using Google Places API
     */
    async searchGooglePlaces(query, type, location, radius = 5000) {
        try {
            const response = await axios.get(`${this.providers.googlePlaces.baseUrl}nearbysearch/json`, {
                params: {
                    location: `${location.lat},${location.lng}`,
                    radius: radius,
                    keyword: query,
                    type: type,
                    key: this.providers.googlePlaces.apiKey
                },
                timeout: 10000
            });

            const places = (response.data.results || []).map(place => ({
                name: place.name,
                address: place.vicinity,
                rating: place.rating,
                priceLevel: place.price_level,
                types: place.types,
                location: {
                    lat: place.geometry.location.lat,
                    lng: place.geometry.location.lng
                },
                placeId: place.place_id,
                photos: place.photos ? place.photos.map(photo => ({
                    reference: photo.photo_reference,
                    width: photo.width,
                    height: photo.height
                })) : [],
                source: 'Google Places',
                isOpen: place.opening_hours ? place.opening_hours.open_now : null
            }));

            return {
                provider: 'Google Places',
                places: places,
                status: response.data.status
            };
        } catch (error) {
            console.error('Google Places API error:', error.message);
            throw new Error(`Google Places search failed: ${error.message}`);
        }
    }

    /**
     * Search using Foursquare Places API
     */
    async searchFoursquare(query, type, location, radius = 5000) {
        try {
            const response = await axios.get(`${this.providers.foursquare.baseUrl}search`, {
                params: {
                    query: query,
                    ll: `${location.lat},${location.lng}`,
                    radius: radius,
                    limit: 10
                },
                headers: {
                    'Authorization': this.providers.foursquare.apiKey,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            const places = (response.data.results || []).map(place => ({
                name: place.name,
                address: place.location ? place.location.formatted_address : '',
                rating: place.rating,
                priceLevel: place.price ? place.price.tier : null,
                types: place.categories ? place.categories.map(cat => cat.name) : [],
                location: {
                    lat: place.geocodes ? place.geocodes.main.latitude : null,
                    lng: place.geocodes ? place.geocodes.main.longitude : null
                },
                fsqId: place.fsq_id,
                source: 'Foursquare',
                distance: place.distance
            }));

            return {
                provider: 'Foursquare',
                places: places
            };
        } catch (error) {
            console.error('Foursquare API error:', error.message);
            throw new Error(`Foursquare search failed: ${error.message}`);
        }
    }

    /**
     * Search using OpenStreetMap Nominatim (free alternative)
     */
    async searchNominatim(query, location) {
        try {
            const response = await axios.get(`${this.providers.nominatim.baseUrl}search`, {
                params: {
                    q: query,
                    format: 'json',
                    limit: 5,
                    bounded: 1,
                    viewbox: `${location.lng - 0.1},${location.lat + 0.1},${location.lng + 0.1},${location.lat - 0.1}`,
                    addressdetails: 1
                },
                headers: {
                    'User-Agent': 'CarBot/1.0'
                },
                timeout: 10000
            });

            const places = (response.data || []).map(place => ({
                name: place.display_name.split(',')[0],
                address: place.display_name,
                rating: null,
                priceLevel: null,
                types: [place.type],
                location: {
                    lat: parseFloat(place.lat),
                    lng: parseFloat(place.lon)
                },
                osmId: place.osm_id,
                source: 'OpenStreetMap',
                importance: place.importance
            }));

            return {
                provider: 'OpenStreetMap',
                places: places
            };
        } catch (error) {
            console.error('Nominatim API error:', error.message);
            throw new Error(`Nominatim search failed: ${error.message}`);
        }
    }

    /**
     * Remove duplicate places based on name and proximity
     */
    removeDuplicates(places) {
        const unique = [];
        const seen = new Set();

        for (const place of places) {
            const key = `${place.name.toLowerCase()}_${Math.round(place.location.lat * 1000)}_${Math.round(place.location.lng * 1000)}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(place);
            }
        }

        return unique.sort((a, b) => {
            // Sort by rating first, then by distance if available
            if (a.rating && b.rating) {
                return b.rating - a.rating;
            }
            if (a.distance && b.distance) {
                return a.distance - b.distance;
            }
            return 0;
        });
    }

    /**
     * Format location results for voice response
     */
    formatForVoice(locationData, maxResults = 3) {
        if (!locationData || !locationData.places || locationData.places.length === 0) {
            return `I couldn't find any ${locationData.query} near your location.`;
        }

        const places = locationData.places.slice(0, maxResults);
        let response = `I found ${places.length} ${locationData.query} options near you: `;

        places.forEach((place, index) => {
            let placeInfo = `${index + 1}. ${place.name}`;
            
            if (place.rating) {
                placeInfo += `, rated ${place.rating} out of 5`;
            }
            
            if (place.priceLevel) {
                const priceText = '$'.repeat(place.priceLevel);
                placeInfo += `, price level ${priceText}`;
            }
            
            if (place.address) {
                // Simplify address for voice
                const simpleAddress = place.address.split(',')[0];
                placeInfo += `, located at ${simpleAddress}`;
            }
            
            response += `${placeInfo}. `;
        });

        return response;
    }

    /**
     * Get directions to a place (placeholder for future implementation)
     */
    async getDirections(destination, origin = null) {
        const startLocation = origin || this.currentLocation;
        
        // This would integrate with Google Directions API or similar
        return {
            origin: startLocation,
            destination: destination,
            instructions: `Navigate to ${destination.name} at ${destination.address}`,
            estimatedTime: 'approximately 15 minutes',
            distance: '5.2 km'
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️  Location cache cleared');
    }

    /**
     * Search using Yelp Fusion API
     */
    async searchYelp(query, location, radius = 5000) {
        try {
            const response = await axios.get(`${this.providers.yelp.baseUrl}search`, {
                params: {
                    term: query,
                    latitude: location.lat,
                    longitude: location.lng,
                    radius: Math.min(radius, 40000), // Yelp max radius is 40000m
                    categories: 'restaurants,food',
                    sort_by: 'best_match',
                    limit: 20
                },
                headers: {
                    'Authorization': `Bearer ${this.providers.yelp.apiKey}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            const places = (response.data.businesses || []).map(business => ({
                name: business.name,
                address: business.location?.display_address?.join(', ') || '',
                rating: business.rating,
                priceLevel: business.price ? business.price.length : null,
                types: business.categories?.map(cat => cat.title) || [],
                location: {
                    lat: business.coordinates?.latitude,
                    lng: business.coordinates?.longitude
                },
                yelpId: business.id,
                source: 'Yelp',
                phone: business.phone,
                url: business.url,
                reviewCount: business.review_count,
                photos: business.photos || [],
                isOpen: business.hours?.[0]?.is_open_now
            }));

            return {
                provider: 'Yelp',
                places: places
            };
        } catch (error) {
            console.error('Yelp API error:', error.message);
            throw new Error(`Yelp search failed: ${error.message}`);
        }
    }

    /**
     * Search using TripAdvisor API
     */
    async searchTripAdvisor(query, location, radius = 5000) {
        try {
            const response = await axios.get(`${this.providers.tripadvisor.baseUrl}location/nearby_search`, {
                params: {
                    latLong: `${location.lat},${location.lng}`,
                    category: 'restaurants',
                    radius: Math.round(radius / 1000), // Convert to km
                    radiusUnit: 'km',
                    language: 'en'
                },
                headers: {
                    'X-TripAdvisor-API-Key': this.providers.tripadvisor.apiKey,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            const places = (response.data.data || [])
                .filter(place => place.name.toLowerCase().includes(query.toLowerCase()))
                .map(place => ({
                    name: place.name,
                    address: place.address_obj?.address_string || '',
                    rating: place.rating ? parseFloat(place.rating) : null,
                    priceLevel: place.price_level ? parseInt(place.price_level) : null,
                    types: ['restaurant'],
                    location: {
                        lat: parseFloat(place.latitude),
                        lng: parseFloat(place.longitude)
                    },
                    tripAdvisorId: place.location_id,
                    source: 'TripAdvisor',
                    url: place.web_url,
                    photos: place.photo ? [place.photo] : [],
                    awards: place.awards || []
                }));

            return {
                provider: 'TripAdvisor',
                places: places
            };
        } catch (error) {
            console.error('TripAdvisor API error:', error.message);
            throw new Error(`TripAdvisor search failed: ${error.message}`);
        }
    }

    /**
     * Get cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            currentLocation: this.currentLocation
        };
    }
}

module.exports = LocationService;