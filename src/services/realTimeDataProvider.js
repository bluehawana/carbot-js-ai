const SocialMediaService = require('./socialMediaService');
const SearchService = require('./searchService');
const axios = require('axios');

/**
 * Real-Time Data Provider
 * 
 * Aggregates real-time data from multiple sources:
 * - Social media (Twitter/X)
 * - Web search and news
 * - Weather data
 * - Stock/financial data
 * - Traffic and location data
 */
class RealTimeDataProvider {
    constructor(options = {}) {
        this.options = {
            cacheTimeout: options.cacheTimeout || 5 * 60 * 1000, // 5 minutes
            maxRetries: options.maxRetries || 2,
            timeout: options.timeout || 8000,
            ...options
        };

        // Initialize services
        this.socialMediaService = new SocialMediaService({
            cacheTimeout: this.options.cacheTimeout
        });

        this.searchService = new SearchService({
            cacheTimeout: this.options.cacheTimeout
        });

        // Cache for expensive operations
        this.cache = new Map();
        
        // API configurations
        this.apiConfigs = {
            weather: {
                enabled: !!process.env.OPENWEATHER_API_KEY,
                apiKey: process.env.OPENWEATHER_API_KEY,
                baseUrl: 'https://api.openweathermap.org/data/2.5'
            },
            stocks: {
                enabled: !!process.env.ALPHA_VANTAGE_API_KEY,
                apiKey: process.env.ALPHA_VANTAGE_API_KEY,
                baseUrl: 'https://www.alphavantage.co/query'
            },
            traffic: {
                enabled: !!process.env.GOOGLE_MAPS_API_KEY,
                apiKey: process.env.GOOGLE_MAPS_API_KEY,
                baseUrl: 'https://maps.googleapis.com/maps/api'
            }
        };

        console.log('🌐 Real-Time Data Provider initialized');
        this.logAvailableServices();
    }

    /**
     * Log which services are available
     */
    logAvailableServices() {
        const services = [];
        
        if (this.socialMediaService.isTwitterAvailable()) {
            services.push('Twitter/X');
        }
        
        if (this.apiConfigs.weather.enabled) {
            services.push('Weather');
        }
        
        if (this.apiConfigs.stocks.enabled) {
            services.push('Stocks');
        }
        
        if (this.apiConfigs.traffic.enabled) {
            services.push('Traffic');
        }
        
        services.push('Web Search');
        
        console.log(`✅ Available real-time services: ${services.join(', ')}`);
    }

