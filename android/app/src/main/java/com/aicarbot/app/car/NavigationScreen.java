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

public class NavigationScreen extends Screen {
    private static final String TAG = "NavigationScreen";
    private final CarBotApiClient apiClient;
    private String currentMessage = "Enter destination or say 'Navigate to...'";
    
    public NavigationScreen(@NonNull CarContext carContext) {
        super(carContext);
        this.apiClient = new CarBotApiClient();
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        return new MessageTemplate.Builder(currentMessage)
                .setTitle("Navigation")
                .setHeaderAction(Action.BACK)
                .addAction(new Action.Builder()
                        .setTitle("Home")
                        .setIcon(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_navigation))
                                .build())
                        .setOnClickListener(this::navigateHome)
                        .build())
                .addAction(new Action.Builder()
                        .setTitle("Work")
                        .setIcon(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_navigation))
                                .build())
                        .setOnClickListener(this::navigateToWork)
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
    
    private void navigateHome() {
        startNavigation("Home");
    }
    
    private void navigateToWork() {
        startNavigation("Work");
    }
    
    private void startNavigation(String destination) {
        currentMessage = "Starting navigation to " + destination + "...";
        invalidate();
        
        apiClient.getNavigation(destination)
                .thenAccept(response -> {
                    getCarContext().getMainExecutor().execute(() -> {
                        currentMessage = "Navigation started to " + destination;
                        invalidate();
                    });
                })
                .exceptionally(throwable -> {
                    getCarContext().getMainExecutor().execute(() -> {
                        Log.e(TAG, "Navigation failed", throwable);
                        currentMessage = "Navigation failed: " + throwable.getMessage();
                        invalidate();
                    });
                    return null;
                });
    }
    
    private void openVoiceScreen() {
        getScreenManager().push(new VoiceScreen(getCarContext()));
    }
}