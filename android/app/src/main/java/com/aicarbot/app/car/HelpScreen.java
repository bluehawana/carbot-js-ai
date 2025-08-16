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

import com.aicarbot.app.R;

public class HelpScreen extends Screen {
    private static final String TAG = "HelpScreen";
    
    public HelpScreen(@NonNull CarContext carContext) {
        super(carContext);
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        return new ListTemplate.Builder()
                .setSingleList(createHelpList())
                .setTitle("Help & Commands")
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

    private ItemList createHelpList() {
        return new ItemList.Builder()
                .addItem(new Row.Builder()
                        .setTitle("Voice Activation")
                        .addText("Say 'Hi CarBot', tap voice button, or hold steering wheel mic")
                        .build())
                .addItem(new Row.Builder()
                        .setTitle("Navigation Commands")
                        .addText("'Navigate to [destination]' or 'Take me to [place]'")
                        .build())
                .addItem(new Row.Builder()
                        .setTitle("Music Commands")
                        .addText("'Play [song/artist]', 'Next song', 'Pause music'")
                        .build())
                .addItem(new Row.Builder()
                        .setTitle("Phone Commands")
                        .addText("'Call [contact]', 'Send message to [contact]'")
                        .build())
                .addItem(new Row.Builder()
                        .setTitle("Car Controls")
                        .addText("'Lock doors', 'Set temperature to [temp]', 'Turn on lights'")
                        .build())
                .addItem(new Row.Builder()
                        .setTitle("Information")
                        .addText("'What's my fuel level?', 'Check tire pressure', 'Car status'")
                        .build())
                .addItem(new Row.Builder()
                        .setTitle("Social Media")
                        .addText("'What's Elon Musk's latest tweet?', 'Show Trump's recent posts'")
                        .build())
                .addItem(new Row.Builder()
                        .setTitle("Emergency")
                        .addText("'Emergency' or 'Call 911' for immediate assistance")
                        .build())
                .build();
    }
    
    private void openVoiceScreen() {
        getScreenManager().push(new VoiceScreen(getCarContext()));
    }
}