package com.carbot.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Bundle
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.session.MediaSessionCompat
import androidx.media.MediaBrowserServiceCompat
import ai.picovoice.porcupine.PorcupineManager
import ai.picovoice.porcupine.PorcupineException
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONObject
import java.io.IOException

/**
 * CarBot Android Auto MediaBrowserService
 * Handles voice conversations with popup dialogs
 * 
 * Dialog Behavior:
 * - Bot speaks -> Popup appears with text
 * - Popup auto-disappears after speech ends
 * - User speaks -> STT text shown directly
 * - No web interface - Pure Android Auto integration
 */
class CarBotService : MediaBrowserServiceCompat() {
    
    private val CARBOT_API_BASE = "http://localhost:3000"
    private val NOTIFICATION_CHANNEL_ID = "carbot_service"
    private val NOTIFICATION_ID = 1
    
    private lateinit var mediaSession: MediaSessionCompat
    private lateinit var notificationManager: NotificationManager
    private var porcupineManager: PorcupineManager? = null
    private val httpClient = OkHttpClient()
    
    // Current conversation state
    private var isListening = false
    private var currentBotMessage = ""
    
    override fun onCreate() {
        super.onCreate()
        initializeMediaSession()
        createNotificationChannel()
        initializeWakeWordDetection()
        startForegroundService()
    }
    
    private fun initializeMediaSession() {
        mediaSession = MediaSessionCompat(this, "CarBotService")
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        )
        
        // Handle voice commands through media session
        mediaSession.setCallback(object : MediaSessionCompat.Callback() {
            override fun onCustomAction(action: String?, extras: Bundle?) {
                when (action) {
                    "voice_command" -> {
                        val command = extras?.getString("command") ?: return
                        handleVoiceCommand(command)
                    }
                    "show_stt_text" -> {
                        val sttText = extras?.getString("text") ?: return
                        showSTTText(sttText)
                    }
                }
            }
        })
        
