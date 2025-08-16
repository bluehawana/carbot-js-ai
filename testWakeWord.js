const WakeWordDetector = require('./src/wakeword/detector');

async function runTest() {
    console.log('Starting Wake Word Detector Test (Fallback Mode)...');

    // Initialize without an access key to force fallback mode
    const detector = new WakeWordDetector(null); 

    detector.onWakeWord(() => {
        console.log('>>> Wake word detected! (Simulated)');
        // In a real scenario, you'd trigger your main application logic here
    });

    detector.onError((error) => {
        console.error('Wake word detector error:', error);
    });

    detector.onStatusChange((status) => {
        console.log(`Status Update: ${status.visual.text} (Color: ${status.visual.color}, Animation: ${status.visual.animation})`);
    });

    const initialized = await detector.initialize();

    if (initialized) {
        detector.startListening();
        console.log('Detector initialized in fallback mode. It will simulate wake word detection every 30 seconds.');
        console.log('Press Ctrl+C to stop.');
    } else {
        console.error('Failed to initialize wake word detector, even in fallback mode.');
    }
}

runTest();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nStopping wake word detector test.');
    // In a real application, you'd call detector.destroy() here
    process.exit();
});
