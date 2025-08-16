package com.aicarbot.app;

import androidx.appcompat.app.AppCompatActivity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.widget.Toast;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Check if device supports Android Auto
        if (checkAndroidAutoSupport()) {
            // Show message and redirect to Android Auto
            Toast.makeText(this, "AI CarBot - Use with Android Auto", Toast.LENGTH_LONG).show();
            
            // Launch Android Auto if available
            try {
                Intent autoIntent = new Intent("com.google.android.projection.gearhead.ANDROID_AUTO_START");
                if (autoIntent.resolveActivity(getPackageManager()) != null) {
                    startActivity(autoIntent);
                } else {
                    // Android Auto not installed, show message
                    Toast.makeText(this, "Please connect to Android Auto to use AI CarBot", Toast.LENGTH_LONG).show();
                }
            } catch (Exception e) {
                Toast.makeText(this, "Use AI CarBot with Android Auto in your car", Toast.LENGTH_LONG).show();
            }
            
            // Close this activity since it's meant for Android Auto
            finish();
        } else {
            Toast.makeText(this, "This app is designed for Android Auto", Toast.LENGTH_LONG).show();
            finish();
        }
    }
    
    private boolean checkAndroidAutoSupport() {
        try {
            PackageManager pm = getPackageManager();
            // Check if Android Auto is available
            return pm.hasSystemFeature("android.hardware.type.automotive") || 
                   pm.getLaunchIntentForPackage("com.google.android.projection.gearhead") != null;
        } catch (Exception e) {
            return true; // Assume supported if can't check
        }
    }
}