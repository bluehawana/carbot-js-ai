package com.carbot.android

import android.Manifest
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.session.MediaControllerCompat
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Minimal MainActivity for CarBot
 * Starts service and handles permissions
 * Real interaction happens through CarBotService popups
 */
class MainActivity : AppCompatActivity() {
    
    private lateinit var mediaBrowser: MediaBrowserCompat
    private var mediaController: MediaControllerCompat? = null
    
    private val connectionCallbacks = object : MediaBrowserCompat.ConnectionCallback() {
        override fun onConnected() {
            val token = mediaBrowser.sessionToken
            mediaController = MediaControllerCompat(this@MainActivity, token)
            MediaControllerCompat.setMediaController(this@MainActivity, mediaController)
            
            Toast.makeText(
                this@MainActivity, 
                "CarBot connected - Say \"Hello My Car\"", 
                Toast.LENGTH_SHORT
            ).show()
        }
        
        override fun onConnectionFailed() {
            Toast.makeText(
                this@MainActivity, 
                "CarBot connection failed", 
                Toast.LENGTH_SHORT
            ).show()
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Request necessary permissions
        requestPermissions()
        
        // Initialize MediaBrowser to connect to CarBotService
        mediaBrowser = MediaBrowserCompat(
            this,
            ComponentName(this, CarBotService::class.java),
            connectionCallbacks,
            null
        )
        
        // Start CarBot service
        val serviceIntent = Intent(this, CarBotService::class.java)
        startForegroundService(serviceIntent)
        
        // Finish activity - everything happens through service popups
        finish()
    }
    
    private fun requestPermissions() {
        val permissions = arrayOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.INTERNET,
            Manifest.permission.FOREGROUND_SERVICE
        )
        
        val permissionsToRequest = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        
        if (permissionsToRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                permissionsToRequest.toTypedArray(),
                REQUEST_PERMISSIONS
            )
        }
    }
    
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        if (requestCode == REQUEST_PERMISSIONS) {
            val allGranted = grantResults.all { it == PackageManager.PERMISSION_GRANTED }
            
            if (!allGranted) {
                Toast.makeText(
                    this,
                    "Permissions required for voice assistant",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }
    
    override fun onStart() {
        super.onStart()
        mediaBrowser.connect()
    }
    
    override fun onStop() {
        super.onStop()
        mediaBrowser.disconnect()
    }
    
    companion object {
        private const val REQUEST_PERMISSIONS = 1001
    }
}