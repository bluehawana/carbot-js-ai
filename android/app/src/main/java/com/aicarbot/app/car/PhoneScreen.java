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

public class PhoneScreen extends Screen {
    private static final String TAG = "PhoneScreen";
    private final CarBotApiClient apiClient;
    private String currentMessage = "Phone Control - Say 'Call [contact]' or 'Send message to [contact]'";
    
    public PhoneScreen(@NonNull CarContext carContext) {
        super(carContext);
        this.apiClient = new CarBotApiClient();
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        return new MessageTemplate.Builder(currentMessage)
                .setTitle("Phone")
                .setHeaderAction(Action.BACK)
                .addAction(new Action.Builder()
                        .setTitle("Call Home")
                        .setIcon(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_phone))
                                .build())
                        .setOnClickListener(this::callHome)
                        .build())
                .addAction(new Action.Builder()
                        .setTitle("Emergency")
                        .setIcon(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_phone))
                                .build())
                        .setOnClickListener(this::callEmergency)
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
    
    private void callHome() {
        makeCall("Home");
    }
    
    private void callEmergency() {
        makeCall("911");
    }
    
    private void makeCall(String contact) {
        try {
            JSONObject params = new JSONObject();
            params.put("contact", contact);
            params.put("type", "call");
            
            currentMessage = "Calling " + contact + "...";
            invalidate();
            
            apiClient.sendCarAction("make_call", params)
                    .thenAccept(response -> {
                        getCarContext().getMainExecutor().execute(() -> {
                            currentMessage = "Calling " + contact;
                            invalidate();
                        });
                    })
                    .exceptionally(throwable -> {
                        getCarContext().getMainExecutor().execute(() -> {
                            Log.e(TAG, "Call failed", throwable);
                            currentMessage = "Call failed: " + throwable.getMessage();
                            invalidate();
                        });
                        return null;
                    });
        } catch (Exception e) {
            Log.e(TAG, "Error making call", e);
            currentMessage = "Call error: " + e.getMessage();
            invalidate();
        }
    }
    
    private void openVoiceScreen() {
        getScreenManager().push(new VoiceScreen(getCarContext()));
    }
}