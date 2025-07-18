const TwitterAPI = require('../api/twitterAPI');

class SocialMediaService {
    constructor(config = {}) {
        this.twitterAPI = null;
        this.cache = new Map();
        this.cacheTimeout = config.cacheTimeout || 5 * 60 * 1000; // 5 minutes
        
        // Initialize Twitter API if bearer token is available
        if (process.env.TWITTER_BEARER_TOKEN) {
            try {
                this.twitterAPI = new TwitterAPI();
                console.log('✅ Twitter API initialized');
            } catch (error) {
                console.warn('⚠️  Twitter API initialization failed:', error.message);
            }
        } else {
            console.warn('⚠️  Twitter Bearer Token not found - Twitter features disabled');
        }
    }

    /**
     * Check if Twitter API is available
     */
    isTwitterAvailable() {
        return this.twitterAPI !== null;
    }

    /**
     * Get cached data or fetch new data
     */
    async getCachedOrFetch(cacheKey, fetchFunction) {
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            console.log(`📱 Using cached data for ${cacheKey}`);
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
                console.warn(`⚠️  Fetch failed, using stale cache for ${cacheKey}`);
                return cached.data;
            }
            throw error;
        }
    }

    /**
     * Get latest tweets from Trump
     */
    async getTrumpTweets(maxResults = 5) {
        if (!this.isTwitterAvailable()) {
            throw new Error('Twitter API not available');
        }

        const cacheKey = `trump_tweets_${maxResults}`;
        return this.getCachedOrFetch(cacheKey, async () => {
            return await this.twitterAPI.getRecentTweetsByUsername('realDonaldTrump', { maxResults });
        });
    }

    /**
     * Get latest tweets from Elon Musk
     */
    async getElonTweets(maxResults = 5) {
        if (!this.isTwitterAvailable()) {
            throw new Error('Twitter API not available');
        }

        const cacheKey = `elon_tweets_${maxResults}`;
        return this.getCachedOrFetch(cacheKey, async () => {
            return await this.twitterAPI.getRecentTweetsByUsername('elonmusk', { maxResults });
        });
    }

    /**
     * Get tweets from any username
     */
    async getUserTweets(username, maxResults = 5) {
        if (!this.isTwitterAvailable()) {
            throw new Error('Twitter API not available');
        }

        const cacheKey = `${username}_tweets_${maxResults}`;
        return this.getCachedOrFetch(cacheKey, async () => {
            return await this.twitterAPI.getRecentTweetsByUsername(username, { maxResults });
        });
    }

    /**
     * Search recent tweets
     */
    async searchTweets(query, maxResults = 10) {
        if (!this.isTwitterAvailable()) {
            throw new Error('Twitter API not available');
        }

        const cacheKey = `search_${encodeURIComponent(query)}_${maxResults}`;
        return this.getCachedOrFetch(cacheKey, async () => {
            return await this.twitterAPI.searchRecentTweets(query, { maxResults });
        });
    }

    /**
     * Get trending updates from multiple popular accounts
     */
    async getTrendingUpdates(accounts = ['realDonaldTrump', 'elonmusk'], maxResults = 3) {
        if (!this.isTwitterAvailable()) {
            throw new Error('Twitter API not available');
        }

        const cacheKey = `trending_${accounts.join('_')}_${maxResults}`;
        return this.getCachedOrFetch(cacheKey, async () => {
            return await this.twitterAPI.getPopularAccountTweets(accounts, maxResults);
        });
    }

    /**
     * Format tweets for voice response
     */
    formatForVoice(tweetsData, maxTweets = 3) {
        if (!tweetsData || !tweetsData.tweets || tweetsData.tweets.length === 0) {
            return "No recent tweets found.";
        }

        const user = tweetsData.user;
        const tweets = tweetsData.tweets.slice(0, maxTweets);
        
        let response = `Latest ${tweets.length} tweets from ${user.name}: `;
        
        tweets.forEach((tweet, index) => {
            const tweetText = tweet.text.replace(/https?:\/\/[^\s]+/g, '').trim();
            response += `Tweet ${index + 1}: ${tweetText}. `;
        });

        return response;
    }

    /**
     * Format trending updates for voice
     */
    formatTrendingForVoice(trendingData, maxPerAccount = 2) {
        const accounts = Object.keys(trendingData);
        let response = "Here are the latest updates: ";

        accounts.forEach(username => {
            const data = trendingData[username];
            if (data.tweets && data.tweets.length > 0) {
                const latestTweet = data.tweets[0];
                const tweetText = latestTweet.text.replace(/https?:\/\/[^\s]+/g, '').trim();
                response += `${data.user.name} posted: ${tweetText}. `;
            }
        });

        return response || "No recent updates available.";
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️  Cache cleared');
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

module.exports = SocialMediaService;