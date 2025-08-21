package com.aicarbot.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.annotation.RequiresApi;
import androidx.core.app.NotificationCompat;
import androidx.media.session.MediaButtonReceiver;

public class MediaNotificationManager {
    public static final int NOTIFICATION_ID = 412;
    private static final String CHANNEL_ID = "com.aicarbot.app.MUSIC";
    private static final int REQUEST_CODE = 100;

    private final MediaSessionService service;
    private final NotificationManager notificationManager;

    private final NotificationCompat.Action playAction;
    private final NotificationCompat.Action pauseAction;
    private final NotificationCompat.Action nextAction;
    private final NotificationCompat.Action prevAction;

    public MediaNotificationManager(MediaSessionService service) {
        this.service = service;
        notificationManager = (NotificationManager) service.getSystemService(Context.NOTIFICATION_SERVICE);

        // Initialize actions after service is set
        playAction = new NotificationCompat.Action(
            R.drawable.ic_play_arrow,
            "Play",
            MediaButtonReceiver.buildMediaButtonPendingIntent(service, PlaybackStateCompat.ACTION_PLAY)
        );

        pauseAction = new NotificationCompat.Action(
            R.drawable.ic_pause,
            "Pause", 
            MediaButtonReceiver.buildMediaButtonPendingIntent(service, PlaybackStateCompat.ACTION_PAUSE)
        );

        nextAction = new NotificationCompat.Action(
            R.drawable.ic_skip_next,
            "Next",
            MediaButtonReceiver.buildMediaButtonPendingIntent(service, PlaybackStateCompat.ACTION_SKIP_TO_NEXT)
        );

        prevAction = new NotificationCompat.Action(
            R.drawable.ic_skip_previous,
            "Previous",
            MediaButtonReceiver.buildMediaButtonPendingIntent(service, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)
        );

        // Cancel all notifications to handle the case where the Service was killed and restarted by the system.
        notificationManager.cancelAll();
    }

    public NotificationManager getNotificationManager() {
        return notificationManager;
    }

    public Notification getNotification(MediaMetadataCompat metadata, PlaybackStateCompat playbackState, MediaSessionCompat.Token token) {
        boolean isPlaying = playbackState.getState() == PlaybackStateCompat.STATE_PLAYING;
        MediaDescriptionCompat description = metadata.getDescription();
        NotificationCompat.Builder builder = buildNotification(playbackState, token, isPlaying, description);
        return builder.build();
    }

    private NotificationCompat.Builder buildNotification(PlaybackStateCompat playbackState,
                                                         MediaSessionCompat.Token token,
                                                         boolean isPlaying,
                                                         MediaDescriptionCompat description) {

        // Create the (mandatory) notification channel when running on Android Oreo.
        if (isAndroidOOrHigher()) {
            createChannel();
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(service, CHANNEL_ID);
        builder.setStyle(
            new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(token)
                .setShowActionsInCompactView(0, 1, 2)
                .setShowCancelButton(true)
                .setCancelButtonIntent(
                    MediaButtonReceiver.buildMediaButtonPendingIntent(
                        service, PlaybackStateCompat.ACTION_STOP)))
            .setColor(service.getResources().getColor(R.color.notification_color))
            .setSmallIcon(R.drawable.ic_notification)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setContentIntent(createContentIntent())
            .setContentTitle(description.getTitle())
            .setContentText(description.getSubtitle())
            .setLargeIcon(description.getIconBitmap());

        // If skip to next action is enabled
        if ((playbackState.getActions() & PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS) != 0) {
            builder.addAction(prevAction);
        }

        builder.addAction(isPlaying ? pauseAction : playAction);

        // If skip to prev action is enabled
        if ((playbackState.getActions() & PlaybackStateCompat.ACTION_SKIP_TO_NEXT) != 0) {
            builder.addAction(nextAction);
        }

        return builder;
    }

    // Does nothing on versions of Android earlier than O.
    @RequiresApi(Build.VERSION_CODES.O)
    private void createChannel() {
        if (notificationManager.getNotificationChannel(CHANNEL_ID) == null) {
            // The user-visible name of the channel.
            CharSequence name = "CarBot AI Assistant";
            // The user-visible description of the channel.
            String description = "Voice commands and AI interactions";
            int importance = NotificationManager.IMPORTANCE_LOW;
            NotificationChannel mChannel = new NotificationChannel(CHANNEL_ID, name, importance);
            // Configure the notification channel.
            mChannel.setDescription(description);
            mChannel.setShowBadge(false);
            mChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            notificationManager.createNotificationChannel(mChannel);
        }
    }

    private boolean isAndroidOOrHigher() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O;
    }

    private PendingIntent createContentIntent() {
        Intent openUI = new Intent(service, MainActivity.class);
        openUI.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            service, REQUEST_CODE, openUI, PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}