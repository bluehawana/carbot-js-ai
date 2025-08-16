package com.aicarbot.app.car;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarIcon;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.core.graphics.drawable.IconCompat;

import com.aicarbot.app.R;

public class MainScreen extends Screen {
    
    public MainScreen(@NonNull CarContext carContext) {
        super(carContext);
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        return new ListTemplate.Builder()
                .setSingleList(createMainList())
                .setTitle(getCarContext().getString(R.string.main_title))
                .setHeaderAction(Action.APP_ICON)
                .setActionStrip(createActionStrip())
                .build();
    }

    private ItemList createMainList() {
        return new ItemList.Builder()
                .addItem(new Row.Builder()
                        .setTitle(getCarContext().getString(R.string.voice_assistant))
                        .addText(getCarContext().getString(R.string.voice_assistant_subtitle))
                        .addText(getCarContext().getString(R.string.voice_activation_methods))
                        .setImage(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_mic))
                                .build())
                        .setOnClickListener(this::onVoiceCommandClick)
                        .build())
                .addItem(new Row.Builder()
                        .setTitle(getCarContext().getString(R.string.navigation_title))
                        .addText(getCarContext().getString(R.string.navigation_subtitle))
                        .setImage(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_navigation))
                                .build())
                        .setOnClickListener(this::onNavigationClick)
                        .build())
                .addItem(new Row.Builder()
                        .setTitle(getCarContext().getString(R.string.music_title))
                        .addText(getCarContext().getString(R.string.music_subtitle))
                        .setImage(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_music))
                                .build())
                        .setOnClickListener(this::onMusicClick)
                        .build())
                .addItem(new Row.Builder()
                        .setTitle(getCarContext().getString(R.string.phone_title))
                        .addText(getCarContext().getString(R.string.phone_subtitle))
                        .setImage(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_phone))
                                .build())
                        .setOnClickListener(this::onPhoneClick)
                        .build())
                .addItem(new Row.Builder()
                        .setTitle(getCarContext().getString(R.string.settings_title))
                        .addText(getCarContext().getString(R.string.settings_subtitle))
                        .setImage(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_settings))
                                .build())
                        .setOnClickListener(this::onSettingsClick)
                        .build())
                .build();
    }

    private ActionStrip createActionStrip() {
        return new ActionStrip.Builder()
                .addAction(new Action.Builder()
                        .setTitle("🎤 Voice")
                        .setIcon(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_mic))
                                .build())
                        .setOnClickListener(this::onVoiceCommandClick)
                        .build())
                .addAction(new Action.Builder()
                        .setTitle(getCarContext().getString(R.string.help))
                        .setIcon(new CarIcon.Builder(
                                IconCompat.createWithResource(getCarContext(), R.drawable.ic_help))
                                .build())
                        .setOnClickListener(this::onHelpClick)
                        .build())
                .build();
    }

    private void onVoiceCommandClick() {
        // Start voice recognition
        getScreenManager().push(new VoiceScreen(getCarContext()));
    }

    private void onNavigationClick() {
        // Open navigation screen
        getScreenManager().push(new NavigationScreen(getCarContext()));
    }

    private void onMusicClick() {
        // Open music control screen
        getScreenManager().push(new MusicScreen(getCarContext()));
    }

    private void onPhoneClick() {
        // Open phone screen
        getScreenManager().push(new PhoneScreen(getCarContext()));
    }

    private void onSettingsClick() {
        // Open settings screen
        getScreenManager().push(new SettingsScreen(getCarContext()));
    }

    private void onHelpClick() {
        // Show help information
        getScreenManager().push(new HelpScreen(getCarContext()));
    }
}