        sessionToken = mediaSession.sessionToken
        mediaSession.isActive = true
    }
    
    private fun initializeWakeWordDetection() {
        try {
            porcupineManager = PorcupineManager.Builder()
                .setAccessKey(BuildConfig.PICOVOICE_ACCESS_KEY)
                .setKeywordPaths(listOf("Hello-My-Car_en_mac_v3_0_0.ppn"))
                .setSensitivity(0.5f)
                .build(this) { keywordIndex ->
                    onWakeWordDetected()
                }
            
            porcupineManager?.start()
        } catch (e: PorcupineException) {
            // Fallback to API-based wake word detection
            triggerWakeWordAPI()
        }
    }
    
    private fun onWakeWordDetected() {
        // Show popup with CarBot greeting
        showBotPopup("Hello master, what can I do for you today?")
        
        // Start listening for voice command
        isListening = true
        
        // Notify backend
        triggerWakeWordAPI()
    }
    
    private fun triggerWakeWordAPI() {
        val request = Request.Builder()
            .url("$CARBOT_API_BASE/api/wake-word")
            .post(RequestBody.create("application/json".toMediaType(), "{}"))
            .build()
            
        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                // Handle error silently
            }
            
            override fun onResponse(call: Call, response: Response) {
                // Wake word triggered successfully
            }
        })
    }
    
    private fun handleVoiceCommand(command: String) {
        // Show STT text immediately so user knows what bot received
        showSTTText(command)
        
        // Send to CarBot backend
        val json = JSONObject().apply {
            put("command", command)
        }
        
        val request = Request.Builder()
            .url("$CARBOT_API_BASE/api/voice-command")
            .post(RequestBody.create("application/json".toMediaType(), json.toString()))
            .build()
            
        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                showBotPopup("Sorry, I couldn't process that command.")
            }
            
            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string()
                if (response.isSuccessful && responseBody != null) {
                    val result = JSONObject(responseBody)
                    val botResponse = result.getString("response")
                    
                    // Show bot response in popup
                    showBotPopup(botResponse)
                } else {
                    showBotPopup("Sorry, I encountered an error.")
                }
            }
        })
    }
    
    /**
     * Show bot speech in a popup dialog
     * Popup appears when bot speaks, auto-disappears after speech ends
     */
    private fun showBotPopup(message: String) {
        currentBotMessage = message
        
        // Create Android Auto notification popup
        val notification = Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("🤖 CarBot")
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
            .setTimeoutAfter(5000) // Auto-disappear after 5 seconds
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setPriority(Notification.PRIORITY_HIGH)
            .build()
        
        notificationManager.notify(NOTIFICATION_ID + 1, notification)
        
        // Also update Android Auto display directly
        updateAndroidAutoDisplay("🤖 CarBot: $message")
        
        // Auto-hide popup after speech duration (estimated)
        val speechDuration = estimateSpeechDuration(message)
        android.os.Handler(mainLooper).postDelayed({
            hidePopup()
        }, speechDuration)
    }
    
    /**
     * Show STT text directly so user knows what bot received
     */
    private fun showSTTText(text: String) {
        // Show quick STT confirmation
        val notification = Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("🎤 You said:")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setAutoCancel(true)
            .setTimeoutAfter(2000) // Quick disappear
            .setCategory(Notification.CATEGORY_STATUS)
            .setPriority(Notification.PRIORITY_DEFAULT)
            .build()
        
        notificationManager.notify(NOTIFICATION_ID + 2, notification)
        
        // Update Android Auto display
        updateAndroidAutoDisplay("🎤 \"$text\"")
    }
    
    private fun updateAndroidAutoDisplay(message: String) {
        // Update media metadata to show conversation in Android Auto
        val metadata = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, "CarBot Conversation")
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, message)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, "CarBot")
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, message)
            .build()
        
        mediaSession.setMetadata(metadata)
    }
    
    private fun hidePopup() {
        // Cancel conversation notifications
        notificationManager.cancel(NOTIFICATION_ID + 1)
        notificationManager.cancel(NOTIFICATION_ID + 2)
        
        // Clear Android Auto display
        updateAndroidAutoDisplay("Ready - Say \"Hello My Car\"")
        isListening = false
    }
    
    private fun estimateSpeechDuration(text: String): Long {
        // Estimate speech duration at ~200 WPM (natural speed)
        val words = text.split(" ").size
        val durationMs = (words * 300).toLong() // 300ms per word
        return maxOf(2000, minOf(8000, durationMs)) // 2-8 seconds range
    }
    
    private fun createNotificationChannel() {
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        val channel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            "CarBot Voice Assistant",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "CarBot conversation notifications"
            setShowBadge(false)
        }
        
        notificationManager.createNotificationChannel(channel)
    }
    
    private fun startForegroundService() {
        val notification = Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("CarBot Voice Assistant")
            .setContentText("Ready - Say \"Hello My Car\"")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()
        
        startForeground(NOTIFICATION_ID, notification)
    }
    
    override fun onGetRoot(
        clientPackageName: String,
        clientUid: Int,
        rootHints: Bundle?
    ): BrowserRoot? {
        // Allow Android Auto to connect
        return BrowserRoot("carbot_root", null)
    }
    
    override fun onLoadChildren(
        parentId: String,
        result: Result<MutableList<MediaBrowserCompat.MediaItem>>
    ) {
        val mediaItems = mutableListOf<MediaBrowserCompat.MediaItem>()
        
        // Create conversation item for Android Auto
        val conversationItem = MediaBrowserCompat.MediaItem(
            MediaDescriptionCompat.Builder()
                .setMediaId("conversation")
                .setTitle("CarBot Conversation")
                .setSubtitle("Voice Assistant Ready")
                .build(),
            MediaBrowserCompat.MediaItem.FLAG_PLAYABLE
        )
        
        mediaItems.add(conversationItem)
        result.sendResult(mediaItems)
    }
    
    override fun onDestroy() {
        super.onDestroy()
        porcupineManager?.delete()
        mediaSession.release()
    }
}