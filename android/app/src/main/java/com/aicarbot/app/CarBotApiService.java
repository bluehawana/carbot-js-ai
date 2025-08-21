package com.aicarbot.app;

import android.util.Log;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import okhttp3.*;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

public class CarBotApiService {
    private static final String TAG = "CarBotApiService";
    
    // Backend server configuration
    private static final String BASE_URL = "http://localhost:3000";
    private static final String DEVICE_URL = "http://10.0.2.2:3000"; // Android emulator
    private static final String LOCAL_URL = "http://192.168.1.125:3000"; // Your Mac's IP
    
    private final OkHttpClient client;
    private final Gson gson;
    private String serverUrl;
    
    public CarBotApiService() {
        this.client = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build();
        this.gson = new Gson();
        this.serverUrl = BASE_URL;
    }
    
    public interface ApiCallback {
        void onSuccess(String response);
        void onError(String error);
    }
    
    public void setServerUrl(String url) {
        this.serverUrl = url;
        Log.d(TAG, "Server URL set to: " + url);
    }
    
    public void sendVoiceCommand(String command, ApiCallback callback) {
        Log.d(TAG, "Sending voice command: " + command);
        
        // Create request body
        JsonObject requestBody = new JsonObject();
        requestBody.addProperty("command", command);
        requestBody.addProperty("timestamp", System.currentTimeMillis());
        requestBody.addProperty("source", "android_app");
        
        RequestBody body = RequestBody.create(
            requestBody.toString(),
            MediaType.parse("application/json")
        );
        
        // Try multiple server URLs
        tryMultipleUrls(new String[]{serverUrl, DEVICE_URL, LOCAL_URL}, 
            "/api/voice-command", body, callback);
    }
    
    public void triggerWakeWord(ApiCallback callback) {
        Log.d(TAG, "Triggering wake word");
        
        JsonObject requestBody = new JsonObject();
        requestBody.addProperty("source", "android_app");
        requestBody.addProperty("timestamp", System.currentTimeMillis());
        
        RequestBody body = RequestBody.create(
            requestBody.toString(),
            MediaType.parse("application/json")
        );
        
        tryMultipleUrls(new String[]{serverUrl, DEVICE_URL, LOCAL_URL}, 
            "/api/wake-word", body, callback);
    }
    
    public void checkHealth(ApiCallback callback) {
        Log.d(TAG, "Checking server health");
        
        tryMultipleUrls(new String[]{serverUrl, DEVICE_URL, LOCAL_URL}, 
            "/health", null, callback);
    }
    
    private void tryMultipleUrls(String[] urls, String endpoint, RequestBody body, ApiCallback callback) {
        tryUrl(urls, 0, endpoint, body, callback);
    }
    
    private void tryUrl(String[] urls, int index, String endpoint, RequestBody body, ApiCallback callback) {
        if (index >= urls.length) {
            callback.onError("All server URLs failed. Make sure the backend is running.");
            return;
        }
        
        String url = urls[index] + endpoint;
        Log.d(TAG, "Trying URL: " + url);
        
        Request.Builder requestBuilder = new Request.Builder().url(url);
        
        if (body != null) {
            requestBuilder.post(body);
        }
        
        Request request = requestBuilder.build();
        
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.w(TAG, "Request failed for " + url + ": " + e.getMessage());
                // Try next URL
                tryUrl(urls, index + 1, endpoint, body, callback);
            }
            
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (response.isSuccessful()) {
                    String responseBody = response.body().string();
                    Log.d(TAG, "Successful response from " + url + ": " + responseBody);
                    
                    // Update server URL for future requests
                    serverUrl = urls[index];
                    
                    callback.onSuccess(responseBody);
                } else {
                    Log.w(TAG, "Unsuccessful response from " + url + ": " + response.code());
                    // Try next URL
                    tryUrl(urls, index + 1, endpoint, body, callback);
                }
                response.close();
            }
        });
    }
    
    public static class VoiceResponse {
        public String response;
        public String type;
        public boolean success;
        public String error;
        
        public VoiceResponse() {}
        
        public VoiceResponse(String response, String type, boolean success) {
            this.response = response;
            this.type = type;
            this.success = success;
        }
    }
}