package com.aicarbot.app.voice;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;

public class VoiceMediaService extends Service {
    private static final String TAG = "VoiceMediaService";
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "VoiceMediaService created");
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "VoiceMediaService started");
        return START_STICKY;
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        Log.d(TAG, "VoiceMediaService bound");
        return null;
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "VoiceMediaService destroyed");
    }
}