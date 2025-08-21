# 🛡️ CarBot Security Implementation Guide

## Critical Security Fixes for Production

### 1. Environment Variable Security

Create a secure environment configuration:

```bash
# Generate secure random API keys
openssl rand -hex 32 > api_secret.key

# Use environment variable encryption
npm install dotenv-vault
```

### 2. Network Communication Security

#### HTTPS Implementation
```javascript
// src/api/googleAutoAPI.js
const https = require('https');
const fs = require('fs');

class SecureGoogleAutoAPI extends GoogleAutoAPI {
    constructor(carSystem, options = {}) {
        super(carSystem, options);
        
        // Force HTTPS in production
        if (process.env.NODE_ENV === 'production') {
            this.server = https.createServer({
                key: fs.readFileSync('path/to/private-key.pem'),
                cert: fs.readFileSync('path/to/certificate.pem')
            }, this.app);
        }
    }
    
    setupMiddleware() {
        super.setupMiddleware();
        
        // Enhanced security headers
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:"],
                    connectSrc: ["'self'", "wss:", "https:"],
                }
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        }));
        
        // Rate limiting
        const rateLimit = require('express-rate-limit');
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP'
        });
        this.app.use('/api/', limiter);
    }
}
```

#### API Authentication
```javascript
// src/middleware/auth.js
class APIAuthentication {
    constructor(secretKey) {
        this.secretKey = secretKey;
    }
    
    generateToken(clientId) {
        const jwt = require('jsonwebtoken');
        return jwt.sign({ clientId, timestamp: Date.now() }, this.secretKey, { expiresIn: '1h' });
    }
    
    validateToken(req, res, next) {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }
        
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, this.secretKey);
            req.clientId = decoded.clientId;
            next();
        } catch (error) {
            return res.status(401).json({ error: 'Invalid authentication token' });
        }
    }
}
```

### 3. Voice Data Encryption

#### Encrypted Audio Storage
```javascript
// src/audio/secureRecorder.js
const crypto = require('crypto');
const fs = require('fs');

class SecureAudioRecorder extends AudioRecorder {
    constructor(options = {}) {
        super(options);
        this.encryptionKey = process.env.AUDIO_ENCRYPTION_KEY || crypto.randomBytes(32);
    }
    
    encryptAudio(audioBuffer) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
        cipher.setAutoPadding(true);
        
        const encrypted = Buffer.concat([
            cipher.update(audioBuffer),
            cipher.final()
        ]);
        
        return Buffer.concat([iv, encrypted]);
    }
    
    decryptAudio(encryptedBuffer) {
        const iv = encryptedBuffer.slice(0, 16);
        const encrypted = encryptedBuffer.slice(16);
        
        const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
        decipher.setAutoPadding(true);
        
        return Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);
    }
    
    saveRecording(filename) {
        if (this.audioBuffer.length === 0) {
            console.log('No audio data to save');
            return;
        }

        const buffer = Buffer.concat(this.audioBuffer);
        const encryptedBuffer = this.encryptAudio(buffer);
        
        const filePath = path.join(__dirname, '../../recordings', filename + '.enc');
        
        // Ensure recordings directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, encryptedBuffer);
        console.log(`Encrypted recording saved to: ${filePath}`);
        
        return filePath;
    }
}
```

### 4. Wake Word Model Integrity

```javascript
// src/wakeword/secureDetector.js
const crypto = require('crypto');
const fs = require('fs');

class SecureWakeWordDetector extends WakeWordDetector {
    constructor(accessKey, sensitivity = 0.5) {
        super(accessKey, sensitivity);
        this.modelChecksum = null;
    }
    
    verifyModelIntegrity(modelPath) {
        const modelData = fs.readFileSync(modelPath);
        const hash = crypto.createHash('sha256').update(modelData).digest('hex');
        
        // Compare with known good checksum
        const expectedChecksum = process.env.WAKE_WORD_MODEL_CHECKSUM;
        if (expectedChecksum && hash !== expectedChecksum) {
            throw new Error('Wake word model integrity check failed');
        }
        
        this.modelChecksum = hash;
        console.log(`✅ Wake word model verified: ${hash.substring(0, 8)}...`);
        return true;
    }
    
    async initialize() {
        console.log('[SecureWakeWordDetector] Initializing with integrity checks...');
        
        const modelPath = path.join(__dirname, '../../models/Hello-My-Car_en_mac_v3_0_0.ppn');
        
        // Verify model integrity before loading
        if (fs.existsSync(modelPath)) {
            this.verifyModelIntegrity(modelPath);
        }
        
        return super.initialize();
    }
}
```

### 5. Android Security Hardening

