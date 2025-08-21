package com.aicarbot.app;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;
import android.widget.Button;
import android.widget.LinearLayout;
import android.view.View;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.RecognitionListener;
import android.content.Intent;
import android.speech.tts.TextToSpeech;
import java.util.ArrayList;
import java.util.Locale;
import android.content.pm.PackageManager;
import android.Manifest;
import android.os.Build;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.session.MediaControllerCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.content.ComponentName;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.content.Context;
import android.util.Log;
import com.google.android.material.button.MaterialButton;

public class MainActivity extends Activity implements TextToSpeech.OnInitListener {
    
    private static final String TAG = "CarBotMainActivity";
    private MediaBrowserCompat mediaBrowser;
    private MediaControllerCompat mediaController;
    private VoiceTriggerReceiver voiceTriggerReceiver;
    private CarBotApiService apiService;
    
    private static final int PERMISSION_REQUEST_RECORD_AUDIO = 1;
    private TextView statusText;
    private TextView connectionText;
    private MaterialButton voiceButton;
    private MaterialButton demoButton;
    private MaterialButton settingsButton;
    private MaterialButton helpButton;
    private LinearLayout voiceAnimation;
    private View connectionStatus;
    private SpeechRecognizer speechRecognizer;
    private TextToSpeech textToSpeech;
    private boolean isListening = false;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        // Initialize views
        initializeViews();
        
        // Initialize API service for backend communication
        apiService = new CarBotApiService();
        
        // Test backend connection
        testBackendConnection();
        
        // Initialize MediaSession integration (optional - app works without it)
        try {
            initializeMediaSession();
            
            // Register voice trigger receiver
            voiceTriggerReceiver = new VoiceTriggerReceiver();
            IntentFilter filter = new IntentFilter("com.aicarbot.app.VOICE_TRIGGER");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(voiceTriggerReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(voiceTriggerReceiver, filter);
            }
        } catch (Exception e) {
            Log.e(TAG, "MediaSession initialization failed, continuing without it", e);
        }
        
