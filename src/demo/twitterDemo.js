#!/usr/bin/env node

require('dotenv').config();
const SocialMediaService = require('../services/socialMediaService');

class TwitterDemo {
    constructor() {
        this.socialMedia = new SocialMediaService();
    }

    async runDemo() {
        console.log('🐦 Twitter API Demo for ECARX Bot');
        console.log('==================================\n');

        // Check if Twitter is available
        if (!this.socialMedia.isTwitterAvailable()) {
            console.error('❌ Twitter API not available. Please set TWITTER_BEARER_TOKEN in your .env file');
            process.exit(1);
        }

        try {
            // Demo 1: Get Trump's latest tweets
            console.log('📱 Fetching latest tweets from Donald Trump...');
            const trumpTweets = await this.socialMedia.getTrumpTweets(3);
            console.log(`✅ Found ${trumpTweets.tweets.length} tweets from @${trumpTweets.user.username}`);
            this.displayTweets(trumpTweets.tweets);
            console.log('\n' + '='.repeat(50) + '\n');

            // Demo 2: Get Elon's latest tweets
            console.log('📱 Fetching latest tweets from Elon Musk...');
            const elonTweets = await this.socialMedia.getElonTweets(3);
            console.log(`✅ Found ${elonTweets.tweets.length} tweets from @${elonTweets.user.username}`);
            this.displayTweets(elonTweets.tweets);
            console.log('\n' + '='.repeat(50) + '\n');

            // Demo 3: Get trending updates
            console.log('📈 Fetching trending updates...');
            const trending = await this.socialMedia.getTrendingUpdates(['realDonaldTrump', 'elonmusk'], 2);
            console.log('✅ Trending updates:');
            Object.entries(trending).forEach(([username, data]) => {
                if (data.tweets && data.tweets.length > 0) {
                    console.log(`\n👤 @${username} (${data.user.name}):`);
                    this.displayTweets(data.tweets.slice(0, 1));
                }
            });
            console.log('\n' + '='.repeat(50) + '\n');

            // Demo 4: Voice formatting
            console.log('🎤 Voice-formatted response for Trump tweets:');
            const voiceResponse = this.socialMedia.formatForVoice(trumpTweets, 2);
            console.log(voiceResponse);
            console.log('\n' + '='.repeat(50) + '\n');

            // Demo 5: Search tweets
            console.log('🔍 Searching for tweets about "Tesla"...');
            const searchResults = await this.socialMedia.searchTweets('Tesla', 3);
            if (searchResults.data && searchResults.data.length > 0) {
                console.log(`✅ Found ${searchResults.data.length} tweets about Tesla:`);
                this.displayTweets(searchResults.data);
            } else {
                console.log('❌ No tweets found');
            }

        } catch (error) {
            console.error('❌ Demo failed:', error.message);
            if (error.response?.data) {
                console.error('API Error:', JSON.stringify(error.response.data, null, 2));
            }
        }
    }

    displayTweets(tweets) {
        tweets.forEach((tweet, index) => {
            console.log(`\n${index + 1}. 📝 ${tweet.text}`);
            console.log(`   🕒 ${new Date(tweet.created_at).toLocaleString()}`);
            if (tweet.public_metrics) {
                const metrics = tweet.public_metrics;
                console.log(`   📊 ${metrics.like_count || 0} likes, ${metrics.retweet_count || 0} retweets`);
            }
        });
    }

    async testSpecificUser(username) {
        console.log(`\n🔍 Testing specific user: @${username}`);
        try {
            const userTweets = await this.socialMedia.getUserTweets(username, 2);
            console.log(`✅ Found ${userTweets.tweets.length} tweets from @${userTweets.user.username}`);
            this.displayTweets(userTweets.tweets);
        } catch (error) {
            console.error(`❌ Failed to fetch tweets for @${username}:`, error.message);
        }
    }
}

// Main execution
async function main() {
    const demo = new TwitterDemo();
    
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
        const command = args[0];
        
        switch (command) {
            case 'user':
                if (args[1]) {
                    await demo.testSpecificUser(args[1]);
                } else {
                    console.error('Usage: node twitterDemo.js user <username>');
                }
                break;
            case 'help':
                console.log('Twitter Demo Commands:');
                console.log('  node twitterDemo.js          - Run full demo');
                console.log('  node twitterDemo.js user <username> - Test specific user');
                console.log('  node twitterDemo.js help     - Show this help');
                break;
            default:
                console.log('Unknown command. Use "help" for available commands.');
        }
    } else {
        await demo.runDemo();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = TwitterDemo;