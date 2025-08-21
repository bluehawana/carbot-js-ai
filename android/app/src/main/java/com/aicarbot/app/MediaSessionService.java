package com.aicarbot.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.MediaBrowserServiceCompat;
import androidx.media.session.MediaButtonReceiver;

import java.util.List;

public class MediaSessionService extends MediaBrowserServiceCompat {
    private static final String TAG = "CarBotMediaService";
    private static final String MEDIA_ROOT_ID = "media_root_id";
    private static final String EMPTY_MEDIA_ROOT_ID = "empty_root_id";
    
    private MediaSessionCompat mediaSession;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private PlaybackStateCompat.Builder stateBuilder;
    private MediaNotificationManager notificationManager;
    private boolean audioFocusRequested = false;
    
    @Override
    public void onCreate() {
        super.onCreate();
        
        // Initialize audio manager
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        
        // Create MediaSession
        mediaSession = new MediaSessionCompat(this, TAG);
        
        // Enable callbacks from MediaButtons and TransportControls
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        
        // Set initial playback state
        stateBuilder = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_PLAY_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            );
        mediaSession.setPlaybackState(stateBuilder.build());
        
        // Set MediaSession callback
        mediaSession.setCallback(new MediaSessionCallback());
        
        // Set session activity (launches MainActivity when notification clicked)
        Intent sessionActivityIntent = new Intent(this, MainActivity.class);
        mediaSession.setSessionActivity(PendingIntent.getActivity(this, 0, sessionActivityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        
        // Create notification manager
        notificationManager = new MediaNotificationManager(this);
        
        // Set the session token so MediaBrowser can connect
        setSessionToken(mediaSession.getSessionToken());
        
        Log.d(TAG, "MediaSession created successfully");
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        MediaButtonReceiver.handleIntent(mediaSession, intent);
        return super.onStartCommand(intent, flags, startId);
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        
        // Release audio focus
        abandonAudioFocus();
        
        // Release MediaSession
        mediaSession.release();
        
        Log.d(TAG, "MediaSession destroyed");
    }
    
    @Nullable
    @Override
    public BrowserRoot onGetRoot(@NonNull String clientPackageName, int clientUid, @Nullable Bundle rootHints) {
        // Clients can connect, but return empty root for browsing
        return new BrowserRoot(EMPTY_MEDIA_ROOT_ID, null);
    }
    
    @Override
    public void onLoadChildren(@NonNull String parentId, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        // Since CarBot is a voice assistant, not a media player, return empty list
        result.sendResult(null);
    }
    
    private class MediaSessionCallback extends MediaSessionCompat.Callback {
        @Override
        public void onPlay() {
            Log.d(TAG, "MediaSession onPlay called");
            
            if (requestAudioFocus()) {
                startService(new Intent(getApplicationContext(), MediaSessionService.class));
                mediaSession.setActive(true);
                
                // Update playback state
                mediaSession.setPlaybackState(stateBuilder
                    .setState(PlaybackStateCompat.STATE_PLAYING, 0, 1.0f)
                    .build());
                
                // Start foreground notification
                startForeground(MediaNotificationManager.NOTIFICATION_ID, 
                    notificationManager.getNotification(getMediaMetadata(), 
                        mediaSession.getController().getPlaybackState(), 
                        mediaSession.getSessionToken()));
                
                // Trigger voice listening in MainActivity
                Intent voiceIntent = new Intent("com.aicarbot.app.VOICE_TRIGGER");
                sendBroadcast(voiceIntent);
            }
        }
        
        @Override
        public void onPause() {
            Log.d(TAG, "MediaSession onPause called");
            
            // Update playback state
            mediaSession.setPlaybackState(stateBuilder
                .setState(PlaybackStateCompat.STATE_PAUSED, 0, 1.0f)
                .build());
                
            // Update notification
            notificationManager.getNotificationManager()
                .notify(MediaNotificationManager.NOTIFICATION_ID,
                    notificationManager.getNotification(getMediaMetadata(),
                        mediaSession.getController().getPlaybackState(),
                        mediaSession.getSessionToken()));
        }
        
        @Override
        public void onStop() {
            Log.d(TAG, "MediaSession onStop called");
            
            abandonAudioFocus();
            
            // Update playback state
            mediaSession.setPlaybackState(stateBuilder
                .setState(PlaybackStateCompat.STATE_STOPPED, 0, 1.0f)
                .build());
            
            mediaSession.setActive(false);
            stopForeground(true);
            stopSelf();
        }
        
        @Override
        public void onSkipToNext() {
            Log.d(TAG, "MediaSession onSkipToNext called - triggering voice command");
            // Trigger voice listening for "next" command
            Intent voiceIntent = new Intent("com.aicarbot.app.VOICE_TRIGGER");
            voiceIntent.putExtra("command_hint", "next");
            sendBroadcast(voiceIntent);
        }
        
        @Override
        public void onSkipToPrevious() {
            Log.d(TAG, "MediaSession onSkipToPrevious called - triggering voice command");
            // Trigger voice listening for "previous" command
            Intent voiceIntent = new Intent("com.aicarbot.app.VOICE_TRIGGER");
            voiceIntent.putExtra("command_hint", "previous");
            sendBroadcast(voiceIntent);
        }
    }
    
    private boolean requestAudioFocus() {
        if (audioFocusRequested) return true;
        
        int result;
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
            
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(playbackAttributes)
                .setAcceptsDelayedFocusGain(true)
                .setOnAudioFocusChangeListener(focusChangeListener)
                .build();
                
            result = audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            result = audioManager.requestAudioFocus(
                focusChangeListener,
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            );
        }
        
        audioFocusRequested = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
        Log.d(TAG, "Audio focus requested: " + audioFocusRequested);
        return audioFocusRequested;
    }
    
    private void abandonAudioFocus() {
        if (!audioFocusRequested) return;
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
        } else {
            audioManager.abandonAudioFocus(focusChangeListener);
        }
        
        audioFocusRequested = false;
        Log.d(TAG, "Audio focus abandoned");
    }
    
    private AudioManager.OnAudioFocusChangeListener focusChangeListener = new AudioManager.OnAudioFocusChangeListener() {
        @Override
        public void onAudioFocusChange(int focusChange) {
            switch (focusChange) {
                case AudioManager.AUDIOFOCUS_GAIN:
                    Log.d(TAG, "Audio focus gained");
                    mediaSession.setActive(true);
                    break;
                case AudioManager.AUDIOFOCUS_LOSS:
                    Log.d(TAG, "Audio focus lost");
                    mediaSession.getController().getTransportControls().stop();
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                    Log.d(TAG, "Audio focus lost transient");
                    mediaSession.getController().getTransportControls().pause();
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                    Log.d(TAG, "Audio focus lost transient can duck");
                    // Lower volume but continue
                    break;
            }
        }
    };
    
    private MediaMetadataCompat getMediaMetadata() {
        return new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, "CarBot AI Assistant")
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "AI Voice Assistant")
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Android Auto")
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1) // Unknown duration
            .build();
    }
    
    public MediaSessionCompat getMediaSession() {
        return mediaSession;
    }
}