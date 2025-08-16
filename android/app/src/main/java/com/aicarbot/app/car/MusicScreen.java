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
import org.json.JSONObject;

import com.aicarbot.app.R;

public class MusicScreen extends Screen {
    private static final String TAG = "MusicScreen";
    private final CarBotApiClient apiClient;
    private String currentMessage = "Music Control - Say 'Play [song/artist]' or use buttons";
    private boolean isPlaying = false;
    
    public MusicScreen(@NonNull CarContext carContext) {
        super(carContext);
        this.apiClient = new CarBotApiClient();
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        return new MessageTemplate.Builder(currentMessage)
                .setTitle("Music Control")
                .setHeaderAction(Action.BACK)
                .addAction(new Action.Builder()
                        .setTitle(isPlaying ? "Pause" : "Play")
                        .setIcon(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_music))
                                .build())
                        .setOnClickListener(this::togglePlayback)
                        .build())
                .addAction(new Action.Builder()
                        .setTitle("Next")
                        .setIcon(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_music))
                                .build())
                        .setOnClickListener(this::nextTrack)
                        .build())
                .addAction(new Action.Builder()
                        .setTitle("🎤 Voice")
                        .setIcon(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_mic))
                                .build())
                        .setOnClickListener(this::openVoiceScreen)
                        .build())
                .build();
    }
    
    private void togglePlayback() {
        String action = isPlaying ? "pause" : "play";
        sendMusicCommand(action, "music");
    }
    
    private void nextTrack() {
        sendMusicCommand("next", "track");
    }
    
    private void sendMusicCommand(String action, String type) {
        try {
            JSONObject params = new JSONObject();
            params.put("action", action);
            params.put("type", type);
            
            currentMessage = "Processing music command...";
            invalidate();
            
            apiClient.sendCarAction("music_" + action, params)
                    .thenAccept(response -> {
                        getCarContext().getMainExecutor().execute(() -> {
                            isPlaying = action.equals("play");
                            currentMessage = "Music: " + action + " command executed";
                            invalidate();
                        });
                    })
                    .exceptionally(throwable -> {
                        getCarContext().getMainExecutor().execute(() -> {
                            Log.e(TAG, "Music command failed", throwable);
                            currentMessage = "Music command failed: " + throwable.getMessage();
                            invalidate();
                        });
                        return null;
                    });
        } catch (Exception e) {
            Log.e(TAG, "Error creating music command", e);
            currentMessage = "Error: " + e.getMessage();
            invalidate();
        }
    }
    
    private void openVoiceScreen() {
        getScreenManager().push(new VoiceScreen(getCarContext()));
    }
}