    /**
     * Get cached data or fetch new data
     */
    async getCachedOrFetch(cacheKey, fetchFunction) {
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.options.cacheTimeout) {
            console.log(`🌐 Using cached real-time data for ${cacheKey}`);
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
                console.warn(`⚠️ Real-time fetch failed, using stale cache for ${cacheKey}`);
                return cached.data;
            }
            throw error;
        }
    }

    /**
     * Get Elon Musk's latest tweets
     */
    async getElonTweets(maxResults = 3) {
        if (!this.socialMediaService.isTwitterAvailable()) {
            throw new Error('Twitter service not available');
        }

        const cacheKey = `elon_tweets_${maxResults}`;
        return this.getCachedOrFetch(cacheKey, async () => {
            const tweetsData = await this.socialMediaService.getElonTweets(maxResults);
            return {
                type: 'social_media',
                source: 'twitter',
                user: 'elonmusk',
                tweets: tweetsData.tweets.map(tweet => ({
                    text: tweet.text,
                    timestamp: tweet.created_at,
                    metrics: tweet.public_metrics
                })),
                summary: this.socialMediaService.formatForVoice(tweetsData, maxResults),
                timestamp: Date.now()
            };
        });
    }

    /**
     * Get Trump's latest tweets
     */
    async getTrumpTweets(maxResults = 3) {
        if (!this.socialMediaService.isTwitterAvailable()) {
            throw new Error('Twitter service not available');
        }

        const cacheKey = `trump_tweets_${maxResults}`;
        return this.getCachedOrFetch(cacheKey, async () => {
            const tweetsData = await this.socialMediaService.getTrumpTweets(maxResults);
            return {
                type: 'social_media',
                source: 'twitter',
                user: 'realDonaldTrump',
                tweets: tweetsData.tweets.map(tweet => ({
                    text: tweet.text,
                    timestamp: tweet.created_at,
                    metrics: tweet.public_metrics
                })),
                summary: this.socialMediaService.formatForVoice(tweetsData, maxResults),
                timestamp: Date.now()
            };
        });
    }

    /**
     * Get trending social media updates
     */
    async getTrendingUpdates(accounts = ['elonmusk', 'realDonaldTrump'], maxResults = 2) {
        if (!this.socialMediaService.isTwitterAvailable()) {
            throw new Error('Twitter service not available');
        }

        const cacheKey = `trending_${accounts.join('_')}_${maxResults}`;
        return this.getCachedOrFetch(cacheKey, async () => {
            const trendingData = await this.socialMediaService.getTrendingUpdates(accounts, maxResults);
            
            return {
                type: 'social_media',
                source: 'twitter',
                accounts: accounts,
                updates: trendingData,
                summary: this.socialMediaService.formatTrendingForVoice(trendingData, maxResults),
                timestamp: Date.now()
            };
        });
    }

    /**
     * Get current news data
     */
    async getNewsData(query, maxResults = 5) {
        const cacheKey = `news_${encodeURIComponent(query)}_${maxResults}`;
        return this.getCachedOrFetch(cacheKey, async () => {
            const newsData = await this.searchService.searchCurrentEvents(query, maxResults);
            
            return {
                type: 'news',
                query: query,
                articles: newsData.results.map(result => ({
                    title: result.title,
                    description: result.description,
                    source: result.source,
                    url: result.url,
                    publishedAt: result.publishedAt
                })),
                summary: this.searchService.formatForVoice(newsData, Math.min(3, maxResults)),
                provider: newsData.provider,
                timestamp: Date.now()
            };
        });
    }

    /**
     * Get weather data for a location
     */
    async getWeatherData(location) {
        if (!this.apiConfigs.weather.enabled) {
            throw new Error('Weather service not configured');
        }

        const cacheKey = `weather_${encodeURIComponent(location)}`;
        return this.getCachedOrFetch(cacheKey, async () => {
            try {
                const response = await axios.get(`${this.apiConfigs.weather.baseUrl}/weather`, {
                    params: {
                        q: location,
                        appid: this.apiConfigs.weather.apiKey,
                        units: 'metric'
                    },
                    timeout: this.options.timeout
                });

                const data = response.data;
                
                return {
                    type: 'weather',
                    location: location,
                    temperature: Math.round(data.main.temp),
                    condition: data.weather[0].description,
                    humidity: data.main.humidity,
                    windSpeed: data.wind?.speed || 0,
                    feelsLike: Math.round(data.main.feels_like),
                    summary: `Current weather in ${location}: ${Math.round(data.main.temp)}°C, ${data.weather[0].description}. Feels like ${Math.round(data.main.feels_like)}°C.`,
                    timestamp: Date.now()
                };
            } catch (error) {
                console.error('Weather API error:', error.message);
                throw new Error(`Weather data unavailable for ${location}`);
            }
        });
    }

    /**
     * Get stock/financial data
     */
    async getStockData(symbol) {
        if (!this.apiConfigs.stocks.enabled) {
            throw new Error('Stock service not configured');
        }

        const cacheKey = `stock_${symbol.toUpperCase()}`;
        return this.getCachedOrFetch(cacheKey, async () => {
            try {
                const response = await axios.get(this.apiConfigs.stocks.baseUrl, {
                    params: {
                        function: 'GLOBAL_QUOTE',
                        symbol: symbol.toUpperCase(),
                        apikey: this.apiConfigs.stocks.apiKey
                    },
                    timeout: this.options.timeout
                });

                const quote = response.data['Global Quote'];
                
                if (!quote || Object.keys(quote).length === 0) {
                    throw new Error(`No data found for symbol ${symbol}`);
                }

                const price = parseFloat(quote['05. price']);
                const change = parseFloat(quote['09. change']);
                const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));

                return {
                    type: 'stock',
                    symbol: symbol.toUpperCase(),
                    price: price,
                    change: change,
                    changePercent: changePercent,
                    volume: quote['06. volume'],
                    summary: `${symbol.toUpperCase()} is currently trading at $${price.toFixed(2)}, ${change >= 0 ? 'up' : 'down'} ${Math.abs(changePercent).toFixed(2)}% today.`,
                    timestamp: Date.now()
                };
            } catch (error) {
                console.error('Stock API error:', error.message);
                throw new Error(`Stock data unavailable for ${symbol}`);
            }
        });
    }

    /**
     * Get traffic data for a route
     */
    async getTrafficData(origin, destination) {
        if (!this.apiConfigs.traffic.enabled) {
            throw new Error('Traffic service not configured');
        }

        const cacheKey = `traffic_${encodeURIComponent(origin)}_${encodeURIComponent(destination)}`;
        return this.getCachedOrFetch(cacheKey, async () => {
            try {
                const response = await axios.get(`${this.apiConfigs.traffic.baseUrl}/directions/json`, {
                    params: {
                        origin: origin,
                        destination: destination,
                        departure_time: 'now',
                        traffic_model: 'best_guess',
                        key: this.apiConfigs.traffic.apiKey
                    },
                    timeout: this.options.timeout
                });

                const route = response.data.routes[0];
                const leg = route.legs[0];

                return {
                    type: 'traffic',
                    origin: origin,
                    destination: destination,
                    distance: leg.distance.text,
                    duration: leg.duration.text,
                    durationInTraffic: leg.duration_in_traffic?.text || leg.duration.text,
                    trafficCondition: this.assessTrafficCondition(leg.duration, leg.duration_in_traffic),
                    summary: `The route to ${destination} is ${leg.distance.text} and will take ${leg.duration_in_traffic?.text || leg.duration.text} with current traffic.`,
                    timestamp: Date.now()
                };
            } catch (error) {
                console.error('Traffic API error:', error.message);
                throw new Error(`Traffic data unavailable for route`);
            }
        });
    }

    /**
     * Assess traffic condition
     */
    assessTrafficCondition(normalDuration, trafficDuration) {
        if (!trafficDuration) return 'normal';
        
        const normalSeconds = normalDuration.value;
        const trafficSeconds = trafficDuration.value;
        const ratio = trafficSeconds / normalSeconds;
        
        if (ratio > 1.5) return 'heavy';
        if (ratio > 1.2) return 'moderate';
        return 'light';
    }

    /**
     * Enhanced search with real-time prioritization
     */
    async enhancedSearch(query, context = {}) {
        const searchData = await this.searchService.enhancedSearch(query, 3);
        
        return {
            type: 'search',
            query: query,
            results: searchData.results,
            summary: this.searchService.formatForVoice(searchData, 2),
            provider: searchData.provider,
            context: context,
            timestamp: Date.now()
        };
    }

    /**
     * Get comprehensive real-time data for a query
     */
    async getComprehensiveData(query, context = {}) {
        const results = {};
        const lowercaseQuery = query.toLowerCase();
        
        try {
            // Social media checks
            if (lowercaseQuery.includes('elon')) {
                results.social = await this.getElonTweets(2);
            } else if (lowercaseQuery.includes('trump')) {
                results.social = await this.getTrumpTweets(2);
            }
            
            // Weather checks
            if (lowercaseQuery.includes('weather')) {
                const location = this.extractLocation(query) || context.location;
                if (location) {
                    results.weather = await this.getWeatherData(location);
                }
            }
            
            // Stock checks
            const stockSymbol = this.extractStockSymbol(query);
            if (stockSymbol) {
                results.stocks = await this.getStockData(stockSymbol);
            }
            
            // News/general search
            if (!results.social && !results.weather && !results.stocks) {
                results.search = await this.enhancedSearch(query, context);
            } else if (lowercaseQuery.includes('news') || lowercaseQuery.includes('latest')) {
                results.news = await this.getNewsData(query, 3);
            }
            
        } catch (error) {
            console.warn('⚠️ Comprehensive data fetch partial failure:', error.message);
        }
        
        return {
            query: query,
            timestamp: Date.now(),
            results: results,
            summary: this.generateComprehensiveSummary(results)
        };
    }

    /**
     * Generate comprehensive summary from multiple data sources
     */
    generateComprehensiveSummary(results) {
        const summaries = [];
        
        if (results.social) {
            summaries.push(results.social.summary);
        }
        
        if (results.weather) {
            summaries.push(results.weather.summary);
        }
        
        if (results.stocks) {
            summaries.push(results.stocks.summary);
        }
        
        if (results.news) {
            summaries.push(results.news.summary);
        }
        
        if (results.search) {
            summaries.push(results.search.summary);
        }
        
        return summaries.join(' ') || 'No real-time data found for your query.';
    }

    /**
     * Extract location from query
     */
    extractLocation(query) {
        const locationPatterns = [
            /(?:weather\s+in\s+)([a-zA-Z\s,]+)/i,
            /(?:in\s+)([A-Z][a-zA-Z\s,]+)/,
            /(?:at\s+)([A-Z][a-zA-Z\s,]+)/
        ];
        
        for (const pattern of locationPatterns) {
            const match = query.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }
        
        return null;
    }

    /**
     * Extract stock symbol from query
     */
    extractStockSymbol(query) {
        // Look for stock-related keywords and symbols
        const stockPatterns = [
            /\b(TSLA|AAPL|GOOGL|MSFT|AMZN|NVDA|META|NFLX)\b/i,
            /(?:stock\s+)([A-Z]{1,5})\b/i,
            /\b([A-Z]{2,5})\s+(?:stock|price)/i
        ];
        
        for (const pattern of stockPatterns) {
            const match = query.match(pattern);
            if (match) {
                return match[1].toUpperCase();
            }
        }
        
        return null;
    }

    /**
     * Check data availability
     */
    getDataAvailability() {
        return {
            socialMedia: this.socialMediaService.isTwitterAvailable(),
            weather: this.apiConfigs.weather.enabled,
            stocks: this.apiConfigs.stocks.enabled,
            traffic: this.apiConfigs.traffic.enabled,
            search: true // Always available through DuckDuckGo
        };
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            socialMediaCache: this.socialMediaService.getCacheStats(),
            searchCache: this.searchService.getCacheStats()
        };
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.cache.clear();
        this.socialMediaService.clearCache();
        this.searchService.clearCache();
        console.log('🗑️ All real-time data caches cleared');
    }

    /**
     * Test real-time data services
     */
    async testServices() {
        const results = {
            timestamp: Date.now(),
            services: {}
        };
        
        // Test social media
        if (this.socialMediaService.isTwitterAvailable()) {
            try {
                await this.getElonTweets(1);
                results.services.socialMedia = { status: 'available', test: 'passed' };
            } catch (error) {
                results.services.socialMedia = { status: 'error', error: error.message };
            }
        } else {
            results.services.socialMedia = { status: 'not_configured' };
        }
        
        // Test weather
        if (this.apiConfigs.weather.enabled) {
            try {
                await this.getWeatherData('London');
                results.services.weather = { status: 'available', test: 'passed' };
            } catch (error) {
                results.services.weather = { status: 'error', error: error.message };
            }
        } else {
            results.services.weather = { status: 'not_configured' };
        }
        
        // Test search
        try {
            await this.enhancedSearch('test query');
            results.services.search = { status: 'available', test: 'passed' };
        } catch (error) {
            results.services.search = { status: 'error', error: error.message };
        }
        
        return results;
    }
}

module.exports = RealTimeDataProvider;