        // Check for audio permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, PERMISSION_REQUEST_RECORD_AUDIO);
            } else {
                initializeSpeechComponents();
            }
        } else {
            initializeSpeechComponents();
        }
    }
    
    private void initializeViews() {
        statusText = findViewById(R.id.statusText);
        connectionText = findViewById(R.id.connectionText);
        voiceButton = findViewById(R.id.voiceButton);
        demoButton = findViewById(R.id.demoButton);
        settingsButton = findViewById(R.id.settingsButton);
        helpButton = findViewById(R.id.helpButton);
        voiceAnimation = findViewById(R.id.voiceAnimation);
        connectionStatus = findViewById(R.id.connectionStatus);
        
        // Set click listeners
        voiceButton.setOnClickListener(v -> startListening());
        demoButton.setOnClickListener(v -> {
            statusText.setText("🚗 Demo Mode: Simulating 'Hello my car' command");
            processCommand("Hello my car");
        });
        settingsButton.setOnClickListener(v -> showSettings());
        helpButton.setOnClickListener(v -> showHelp());
    }
    
    private void testBackendConnection() {
        updateConnectionStatus("⚡ Connecting to AI backend...", false);
        
        apiService.checkHealth(new CarBotApiService.ApiCallback() {
            @Override
            public void onSuccess(String response) {
                runOnUiThread(() -> {
                    Log.d(TAG, "Backend connection successful: " + response);
                    updateConnectionStatus("✅ Connected to AI backend", true);
                });
            }
            
            @Override
            public void onError(String error) {
                runOnUiThread(() -> {
                    Log.w(TAG, "Backend connection failed: " + error);
                    updateConnectionStatus("⚠️ Backend offline - using demo mode", false);
                });
            }
        });
    }
    
    private void updateConnectionStatus(String message, boolean connected) {
        connectionText.setText(message);
        connectionStatus.setBackgroundResource(connected ? 
            R.drawable.status_indicator_green : R.drawable.status_indicator);
    }
    
    private void showVoiceAnimation(boolean show) {
        voiceAnimation.setVisibility(show ? View.VISIBLE : View.GONE);
        voiceButton.setText(show ? "🎤 Listening..." : "🎤 Speak to CarBot");
        voiceButton.setEnabled(!show);
    }
    
    private void initializeMediaSession() {
        // Create MediaBrowser to connect to MediaSessionService
        mediaBrowser = new MediaBrowserCompat(this,
            new ComponentName(this, MediaSessionService.class),
            connectionCallbacks,
            null);
        
        Log.d(TAG, "MediaBrowser created");
    }
    
    private final MediaBrowserCompat.ConnectionCallback connectionCallbacks =
        new MediaBrowserCompat.ConnectionCallback() {
            @Override
            public void onConnected() {
                Log.d(TAG, "MediaBrowser connected");
                
                // Get the token for the MediaSession
                try {
                    mediaController = new MediaControllerCompat(MainActivity.this,
                        mediaBrowser.getSessionToken());
                    
                    // Set the Media Controller as the Activity's media controller
                    MediaControllerCompat.setMediaController(MainActivity.this, mediaController);
                    
                    // Don't auto-start playback - wait for user interaction
                    Log.d(TAG, "MediaController ready for user interaction");
                    
                } catch (Exception e) {
                    Log.e(TAG, "Failed to create MediaController", e);
                }
            }
            
            @Override
            public void onConnectionSuspended() {
                Log.d(TAG, "MediaBrowser connection suspended");
            }
            
            @Override
            public void onConnectionFailed() {
                Log.e(TAG, "MediaBrowser connection failed");
            }
        };
    
    private class VoiceTriggerReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            String commandHint = intent.getStringExtra("command_hint");
            Log.d(TAG, "Voice trigger received with hint: " + commandHint);
            
            runOnUiThread(() -> {
                if ("next".equals(commandHint)) {
                    statusText.setText("🎤 Ready for 'next' command...");
                    processCommand("play next song");
                } else if ("previous".equals(commandHint)) {
                    statusText.setText("🎤 Ready for 'previous' command...");
                    processCommand("play previous song");
                } else {
                    statusText.setText("🎤 Voice activated! Ready for command...");
                    startListening();
                }
            });
        }
    }
    
    private void initializeSpeechComponents() {
        // Initialize TTS
        textToSpeech = new TextToSpeech(this, this);
        
        // Check if voice recognition is available
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            statusText.setText("Voice recognition not available on this device.\nUsing demo mode instead.");
            Log.w(TAG, "Speech recognition not available");
            return;
        }
        
        // Initialize speech recognizer
        try {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override
                public void onResults(Bundle results) {
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) {
                        String command = matches.get(0);
                        Log.d(TAG, "=== SPEECH RECOGNIZED: \"" + command + "\"");
                        Log.d(TAG, "=== All matches: " + matches.toString());
                        runOnUiThread(() -> {
                            showVoiceAnimation(false);
                            isListening = false;
                            processCommand(command);
                        });
                    } else {
                        Log.e(TAG, "=== NO SPEECH MATCHES RETURNED!");
                        runOnUiThread(() -> {
                            statusText.setText("No speech detected. Please try again!");
                            showVoiceAnimation(false);
                            isListening = false;
                        });
                    }
                }
                
                @Override 
                public void onReadyForSpeech(Bundle params) {
                    runOnUiThread(() -> {
                        statusText.setText("🎤 Listening... Say something!");
                        showVoiceAnimation(true);
                    });
                }
                
                @Override 
                public void onBeginningOfSpeech() {
                    runOnUiThread(() -> statusText.setText("🗣️ Speaking detected..."));
                }
                
                @Override 
                public void onEndOfSpeech() {
                    runOnUiThread(() -> {
                        statusText.setText("🤖 Processing your command...");
                        showVoiceAnimation(false);
                    });
                }
                
                @Override 
                public void onError(int error) {
                    String errorMessage = getErrorText(error);
                    runOnUiThread(() -> {
                        statusText.setText("Voice error: " + errorMessage + "\n\nTap below to speak!");
                        showVoiceAnimation(false);
                        isListening = false;
                        
                        // Don't auto-fallback - just show the error
                        // This was causing ALL commands to become "Hello my car"!
                    });
                }
                
                @Override 
                public void onRmsChanged(float rmsdB) {
                    // Log.v(TAG, "RMS changed: " + rmsdB);
                }
                
                @Override 
                public void onBufferReceived(byte[] buffer) {}
                
                @Override 
                public void onPartialResults(Bundle partialResults) {
                    ArrayList<String> partialMatches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (partialMatches != null && !partialMatches.isEmpty()) {
                        String partial = partialMatches.get(0);
                        Log.d(TAG, "=== PARTIAL RESULT: \"" + partial + "\"");
                        runOnUiThread(() -> statusText.setText("Hearing: \"" + partial + "\"..."));
                    }
                }
                
                @Override 
                public void onEvent(int eventType, Bundle params) {}
            });
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize speech recognizer", e);
            statusText.setText("Speech recognizer initialization failed.\nUsing demo mode.");
        }
    }
    
    private void startListening() {
        if (isListening) return;
        
        if (speechRecognizer != null && SpeechRecognizer.isRecognitionAvailable(this)) {
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US");
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Say something to CarBot");
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            // Remove the timeout settings - they might be causing immediate cutoff
            // intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500);
            // intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1000);
            
            statusText.setText("Starting voice recognition...");
            isListening = true;
            speechRecognizer.startListening(intent);
        } else {
            statusText.setText("Voice recognition not available!\n\nPlease check:\n• Google app is installed\n• Speech services are enabled\n• Microphone permission granted");
            // Don't auto-fallback anymore
        }
    }
    
    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int result = textToSpeech.setLanguage(Locale.US);
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                Log.e(TAG, "TTS language not supported");
            }
            // Don't speak on init - too annoying
        }
    }
    
    private void processCommand(String command) {
        statusText.setText("You: \"" + command + "\"\n\n🤖 Thinking...");
        
        Log.d(TAG, "=== SENDING COMMAND TO API: " + command);
        
        // Send command to backend API (Groq)
        apiService.sendVoiceCommand(command, new CarBotApiService.ApiCallback() {
            @Override
            public void onSuccess(String response) {
                runOnUiThread(() -> {
                    try {
                        Log.d(TAG, "=== API SUCCESS! Response: " + response);
                        
                        // Parse JSON response
                        com.google.gson.JsonParser parser = new com.google.gson.JsonParser();
                        com.google.gson.JsonObject jsonResponse = parser.parse(response).getAsJsonObject();
                        
                        String aiResponse = "I heard: " + command;
                        if (jsonResponse.has("response")) {
                            aiResponse = jsonResponse.get("response").getAsString();
                            Log.d(TAG, "=== GOT AI RESPONSE: " + aiResponse);
                        } else if (jsonResponse.has("message")) {
                            aiResponse = jsonResponse.get("message").getAsString();
                            Log.d(TAG, "=== GOT MESSAGE: " + aiResponse);
                        }
                        
                        statusText.setText("You: \"" + command + "\"\n\nCarBot: " + aiResponse + "\n\n💬 Ready for next question!");
                        speak(aiResponse);
                        
                    } catch (Exception e) {
                        Log.e(TAG, "=== ERROR parsing API response: " + response, e);
                        String fallbackResponse = generateResponse(command);
                        statusText.setText("You: \"" + command + "\"\n\nCarBot: " + fallbackResponse + "\n\n💬 Ready for next question!");
                        speak(fallbackResponse);
                    }
                });
            }
            
            @Override
            public void onError(String error) {
                runOnUiThread(() -> {
                    Log.e(TAG, "=== API CALL FAILED: " + error);
                    Log.e(TAG, "=== Command was: " + command);
                    // Fallback to local responses
                    String fallbackResponse = generateResponse(command);
                    statusText.setText("You: \"" + command + "\"\n\nCarBot (offline): " + fallbackResponse + "\n\n💬 Ready for next question!");
                    speak(fallbackResponse);
                });
            }
        });
    }
    
    private String getErrorText(int errorCode) {
        switch(errorCode) {
            case SpeechRecognizer.ERROR_AUDIO:
                return "Audio recording error";
            case SpeechRecognizer.ERROR_CLIENT:
                return "Client side error";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "Insufficient permissions";
            case SpeechRecognizer.ERROR_NETWORK:
                return "Network error";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "Network timeout";
            case SpeechRecognizer.ERROR_NO_MATCH:
                return "No speech match";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "Recognition service busy";
            case SpeechRecognizer.ERROR_SERVER:
                return "Server error";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "No speech input";
            default:
                return "Unknown error " + errorCode;
        }
    }
    
    private String generateResponse(String command) {
        command = command.toLowerCase();
        
        if (command.contains("hello") && command.contains("car")) {
            return "Hello! CarBot activated! I'm your intelligent car assistant. I can help with navigation, weather, music, calls, and car controls. What would you like me to do?";
        } else if (command.contains("hello") || command.contains("hi")) {
            return "Hello! I'm CarBot, your AI car assistant. How can I help you today?";
        } else if (command.contains("weather")) {
            return "I'd love to check the weather for you! Please make sure I'm connected to the internet and try again.";
        } else if (command.contains("navigate") || command.contains("directions")) {
            return "I can help with navigation! Where would you like to go?";
        } else if (command.contains("music") || command.contains("play")) {
            return "I can control your music. What would you like to listen to?";
        } else if (command.contains("call")) {
            return "I can make calls for you. Who would you like to call?";
        } else if (command.contains("temperature") || command.contains("climate")) {
            return "I can adjust the climate. What temperature would you prefer?";
        } else if (command.contains("status") || command.contains("car")) {
            return "All car systems are functioning normally. How else can I assist you?";
        } else {
            return "I heard: \"" + command + "\". I'm still learning! Try asking about navigation, weather, music, calls, or car status.";
        }
    }
    
    private void speak(String text) {
        if (textToSpeech != null) {
            textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, null);
        }
    }
    
    private void showSettings() {
        statusText.setText("⚙️ Settings panel coming soon!\n\nHere you'll be able to:\n• Configure voice settings\n• Adjust AI personality\n• Manage car integrations\n• Update server settings");
    }
    
    private void showHelp() {
        statusText.setText("❓ CarBot Help\n\nTry saying:\n• \"Hello my car\" - Activate CarBot\n• \"What's the weather?\" - Get weather info\n• \"Navigate to...\" - Get directions\n• \"Play music\" - Control music\n• \"Call someone\" - Make phone calls\n\nTap the demo button to test without speaking!");
    }
    
    @Override
    protected void onStart() {
        super.onStart();
        if (mediaBrowser != null && !mediaBrowser.isConnected()) {
            try {
                mediaBrowser.connect();
            } catch (Exception e) {
                Log.e(TAG, "Failed to connect MediaBrowser", e);
            }
        }
    }
    
    @Override
    protected void onStop() {
        super.onStop();
        if (MediaControllerCompat.getMediaController(this) != null) {
            MediaControllerCompat.getMediaController(this).unregisterCallback(controllerCallback);
        }
        if (mediaBrowser != null && mediaBrowser.isConnected()) {
            mediaBrowser.disconnect();
        }
    }
    
    private MediaControllerCompat.Callback controllerCallback =
        new MediaControllerCompat.Callback() {
            @Override
            public void onPlaybackStateChanged(PlaybackStateCompat state) {
                Log.d(TAG, "Playback state changed: " + state.getState());
            }
        };
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        
        // Unregister voice trigger receiver
        if (voiceTriggerReceiver != null) {
            try {
                unregisterReceiver(voiceTriggerReceiver);
            } catch (Exception e) {
                Log.w(TAG, "Failed to unregister receiver", e);
            }
        }
        
        // Clean up MediaBrowser
        if (mediaBrowser != null && mediaBrowser.isConnected()) {
            mediaBrowser.disconnect();
        }
        
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
        }
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
        }
    }
    
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_RECORD_AUDIO) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                initializeSpeechComponents();
            } else {
                statusText.setText("❌ Microphone permission denied\n\nPlease enable microphone access in Settings to use voice commands.\n\nYou can still use the Demo button!");
            }
        }
    }
}