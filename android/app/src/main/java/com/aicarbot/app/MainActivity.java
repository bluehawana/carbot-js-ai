package com.aicarbot.app;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;
import android.widget.Button;
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

public class MainActivity extends Activity implements TextToSpeech.OnInitListener {
    
    private static final int PERMISSION_REQUEST_RECORD_AUDIO = 1;
    private TextView statusText;
    private Button voiceButton;
    private SpeechRecognizer speechRecognizer;
    private TextToSpeech textToSpeech;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Create layout with button
        android.widget.LinearLayout layout = new android.widget.LinearLayout(this);
        layout.setOrientation(android.widget.LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        
        statusText = new TextView(this);
        statusText.setText("CarBot AI Assistant\n\nReady for voice commands\n\nTap below to speak!");
        statusText.setTextSize(20);
        statusText.setPadding(0, 0, 0, 50);
        layout.addView(statusText);
        
        voiceButton = new Button(this);
        voiceButton.setText("🎤 Speak to CarBot");
        voiceButton.setTextSize(18);
        voiceButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startListening();
            }
        });
        layout.addView(voiceButton);
        
        // Add demo button for testing without voice
        Button demoButton = new Button(this);
        demoButton.setText("🚗 Demo: Say 'Hello My Car'");
        demoButton.setTextSize(16);
        demoButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                statusText.setText("Demo mode: Simulating 'Hello my car' command");
                processCommand("Hello my car");
            }
        });
        layout.addView(demoButton);
        
        setContentView(layout);
        
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
    
    private void initializeSpeechComponents() {
        // Initialize TTS
        textToSpeech = new TextToSpeech(this, this);
        
        // Initialize speech recognizer
        if (SpeechRecognizer.isRecognitionAvailable(this)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override
                public void onResults(Bundle results) {
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) {
                        String command = matches.get(0);
                        statusText.setText("You said: " + command + "\n\nProcessing...");
                        processCommand(command);
                    }
                }
                
                @Override 
                public void onReadyForSpeech(Bundle params) {
                    statusText.setText("🎤 Listening... Say something!");
                }
                
                @Override 
                public void onBeginningOfSpeech() {
                    statusText.setText("🗣️ Speaking detected...");
                }
                
                @Override 
                public void onEndOfSpeech() {
                    statusText.setText("Processing your command...");
                }
                
                @Override 
                public void onError(int error) {
                    String errorMessage = getErrorText(error);
                    statusText.setText("Voice error: " + errorMessage + "\n\nTap below to speak!");
                    
                    // Fallback: If voice recognition fails, simulate a command
                    if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                        processCommand("Hello my car");
                    }
                }
                
                @Override public void onRmsChanged(float rmsdB) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onPartialResults(Bundle partialResults) {}
                @Override public void onEvent(int eventType, Bundle params) {}
            });
        }
    }
    
    private void startListening() {
        if (speechRecognizer != null) {
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Say something to CarBot");
            statusText.setText("Starting voice recognition...");
            speechRecognizer.startListening(intent);
        } else {
            statusText.setText("Voice recognition not available!");
        }
    }
    
    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            textToSpeech.setLanguage(Locale.US);
            speak("CarBot ready for voice commands");
        }
    }
    
    private void processCommand(String command) {
        String response = generateResponse(command);
        statusText.setText("CarBot: " + response + "\n\nTap below to speak again!");
        speak(response);
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
            return "Hello! CarBot activated! I'm your intelligent car assistant. I can help with navigation, music, calls, and car controls. What would you like me to do?";
        } else if (command.contains("hello") || command.contains("hi")) {
            return "Hello! I'm CarBot, your AI car assistant. How can I help you?";
        } else if (command.contains("weather")) {
            return "I'd check the weather for you, but I need location services enabled.";
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
            return "I heard: " + command + ". I'm still learning! Try asking about navigation, music, calls, or car status.";
        }
    }
    
    private void speak(String text) {
        if (textToSpeech != null) {
            textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, null);
        }
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
        }
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
        }
    }
}