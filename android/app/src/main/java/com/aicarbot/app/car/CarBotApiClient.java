package com.aicarbot.app.car;

import android.util.Log;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

public class CarBotApiClient {
    private static final String TAG = "CarBotApiClient";
    private static final String BASE_URL = "http://10.0.2.2:3000"; // Node.js server (Android emulator host)
    private final Executor executor = Executors.newFixedThreadPool(4);
    
    public interface ApiCallback<T> {
        void onSuccess(T result);
        void onError(Exception error);
    }
    
    public CompletableFuture<String> sendVoiceCommand(String command) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                JSONObject json = new JSONObject();
                json.put("command", command);
                json.put("type", "voice");
                
                return makeRequest("/api/voice", json.toString());
            } catch (Exception e) {
                Log.e(TAG, "Error sending voice command", e);
                throw new RuntimeException(e);
            }
        }, executor);
    }
    
    public CompletableFuture<String> getCarStatus() {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return makeRequest("/api/car/status", null);
            } catch (Exception e) {
                Log.e(TAG, "Error getting car status", e);
                throw new RuntimeException(e);
            }
        }, executor);
    }
    
    public CompletableFuture<String> sendCarAction(String action, JSONObject params) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                JSONObject json = new JSONObject();
                json.put("action", action);
                json.put("params", params);
                
                return makeRequest("/api/car/action", json.toString());
            } catch (Exception e) {
                Log.e(TAG, "Error sending car action", e);
                throw new RuntimeException(e);
            }
        }, executor);
    }
    
    public CompletableFuture<String> getNavigation(String destination) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                JSONObject json = new JSONObject();
                json.put("destination", destination);
                
                return makeRequest("/api/navigation", json.toString());
            } catch (Exception e) {
                Log.e(TAG, "Error getting navigation", e);
                throw new RuntimeException(e);
            }
        }, executor);
    }
    
    private String makeRequest(String endpoint, String jsonBody) throws IOException {
        URL url = new URL(BASE_URL + endpoint);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        
        try {
            connection.setRequestMethod(jsonBody == null ? "GET" : "POST");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/json");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(10000);
            
            if (jsonBody != null) {
                connection.setDoOutput(true);
                try (OutputStream os = connection.getOutputStream()) {
                    byte[] input = jsonBody.getBytes("utf-8");
                    os.write(input, 0, input.length);
                }
            }
            
            int responseCode = connection.getResponseCode();
            BufferedReader reader = new BufferedReader(new InputStreamReader(
                responseCode >= 200 && responseCode < 300 ? 
                connection.getInputStream() : connection.getErrorStream()
            ));
            
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            reader.close();
            
            if (responseCode >= 200 && responseCode < 300) {
                return response.toString();
            } else {
                throw new IOException("HTTP " + responseCode + ": " + response.toString());
            }
            
        } finally {
            connection.disconnect();
        }
    }
}