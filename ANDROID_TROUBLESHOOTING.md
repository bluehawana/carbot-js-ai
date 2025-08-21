# CarBot Android Auto Troubleshooting Guide

## Quick Fixes Applied

### ✅ Issues Fixed:

1. **Network Security Configuration** - Added HTTP cleartext support for local development
2. **Dynamic Server Detection** - App now automatically detects emulator vs device
3. **Connection Testing** - App tests backend connection before attempting requests
4. **Better Error Handling** - Comprehensive error messages with specific failure reasons
5. **Improved UI Feedback** - Clear status indicators and connection state display
6. **Enhanced Logging** - Detailed logs for debugging connection issues

---

## Testing Your Fixes

### Step 1: Start Backend Server
```bash
# In your project root
npm start
```
Should show: "CarBot API server running on port 3000"

### Step 2: Test Connection
```bash
# Run the connection test script
./test-android-connection.sh
```

### Step 3: Build & Install Android App
```bash
# Build the app
cd android
./gradlew assembleDebug

# Install on connected device/emulator  
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Step 4: Monitor Logs
```bash
# Watch Android logs in real-time
adb logcat | grep -E "(CarBot|VoiceScreen|CarBotApiClient)"
```

---

## Connection Configuration

### For Android Emulator:
- **URL**: `http://10.0.2.2:3000` (automatically detected)
- **Network**: Emulator's special IP for host machine

### For Physical Device:
- **URL**: `http://172.20.10.3:3000` (or your computer's actual IP)
- **Network**: Device and computer must be on same WiFi network

---

## Debugging Steps

### 1. Backend Connection Issues

**Check if server is running:**
```bash
curl http://localhost:3000/health
# Should return: {"status":"healthy","timestamp":"..."}
```

**Test API endpoints:**
```bash
# Test wake word
curl -X POST -H "Content-Type: application/json" -d '{}' http://localhost:3000/api/wake-word

# Test voice command
curl -X POST -H "Content-Type: application/json" -d '{"command":"hello"}' http://localhost:3000/api/voice-command
```

### 2. Android App Issues

**Check app logs:**
```bash
adb logcat | grep CarBotApiClient
```

**Look for these log messages:**
- ✅ `CarBotApiClient initialized with base URL: http://...`
- ✅ `Health check successful: ...`
- ❌ `Health check failed for http://...`
- ❌ `Request failed: HTTP 404: ...`

**Connection test in app:**
- App shows "🔄 Connecting to CarBot..." on startup
- Success: "✅ CarBot: Hello! I'm ready to help..."  
- Failure: "❌ Cannot connect to CarBot server"

### 3. Network Issues

**For emulator connection problems:**
- Ensure emulator is running
- Test: `curl http://10.0.2.2:3000/health`
- Check that backend is bound to all interfaces (0.0.0.0:3000, not just localhost)

**For physical device problems:**
- Find your computer's IP: `ifconfig | grep "inet "`
- Update `DEVICE_URL` in `CarBotApiClient.java` if needed
- Check firewall settings (allow port 3000)
- Ensure device and computer on same network

---

## Android Auto Specific Issues

### 1. App Not Appearing in Android Auto

**Check AndroidManifest.xml:**
```xml
<!-- Ensure these permissions exist -->
<uses-permission android:name="com.google.android.gms.permission.CAR_APPLICATION" />

<!-- Ensure car service is declared -->
<service android:name=".car.AiCarBotService" android:exported="true">
    <intent-filter>
        <action android:name="androidx.car.app.CarAppService" />
    </intent-filter>
</service>

<!-- Ensure metadata exists -->
<meta-data 
    android:name="com.google.android.gms.car.application"
    android:resource="@xml/automotive_app_desc" />
```

### 2. Voice Commands Not Working

**Check in app:**
1. Tap voice button - should show "🎤 Listening..."
2. Check if connection status shows "✅ Connected"
3. Look for error messages in UI

**Check logs:**
```bash
adb logcat | grep -E "(VoiceScreen|voice command)"
```

### 3. No Response from Backend

**Verify backend is processing requests:**
```bash
# Check server logs when making requests
npm start
# Should show request logs when Android app makes calls
```

**Common backend issues:**
- CORS settings blocking Android requests
- Server not accepting connections from device IP
- Missing API endpoints

---

## Error Messages & Solutions

### ❌ "Cannot connect to CarBot server"
**Cause**: Backend not reachable
**Solutions**: 
1. Start backend: `npm start`
2. Check IP configuration in app
3. Test with: `curl http://[SERVER_IP]:3000/health`

### ❌ "HTTP 404: Cannot GET /api/..."
**Cause**: Wrong API endpoint or server not fully initialized
**Solution**: Check server logs, ensure all routes are registered

### ❌ "Connection failed: java.net.ConnectException"
**Cause**: Network connectivity issue
**Solutions**:
1. Check device and computer are on same network
2. Update server IP in `CarBotApiClient.java`
3. Check firewall settings

### ❌ "Voice command failed: Server not available"  
**Cause**: Lost connection to backend during operation
**Solution**: Tap "Retry Connection" button in app

### ❌ "cleartext HTTP traffic not permitted"
**Cause**: Android 9+ blocks HTTP by default
**Solution**: ✅ Fixed with network security config

---

## Advanced Debugging

### Enable Verbose Logging
In `CarBotApiClient.java`, all requests now log:
```
D/CarBotApiClient: Making request to: http://10.0.2.2:3000/api/wake-word
D/CarBotApiClient: Response code: 200
D/CarBotApiClient: Response body: {"success":true,"message":"Wake word triggered successfully","timestamp":"2024-01-01T12:00:00.000Z"}
```

### Network Trace
```bash
# Monitor all network traffic to/from Android device
adb shell tcpdump -i any host 10.0.2.2
```

### Backend Debug Mode
```bash
# Start backend with debug logging
DEBUG=* npm start
```

---

## Testing Checklist

- [ ] Backend server running on port 3000
- [ ] Can curl backend endpoints successfully
- [ ] Android device/emulator connected via adb
- [ ] App builds without errors: `./gradlew assembleDebug`
- [ ] App installs successfully: `adb install ...`
- [ ] App shows connection status on startup
- [ ] Voice button works (enabled when connected)
- [ ] Voice commands get responses
- [ ] Error messages are helpful and specific
- [ ] Connection retry works when backend restarts

---

## Get Help

If you still have issues:

1. Run the diagnostic script: `./test-android-connection.sh`
2. Collect Android logs: `adb logcat > android-logs.txt`
3. Check backend server logs
4. Verify network configuration matches your setup

The fixes implemented should resolve the main connection and interaction issues. The app now provides clear feedback about its connection status and gives specific error messages to help diagnose any remaining problems.