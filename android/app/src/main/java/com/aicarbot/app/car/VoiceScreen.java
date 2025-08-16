package com.aicarbot.app.car;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.CarIcon;
import androidx.car.app.model.MessageTemplate;
import androidx.car.app.model.Template;
import androidx.core.graphics.drawable.IconCompat;
import android.util.Log;

import com.aicarbot.app.R;

public class VoiceScreen extends Screen {
    private static final String TAG = "VoiceScreen";
    private final CarBotApiClient apiClient;
    private String currentMessage;
    private boolean isListening = false;
    
    public VoiceScreen(@NonNull CarContext carContext) {
        super(carContext);
        this.apiClient = new CarBotApiClient();
        this.currentMessage = getCarContext().getString(R.string.voice_ready_enhanced);
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        return new MessageTemplate.Builder(currentMessage)
                .setTitle("🎤 CarBot Voice Assistant")
                .setHeaderAction(Action.BACK)
                .addAction(new Action.Builder()
                        .setTitle(isListening ? "⏹ Stop" : "▶ Start Voice")
                        .setIcon(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_mic))
                                .build())
                        .setOnClickListener(this::toggleListening)
                        .build())
                .addAction(new Action.Builder()
                        .setTitle("📋 Help")
                        .setIcon(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_help))
                                .build())
                        .setOnClickListener(this::showHelp)
                        .build())
                .build();
    }
    
    private void toggleListening() {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }
    
    private void startListening() {
        isListening = true;
        currentMessage = getCarContext().getString(R.string.voice_listening_enhanced);
        invalidate();
        
        // Simulate voice recognition - in real implementation, this would use Android's SpeechRecognizer
        // For now, we'll send a test command to the backend
        sendTestVoiceCommand();
    }
    
    private void stopListening() {
        isListening = false;
        currentMessage = getCarContext().getString(R.string.voice_ready_enhanced);
        invalidate();
    }
    
    private void sendTestVoiceCommand() {
        // This is a simulation - real implementation would capture actual voice
        String testCommand = "What's the weather like?";
        
        currentMessage = getCarContext().getString(R.string.voice_processing);
        invalidate();
        
        apiClient.sendVoiceCommand(testCommand)
                .thenAccept(response -> {
                    getCarContext().getMainExecutor().execute(() -> {
                        currentMessage = "Response: " + response;
                        isListening = false;
                        invalidate();
                    });
                })
                .exceptionally(throwable -> {
                    getCarContext().getMainExecutor().execute(() -> {
                        Log.e(TAG, "Voice command failed", throwable);
                        currentMessage = getCarContext().getString(R.string.voice_error);
                        isListening = false;
                        invalidate();
                    });
                    return null;
                });
    }
    
    private void showHelp() {
        // Show help information about voice activation methods
        currentMessage = getCarContext().getString(R.string.voice_activation_methods);
        invalidate();
        
        // Auto-return to ready state after showing help for 5 seconds
        getCarContext().getMainExecutor().execute(() -> {
            new Thread(() -> {
                try {
                    Thread.sleep(5000);
                    getCarContext().getMainExecutor().execute(() -> {
                        if (!isListening) {
                            currentMessage = getCarContext().getString(R.string.voice_ready_enhanced);
                            invalidate();
                        }
                    });
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }).start();
        });
    }
}