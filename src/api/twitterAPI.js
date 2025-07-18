const axios = require('axios');

class TwitterAPI {
    constructor(config = {}) {
        this.bearerToken = config.bearerToken || process.env.TWITTER_BEARER_TOKEN;
        this.baseURL = 'https://api.x.com/2';
        
        if (!this.bearerToken) {
            throw new Error('Twitter Bearer Token is required');
        }
        
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.bearerToken}`,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Get user ID by username
     */
    async getUserByUsername(username) {
        try {
            const response = await this.client.get(`/users/by/username/${username}`, {
                params: {
                    'user.fields': 'id,name,username,public_metrics,verified'
                }
            });
            return response.data.data;
        } catch (error) {
            console.error(`Error fetching user ${username}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get recent tweets from a specific user
     */
    async getUserTweets(userId, options = {}) {
        try {
            const params = {
                'tweet.fields': 'created_at,public_metrics,context_annotations,text',
                'expansions': 'author_id',
                'user.fields': 'name,username,verified',
                'max_results': Math.max(5, options.maxResults || 10)
            };

            // Add other options but exclude maxResults to avoid conflicts
            Object.keys(options).forEach(key => {
                if (key !== 'maxResults') {
                    params[key] = options[key];
                }
            });

            const response = await this.client.get(`/users/${userId}/tweets`, {
                params
            });
            
            return response.data;
        } catch (error) {
            console.error(`Error fetching tweets for user ${userId}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get recent tweets by username (convenience method)
     */
    async getRecentTweetsByUsername(username, options = {}) {
        try {
            const user = await this.getUserByUsername(username);
            const tweets = await this.getUserTweets(user.id, options);
            
            return {
                user,
                tweets: tweets.data || [],
                meta: tweets.meta || {}
            };
        } catch (error) {
            console.error(`Error fetching recent tweets for @${username}:`, error.message);
            throw error;
        }
    }

    /**
     * Get tweets by IDs
     */
    async getTweetsByIds(tweetIds, options = {}) {
        try {
            const params = {
                'ids': Array.isArray(tweetIds) ? tweetIds.join(',') : tweetIds,
                'tweet.fields': 'created_at,public_metrics,context_annotations,text',
                'expansions': 'author_id',
                'user.fields': 'name,username,verified',
                ...options
            };

            const response = await this.client.get('/tweets', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching tweets by IDs:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Search recent tweets
     */
    async searchRecentTweets(query, options = {}) {
        try {
            const params = {
                'query': query,
                'tweet.fields': 'created_at,public_metrics,context_annotations,text',
                'expansions': 'author_id',
                'user.fields': 'name,username,verified',
                'max_results': options.maxResults || 10,
                ...options
            };

            const response = await this.client.get('/tweets/search/recent', { params });
            return response.data;
        } catch (error) {
            console.error(`Error searching tweets with query "${query}":`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Format tweet for display
     */
    formatTweet(tweet, user = null) {
        const author = user || tweet.author_id;
        const metrics = tweet.public_metrics || {};
        
        return {
            id: tweet.id,
            text: tweet.text,
            author: typeof author === 'object' ? author.username : author,
            authorName: typeof author === 'object' ? author.name : 'Unknown',
            verified: typeof author === 'object' ? author.verified : false,
            createdAt: tweet.created_at,
            metrics: {
                likes: metrics.like_count || 0,
                retweets: metrics.retweet_count || 0,
                replies: metrics.reply_count || 0,
                quotes: metrics.quote_count || 0
            },
            url: `https://x.com/${typeof author === 'object' ? author.username : 'i'}/status/${tweet.id}`
        };
    }

    /**
     * Get formatted recent tweets for popular accounts
     */
    async getPopularAccountTweets(accounts = ['realDonaldTrump', 'elonmusk'], maxResults = 5) {
        const results = {};
        
        for (const username of accounts) {
            try {
                const data = await this.getRecentTweetsByUsername(username, { maxResults });
                const formattedTweets = data.tweets.map(tweet => 
                    this.formatTweet(tweet, data.user)
                );
                
                results[username] = {
                    user: data.user,
                    tweets: formattedTweets,
                    count: formattedTweets.length
                };
            } catch (error) {
                console.warn(`Failed to fetch tweets for @${username}:`, error.message);
                results[username] = {
                    error: error.message,
                    tweets: [],
                    count: 0
                };
            }
        }
        
        return results;
    }
}

module.exports = TwitterAPI;