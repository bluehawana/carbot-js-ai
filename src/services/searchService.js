const axios = require('axios');

class SearchService {
    constructor(config = {}) {
        this.cache = new Map();
        this.cacheTimeout = config.cacheTimeout || 10 * 60 * 1000; // 10 minutes for news/search
        
        // Configure search providers
        this.providers = {
            // Using DuckDuckGo Instant Answer API (free, no API key needed)
            duckduckgo: {
                enabled: true,
                baseUrl: 'https://api.duckduckgo.com/',
                name: 'DuckDuckGo'
            },
            // Using NewsAPI (requires API key)
            newsapi: {
                enabled: !!process.env.NEWS_API_KEY,
                baseUrl: 'https://newsapi.org/v2/',
                apiKey: process.env.NEWS_API_KEY,
                name: 'NewsAPI'
            }
        };

        console.log('🔍 Search Service initialized');
        if (this.providers.newsapi.enabled) {
            console.log('✅ NewsAPI available');
        } else {
            console.log('⚠️  NewsAPI not configured - using free search only');
        }
    }

    /**
     * Get cached data or fetch new data
     */
    async getCachedOrFetch(cacheKey, fetchFunction) {
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            console.log(`🔍 Using cached search for ${cacheKey}`);
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
                console.warn(`⚠️  Search failed, using stale cache for ${cacheKey}`);
                return cached.data;
            }
            throw error;
        }
    }

    /**
     * Search for current events and news
     */
    async searchCurrentEvents(query, maxResults = 5) {
        const cacheKey = `news_${encodeURIComponent(query)}_${maxResults}`;
        
        return this.getCachedOrFetch(cacheKey, async () => {
            // Try NewsAPI first if available
            if (this.providers.newsapi.enabled) {
                try {
                    return await this.searchWithNewsAPI(query, maxResults);
                } catch (error) {
                    console.warn('NewsAPI failed, falling back to DuckDuckGo:', error.message);
                }
            }
            
            // Fallback to DuckDuckGo
            return await this.searchWithDuckDuckGo(query, maxResults);
        });
    }

    /**
     * Search for general information
     */
    async searchGeneral(query, maxResults = 3) {
        const cacheKey = `general_${encodeURIComponent(query)}_${maxResults}`;
        
        return this.getCachedOrFetch(cacheKey, async () => {
            return await this.searchWithDuckDuckGo(query, maxResults);
        });
    }

    /**
     * Search for specific topics like weather, stocks, etc.
     */
    async searchSpecific(query, type = 'general') {
        const cacheKey = `${type}_${encodeURIComponent(query)}`;
        
        return this.getCachedOrFetch(cacheKey, async () => {
            // For specific searches, we can enhance the query
            let enhancedQuery = query;
            
            switch (type) {
                case 'weather':
                    enhancedQuery = `weather ${query} today current`;
                    break;
                case 'stock':
                    enhancedQuery = `${query} stock price current market`;
                    break;
                case 'news':
                    enhancedQuery = `${query} news latest today`;
                    break;
                case 'restaurant':
                    enhancedQuery = `${query} restaurants reviews ratings`;
                    break;
            }
            
            return await this.searchWithDuckDuckGo(enhancedQuery, 3);
        });
    }

    /**
     * Search using NewsAPI
     */
    async searchWithNewsAPI(query, maxResults = 5) {
        try {
            const response = await axios.get(`${this.providers.newsapi.baseUrl}everything`, {
                params: {
                    q: query,
                    sortBy: 'publishedAt',
                    pageSize: maxResults,
                    language: 'en',
                    apiKey: this.providers.newsapi.apiKey
                },
                timeout: 10000
            });

            const articles = response.data.articles || [];
            
            return {
                provider: 'NewsAPI',
                query: query,
                results: articles.map(article => ({
                    title: article.title,
                    description: article.description,
                    url: article.url,
                    source: article.source.name,
                    publishedAt: article.publishedAt,
                    type: 'news'
                })),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('NewsAPI search failed:', error.message);
            throw new Error(`NewsAPI search failed: ${error.message}`);
        }
    }

    /**
     * Search using DuckDuckGo Instant Answer API
     */
    async searchWithDuckDuckGo(query, maxResults = 3) {
        try {
            const response = await axios.get(this.providers.duckduckgo.baseUrl, {
                params: {
                    q: query,
                    format: 'json',
                    no_html: '1',
                    skip_disambig: '1'
                },
                timeout: 10000
            });

            const data = response.data;
            const results = [];

            // Add instant answer if available
            if (data.Answer) {
                results.push({
                    title: 'Instant Answer',
                    description: data.Answer,
                    type: 'answer',
                    source: 'DuckDuckGo'
                });
            }

            // Add abstract if available
            if (data.Abstract) {
                results.push({
                    title: data.AbstractSource || 'Information',
                    description: data.Abstract,
                    url: data.AbstractURL,
                    type: 'info',
                    source: data.AbstractSource || 'DuckDuckGo'
                });
            }

            // Add related topics
            if (data.RelatedTopics && data.RelatedTopics.length > 0) {
                data.RelatedTopics.slice(0, maxResults - results.length).forEach(topic => {
                    if (topic.Text) {
                        results.push({
                            title: topic.Text.split(' - ')[0],
                            description: topic.Text,
                            url: topic.FirstURL,
                            type: 'related',
                            source: 'DuckDuckGo'
                        });
                    }
                });
            }

            return {
                provider: 'DuckDuckGo',
                query: query,
                results: results.slice(0, maxResults),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('DuckDuckGo search failed:', error.message);
            throw new Error(`DuckDuckGo search failed: ${error.message}`);
        }
    }

    /**
     * Format search results for voice response
     */
    formatForVoice(searchData, maxResults = 2) {
        if (!searchData || !searchData.results || searchData.results.length === 0) {
            return "I couldn't find any current information about that.";
        }

        const results = searchData.results.slice(0, maxResults);
        let response = `Here's what I found about ${searchData.query}: `;

        results.forEach((result, index) => {
            const description = result.description || result.title;
            // Clean up the text for voice
            const cleanText = description
                .replace(/https?:\/\/[^\s]+/g, '')
                .replace(/[<>]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            
            if (cleanText) {
                response += `${cleanText}. `;
            }
        });

        return response;
    }

    /**
     * Check if a query needs real-time search
     */
    needsRealTimeSearch(query) {
        const lowerQuery = query.toLowerCase();
        
        // Keywords that suggest need for real-time data
        const realTimeKeywords = [
            'latest', 'newest', 'recent', 'current', 'today', 'now',
            'news', 'weather', 'stock', 'price', 'happening',
            'trump', 'putin', 'meeting', 'result', 'election',
            'what are', 'what is happening', 'what happened'
        ];
        
        return realTimeKeywords.some(keyword => lowerQuery.includes(keyword));
    }

    /**
     * Determine search type from query
     */
    getSearchType(query) {
        const lowerQuery = query.toLowerCase();
        
        if (lowerQuery.includes('weather') || lowerQuery.includes('temperature')) {
            return 'weather';
        }
        
        if (lowerQuery.includes('stock') || lowerQuery.includes('price') || 
            lowerQuery.includes('market')) {
            return 'stock';
        }
        
        if (lowerQuery.includes('news') || lowerQuery.includes('latest') ||
            lowerQuery.includes('happening') || lowerQuery.includes('current events')) {
            return 'news';
        }
        
        if (lowerQuery.includes('restaurant') || lowerQuery.includes('food') ||
            lowerQuery.includes('eat') || lowerQuery.includes('dining')) {
            return 'restaurant';
        }
        
        return 'general';
    }

    /**
     * Enhanced search that chooses the best method
     */
    async enhancedSearch(query, maxResults = 3) {
        const searchType = this.getSearchType(query);
        
        try {
            if (searchType === 'news') {
                return await this.searchCurrentEvents(query, maxResults);
            } else {
                return await this.searchSpecific(query, searchType);
            }
        } catch (error) {
            console.error('Enhanced search failed:', error.message);
            // Fallback to basic search
            return await this.searchGeneral(query, maxResults);
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️  Search cache cleared');
    }

    /**
     * Get cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

module.exports = SearchService;