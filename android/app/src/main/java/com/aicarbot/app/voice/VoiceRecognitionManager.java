package com.aicarbot.app.voice;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

import com.aicarbot.app.car.CarBotApiClient;

import java.util.ArrayList;

public class VoiceRecognitionManager {
    private static final String TAG = "VoiceRecognitionManager";
    
    private final Context context;
    private final CarBotApiClient apiClient;
    private SpeechRecognizer speechRecognizer;
    private boolean isListening = false;
    private VoiceRecognitionCallback callback;
    
    public interface VoiceRecognitionCallback {
        void onVoiceRecognitionStarted();
        void onVoiceRecognitionResult(String result);
        void onVoiceRecognitionError(String error);
        void onVoiceRecognitionStopped();
    }
    
    public VoiceRecognitionManager(Context context) {
        this.context = context;
        this.apiClient = new CarBotApiClient();
        initializeSpeechRecognizer();
    }
    
    private void initializeSpeechRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            Log.e(TAG, "Speech recognition not available on this device");
            return;
        }
        
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context);
        speechRecognizer.setRecognitionListener(new VoiceRecognitionListener());
        
        Log.d(TAG, "Speech recognizer initialized");
    }
    
    public void startListening() {
        if (isListening) {
            Log.d(TAG, "Already listening, ignoring request");
            return;
        }
        
        if (speechRecognizer == null) {
            Log.e(TAG, "Speech recognizer not available");
            if (callback != null) {
                callback.onVoiceRecognitionError("Speech recognition not available");
            }
            return;
        }
        
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.getPackageName());
        
        // Add automotive-specific parameters if available
        intent.putExtra("android.speech.extra.RECOGNITION_SERVICE_CONFIDENCE_THRESHOLD", 0.8f);
        
        isListening = true;
        speechRecognizer.startListening(intent);
        
        if (callback != null) {
            callback.onVoiceRecognitionStarted();
        }
        
        Log.d(TAG, "Started voice recognition");
    }
    
    public void stopListening() {
        if (!isListening) {
            return;
        }
        
        isListening = false;
        
        if (speechRecognizer != null) {
            speechRecognizer.stopListening();
        }
        
        if (callback != null) {
            callback.onVoiceRecognitionStopped();
        }
        
        Log.d(TAG, "Stopped voice recognition");
    }
    
    public void setCallback(VoiceRecognitionCallback callback) {
        this.callback = callback;
    }
    
    public void destroy() {
        stopListening();
        
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
    }
    
    private class VoiceRecognitionListener implements RecognitionListener {
        
        @Override
        public void onReadyForSpeech(Bundle params) {
            Log.d(TAG, "Ready for speech");
        }
        
        @Override
        public void onBeginningOfSpeech() {
            Log.d(TAG, "Beginning of speech detected");
        }
        
        @Override
        public void onRmsChanged(float rmsdB) {
            // RMS volume changed - could be used for visual feedback
        }
        
        @Override
        public void onBufferReceived(byte[] buffer) {
            // Audio buffer received
        }
        
        @Override
        public void onEndOfSpeech() {
            Log.d(TAG, "End of speech detected");
        }
        
        @Override
        public void onError(int error) {
            isListening = false;
            String errorMessage = getErrorMessage(error);
            Log.e(TAG, "Speech recognition error: " + errorMessage);
            
            if (callback != null) {
                callback.onVoiceRecognitionError(errorMessage);
            }
        }
        
        @Override
        public void onResults(Bundle results) {
            isListening = false;
            ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            
            if (matches != null && !matches.isEmpty()) {
                String recognizedText = matches.get(0);
                Log.d(TAG, "Speech recognition result: " + recognizedText);
                
                // Send to backend API
                processVoiceCommand(recognizedText);
            } else {
                Log.w(TAG, "No speech recognition results");
                if (callback != null) {
                    callback.onVoiceRecognitionError("No speech detected");
                }
            }
        }
        
        @Override
        public void onPartialResults(Bundle partialResults) {
            ArrayList<String> partialMatches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (partialMatches != null && !partialMatches.isEmpty()) {
                Log.d(TAG, "Partial result: " + partialMatches.get(0));
            }
        }
        
        @Override
        public void onEvent(int eventType, Bundle params) {
            // Additional events
        }
    }
    
    private void processVoiceCommand(String command) {
        Log.d(TAG, "Processing voice command: " + command);
        
        apiClient.sendVoiceCommand(command)
                .thenAccept(response -> {
                    Log.d(TAG, "Voice command response: " + response);
                    if (callback != null) {
                        callback.onVoiceRecognitionResult(response);
                    }
                })
                .exceptionally(throwable -> {
                    Log.e(TAG, "Voice command failed", throwable);
                    if (callback != null) {
                        callback.onVoiceRecognitionError("Failed to process command: " + throwable.getMessage());
                    }
                    return null;
                });
    }
    
    private String getErrorMessage(int error) {
        switch (error) {
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
                return "No speech match found";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "Recognition service busy";
            case SpeechRecognizer.ERROR_SERVER:
                return "Server error";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "No speech input";
            default:
                return "Unknown error (" + error + ")";
        }
    }
}