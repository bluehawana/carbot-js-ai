package com.aicarbot.app.car;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarIcon;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.core.graphics.drawable.IconCompat;
import android.util.Log;

import com.aicarbot.app.R;

public class SettingsScreen extends Screen {
    private static final String TAG = "SettingsScreen";
    
    public SettingsScreen(@NonNull CarContext carContext) {
        super(carContext);
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        return new ListTemplate.Builder()
                .setSingleList(createSettingsList())
                .setTitle("Settings")
                .setHeaderAction(Action.BACK)
                .setActionStrip(new ActionStrip.Builder()
                        .addAction(new Action.Builder()
                                .setTitle("🎤 Voice")
                                .setIcon(new CarIcon.Builder(
                                        IconCompat.createWithResource(getCarContext(), R.drawable.ic_mic))
                                        .build())
                                .setOnClickListener(this::openVoiceScreen)
                                .build())
                        .build())
                .build();
    }

    private ItemList createSettingsList() {
        return new ItemList.Builder()
                .addItem(new Row.Builder()
                        .setTitle("Wake Word Sensitivity")
                        .addText("Current: Medium")
                        .setOnClickListener(this::adjustWakeWordSensitivity)
                        .build())
                .addItem(new Row.Builder()
                        .setTitle("Voice Language")
                        .addText("Current: English (US)")
                        .setOnClickListener(this::changeLanguage)
                        .build())
                .addItem(new Row.Builder()
                        .setTitle("Car Integration")
                        .addText("Configure car system connections")
                        .setOnClickListener(this::configureCarIntegration)
                        .build())
                .addItem(new Row.Builder()
                        .setTitle("Emergency Contacts")
                        .addText("Set up emergency contact preferences")
                        .setOnClickListener(this::configureEmergencyContacts)
                        .build())
                .addItem(new Row.Builder()
                        .setTitle("Privacy Settings")
                        .addText("Manage data collection preferences")
                        .setOnClickListener(this::configurePrivacy)
                        .build())
                .build();
    }
    
    private void adjustWakeWordSensitivity() {
        Log.d(TAG, "Wake word sensitivity adjustment requested");
        // In real implementation, show sensitivity adjustment UI
    }
    
    private void changeLanguage() {
        Log.d(TAG, "Language change requested");
        // In real implementation, show language selection UI
    }
    
    private void configureCarIntegration() {
        Log.d(TAG, "Car integration configuration requested");
        // In real implementation, show car system connection settings
    }
    
    private void configureEmergencyContacts() {
        Log.d(TAG, "Emergency contacts configuration requested");
        // In real implementation, show emergency contacts setup
    }
    
    private void configurePrivacy() {
        Log.d(TAG, "Privacy settings configuration requested");
        // In real implementation, show privacy settings
    }
    
    private void openVoiceScreen() {
        getScreenManager().push(new VoiceScreen(getCarContext()));
    }
}