#### Secure Network Configuration
```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Production: Only allow HTTPS -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">your-production-domain.com</domain>
    </domain-config>
    
    <!-- Development: Restricted cleartext for specific IPs only -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">localhost</domain>
        <domain includeSubdomains="false">127.0.0.1</domain>
        <!-- Remove broad IP ranges -->
    </domain-config>
    
    <!-- Certificate pinning for production -->
    <domain-config>
        <domain includeSubdomains="true">your-production-domain.com</domain>
        <pin-set expiration="2025-12-31">
            <pin digest="SHA-256">your-certificate-hash-here</pin>
        </pin-set>
    </domain-config>
</network-security-config>
```

#### Secure API Client
```java
// android/app/src/main/java/com/aicarbot/app/car/SecureCarBotApiClient.java
public class SecureCarBotApiClient extends CarBotApiClient {
    private static final String PRODUCTION_URL = "https://your-secure-domain.com";
    private String authToken;
    
    public SecureCarBotApiClient() {
        super();
        // Use HTTPS in production
        if (BuildConfig.DEBUG) {
            this.baseUrl = "http://10.0.2.2:3000"; // Development only
        } else {
            this.baseUrl = PRODUCTION_URL;
        }
    }
    
    public void setAuthToken(String token) {
        this.authToken = token;
    }
    
    private String makeSecureRequest(String endpoint, String jsonBody) throws IOException {
        URL url = new URL(baseUrl + endpoint);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        
        try {
            // Force HTTPS in production
            if (!BuildConfig.DEBUG && !url.getProtocol().equals("https")) {
                throw new SecurityException("HTTPS required in production");
            }
            
            connection.setRequestMethod(jsonBody == null ? "GET" : "POST");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", "CarBot-Android/1.0");
            
            // Add authentication header
            if (authToken != null) {
                connection.setRequestProperty("Authorization", "Bearer " + authToken);
            }
            
            // Security timeouts
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(10000);
            
            // Disable redirects for security
            connection.setInstanceFollowRedirects(false);
            
            if (jsonBody != null) {
                connection.setDoOutput(true);
                try (OutputStream os = connection.getOutputStream()) {
                    byte[] input = jsonBody.getBytes(StandardCharsets.UTF_8);
                    os.write(input);
                }
            }
            
            int responseCode = connection.getResponseCode();
            
            // Handle security-related response codes
            if (responseCode == 401) {
                throw new SecurityException("Authentication failed");
            } else if (responseCode == 403) {
                throw new SecurityException("Access denied");
            }
            
            // Rest of implementation...
            
        } finally {
            connection.disconnect();
        }
    }
}
```

### 6. Input Validation & Sanitization

```javascript
// src/middleware/validation.js
class InputValidator {
    static validateVoiceCommand(command) {
        if (!command || typeof command !== 'string') {
            throw new Error('Invalid command format');
        }
        
        // Sanitize input
        const sanitized = command.trim().substring(0, 500); // Limit length
        
        // Check for potentially malicious patterns
        const maliciousPatterns = [
            /<script/i,
            /javascript:/i,
            /data:text\/html/i,
            /eval\(/i,
            /function\(/i
        ];
        
        for (const pattern of maliciousPatterns) {
            if (pattern.test(sanitized)) {
                throw new Error('Invalid command content');
            }
        }
        
        return sanitized;
    }
    
    static validateApiRequest(req, res, next) {
        try {
            if (req.body.command) {
                req.body.command = this.validateVoiceCommand(req.body.command);
            }
            next();
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
```

## Production Security Checklist

### Pre-Deployment
- [ ] Revoke all exposed API keys
- [ ] Generate new secure API keys with proper scoping
- [ ] Implement HTTPS with valid SSL certificates
- [ ] Enable certificate pinning for Android app
- [ ] Implement API authentication and rate limiting
- [ ] Add input validation for all endpoints
- [ ] Encrypt all voice data storage
- [ ] Verify wake word model integrity
- [ ] Remove excessive Android permissions
- [ ] Implement secure logging (no sensitive data)
- [ ] Add security headers to all API responses
- [ ] Configure proper CORS settings
- [ ] Implement request signing for critical operations

### Monitoring & Maintenance
- [ ] Set up security monitoring and alerting
- [ ] Implement audit logging for all operations
- [ ] Regular security updates for dependencies
- [ ] Periodic penetration testing
- [ ] Monitor for API key usage anomalies
- [ ] Regular backup and recovery testing

### Compliance
- [ ] Implement data retention policies
- [ ] Add privacy policy and user consent mechanisms
- [ ] Ensure GDPR/CCPA compliance for voice data
- [ ] Document security procedures
- [ ] Regular security training for developers

## Emergency Security Response

If security breach is detected:
1. Immediately revoke all API keys
2. Disable affected services
3. Analyze breach scope and impact
4. Notify affected users (if applicable)
5. Implement additional security measures
6. Conduct post-incident review