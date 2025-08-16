#!/usr/bin/env node

/**
 * CarBot Runner with Microphone Access
 * 
 * This script can be run from applications that have microphone permissions
 * like Android Studio, VS Code, or other IDEs that have been granted access.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚗 CarBot - Starting with Microphone Access');
console.log('📱 Recommended to run from an app with microphone permissions');
console.log('   (Android Studio, VS Code, IntelliJ, etc.)');
console.log('');

// Set environment variables
const env = {
    ...process.env,
    PICOVOICE_ACCESS_KEY: process.env.PICOVOICE_ACCESS_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    NODE_ENV: 'development'
};

// Check if we have the required keys
if (!env.PICOVOICE_ACCESS_KEY || !env.GROQ_API_KEY) {
    console.error('❌ Missing required environment variables:');
    if (!env.PICOVOICE_ACCESS_KEY) console.error('   - PICOVOICE_ACCESS_KEY');
    if (!env.GROQ_API_KEY) console.error('   - GROQ_API_KEY');
    console.error('');
    console.error('💡 Please set these in your .env file or environment');
    process.exit(1);
}

// Run the main CarBot application
const carBotPath = path.join(__dirname, 'src', 'index.js');
const carBot = spawn('node', [carBotPath], {
    stdio: 'inherit',
    env: env
});

carBot.on('error', (error) => {
    console.error('❌ Failed to start CarBot:', error);
    process.exit(1);
});

carBot.on('close', (code) => {
    console.log(`🛑 CarBot exited with code ${code}`);
    process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down CarBot...');
    carBot.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Terminating CarBot...');
    carBot.kill('SIGTERM');
});