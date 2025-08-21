package com.aicarbot.app.config;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKeys;

import java.security.GeneralSecurityException;
import java.io.IOException;

/**
 * Secure configuration management for Picovoice API credentials
 * Handles encrypted storage and retrieval of access keys
 */
public class PicovoiceConfig {
    private static final String TAG = "PicovoiceConfig";
    private static final String PREF_FILENAME = "picovoice_secure_prefs";
    private static final String KEY_ACCESS_TOKEN = "picovoice_access_key";
    
    // Default demo access key (replace with your actual key)
    // Get your free access key from: https://console.picovoice.ai/
    private static final String DEFAULT_ACCESS_KEY = "YOUR_PICOVOICE_ACCESS_KEY_HERE";
    
    private Context context;
    private SharedPreferences securePrefs;

    public PicovoiceConfig(Context context) {
        this.context = context;
        initializeSecurePreferences();
    }

    private void initializeSecurePreferences() {
        try {
            String masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC);
            
            securePrefs = EncryptedSharedPreferences.create(
                PREF_FILENAME,
                masterKeyAlias,
                context,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
            
            Log.d(TAG, "Secure preferences initialized successfully");
            
        } catch (GeneralSecurityException | IOException e) {
            Log.e(TAG, "Failed to initialize secure preferences, falling back to regular SharedPreferences", e);
            // Fallback to regular SharedPreferences if encryption fails
            securePrefs = context.getSharedPreferences(PREF_FILENAME, Context.MODE_PRIVATE);
        }
    }

    /**
     * Get the Picovoice access key from secure storage
     * @return The access key, or default key if not configured
     */
    public String getAccessKey() {
        try {
            // First try to get from system properties (for development/testing)
            String systemKey = System.getProperty("picovoice.access.key");
            if (systemKey != null && !systemKey.isEmpty() && !systemKey.equals("YOUR_PICOVOICE_ACCESS_KEY_HERE")) {
                Log.d(TAG, "Using Picovoice access key from system properties");
                return systemKey;
            }
            
            // Then try to get from environment variables
            String envKey = System.getenv("PICOVOICE_ACCESS_KEY");
            if (envKey != null && !envKey.isEmpty()) {
                Log.d(TAG, "Using Picovoice access key from environment variable");
                return envKey;
            }
            
            // Finally, try to get from secure storage
            String storedKey = securePrefs.getString(KEY_ACCESS_TOKEN, DEFAULT_ACCESS_KEY);
            if (!storedKey.equals(DEFAULT_ACCESS_KEY)) {
                Log.d(TAG, "Using Picovoice access key from secure storage");
                return storedKey;
            }
            
            Log.w(TAG, "Using default Picovoice access key - please configure a valid key");
            return DEFAULT_ACCESS_KEY;
            
        } catch (Exception e) {
            Log.e(TAG, "Error retrieving Picovoice access key", e);
            return DEFAULT_ACCESS_KEY;
        }
    }

    /**
     * Store the Picovoice access key securely
     * @param accessKey The access key to store
     */
    public void setAccessKey(String accessKey) {
        try {
            securePrefs.edit()
                .putString(KEY_ACCESS_TOKEN, accessKey)
                .apply();
            
            Log.d(TAG, "Picovoice access key stored securely");
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to store Picovoice access key", e);
        }
    }

    /**
     * Check if a valid access key is configured
     * @return true if a valid key is available, false otherwise
     */
    public boolean isValidKeyConfigured() {
        String key = getAccessKey();
        return key != null && 
               !key.isEmpty() && 
               !key.equals(DEFAULT_ACCESS_KEY) && 
               key.length() > 20; // Picovoice keys are typically longer than 20 characters
    }

    /**
     * Clear stored access key (for logout/reset)
     */
    public void clearAccessKey() {
        try {
            securePrefs.edit()
                .remove(KEY_ACCESS_TOKEN)
                .apply();
            
            Log.d(TAG, "Picovoice access key cleared");
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to clear Picovoice access key", e);
        }
    }
}