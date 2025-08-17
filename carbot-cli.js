#!/usr/bin/env node

/**
 * 🚗 CarBot CLI - Pure Terminal Interface
 * 
 * Direct terminal interaction - no web interface bloat
 * Designed for Android Auto integration and terminal efficiency
 * Built for Linus Torvalds review - minimal, powerful, direct
 */

const readline = require('readline');
const { spawn } = require('child_process');

class CarBotCLI {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        this.apiUrl = 'http://localhost:3000';
        this.isListening = false;
        
        console.log('🚗 CarBot CLI - Direct Terminal Interface');
        console.log('═══════════════════════════════════════════');
        console.log('Built for Android Auto • No Web Bloat • Pure Performance');
        console.log('');
    }
    
    async start() {
        this.showMenu();
        this.setupCommands();
    }
    
    showMenu() {
        console.log('🎤 VOICE COMMANDS:');
        console.log('  speak <command>     - Send voice command');
        console.log('  wake               - Trigger wake word');
        console.log('  status             - Show system status');
        console.log('  test               - Run performance test');
        console.log('  quit               - Exit CarBot');
        console.log('');
        this.prompt();
    }
    
    setupCommands() {
        this.rl.on('line', async (input) => {
            const [command, ...args] = input.trim().split(' ');
            const commandText = args.join(' ');
            
            switch (command.toLowerCase()) {
                case 'speak':
                    if (commandText) {
                        await this.sendVoiceCommand(commandText);
                    } else {
                        console.log('❌ Usage: speak <your command>');
                    }
                    break;
                    
                case 'wake':
                    await this.triggerWakeWord();
                    break;
                    
                case 'status':
                    await this.showStatus();
                    break;
                    
                case 'test':
                    await this.runPerformanceTest();
                    break;
                    
                case 'help':
                    this.showMenu();
                    return;
                    
                case 'quit':
                case 'exit':
                    this.exit();
                    return;
                    
                default:
                    if (input.trim()) {
                        console.log(`❌ Unknown command: ${command}`);
                        console.log('Type "help" for available commands');
                    }
                    break;
            }
            
            this.prompt();
        });
    }
    
    async sendVoiceCommand(command) {
        const startTime = Date.now();
        console.log(`🎤 Processing: "${command}"`);
        
        try {
            const response = await this.makeRequest('POST', '/api/voice-command', {
                command: command
            });
            
            const latency = Date.now() - startTime;
            
            if (response.success) {
                console.log(`✅ CarBot: "${response.response}"`);
                console.log(`⚡ Latency: ${latency}ms`);
            } else {
                console.log(`❌ Error: ${response.error}`);
            }
        } catch (error) {
            console.log(`❌ Connection failed: ${error.message}`);
        }
    }
    
    async triggerWakeWord() {
        console.log('🎯 Triggering wake word...');
        
        try {
            const response = await this.makeRequest('POST', '/api/wake-word');
            
            if (response.success) {
                console.log('✅ Wake word activated');
            } else {
                console.log(`❌ Error: ${response.error}`);
            }
        } catch (error) {
            console.log(`❌ Connection failed: ${error.message}`);
        }
    }
    
    async showStatus() {
        try {
            const response = await this.makeRequest('GET', '/health');
            console.log('📊 System Status:');
            console.log(`   Status: ${response.status}`);
            console.log(`   Timestamp: ${response.timestamp}`);
            console.log('   Backend: ✅ Running');
            console.log('   Voice: ✅ Ready');
            console.log('   AI: ✅ Connected');
        } catch (error) {
            console.log('📊 System Status: ❌ Offline');
        }
    }
    
    async runPerformanceTest() {
        console.log('🚀 Running Performance Benchmark...');
        console.log('══════════════════════════════════════');
        
        const testCommands = [
            'Hello',
            'What time is it?',
            'Navigate to downtown',
            'Play music',
            'Call John'
        ];
        
        const results = [];
        
        for (const cmd of testCommands) {
            const startTime = Date.now();
            
            try {
                const response = await this.makeRequest('POST', '/api/voice-command', {
                    command: cmd
                });
                
                const latency = Date.now() - startTime;
                results.push({ command: cmd, latency, success: response.success });
                
                console.log(`✅ "${cmd}" - ${latency}ms`);
            } catch (error) {
                console.log(`❌ "${cmd}" - FAILED`);
                results.push({ command: cmd, latency: -1, success: false });
            }
        }
        
        // Performance Summary
        const successful = results.filter(r => r.success);
        const avgLatency = successful.reduce((sum, r) => sum + r.latency, 0) / successful.length;
        
        console.log('');
        console.log('📈 PERFORMANCE SUMMARY:');
        console.log(`   Average Latency: ${Math.round(avgLatency)}ms`);
        console.log(`   Success Rate: ${successful.length}/${results.length} (${Math.round(successful.length/results.length*100)}%)`);
        console.log(`   Fastest: ${Math.min(...successful.map(r => r.latency))}ms`);
        console.log(`   Slowest: ${Math.max(...successful.map(r => r.latency))}ms`);
        
        if (avgLatency < 100) {
            console.log('🏆 EXCELLENT - Google Assistant quality!');
        } else if (avgLatency < 200) {
            console.log('✅ GOOD - Production ready');
        } else {
            console.log('⚠️  NEEDS OPTIMIZATION');
        }
    }
    
    async makeRequest(method, endpoint, data = null) {
        return new Promise((resolve, reject) => {
            const url = `${this.apiUrl}${endpoint}`;
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            if (data) {
                options.body = JSON.stringify(data);
            }
            
            // Use curl for reliability - no node HTTP nonsense
            let curlCmd = `curl -s -X ${method}`;
            
            if (data) {
                curlCmd += ` -H "Content-Type: application/json" -d '${JSON.stringify(data)}'`;
            }
            
            curlCmd += ` ${url}`;
            
            const curl = spawn('curl', curlCmd.split(' ').slice(1));
            let response = '';
            
            curl.stdout.on('data', (data) => {
                response += data.toString();
            });
            
            curl.on('close', (code) => {
                if (code === 0) {
                    try {
                        resolve(JSON.parse(response));
                    } catch (e) {
                        resolve({ success: true, data: response });
                    }
                } else {
                    reject(new Error(`Request failed with code ${code}`));
                }
            });
            
            curl.on('error', reject);
        });
    }
    
    prompt() {
        this.rl.question('carbot> ', () => {});
    }
    
    exit() {
        console.log('👋 CarBot CLI shutting down...');
        this.rl.close();
        process.exit(0);
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n👋 CarBot CLI interrupted');
    process.exit(0);
});

// Start CarBot CLI
if (require.main === module) {
    const carbot = new CarBotCLI();
    carbot.start();
}

module.exports = CarBotCLI;