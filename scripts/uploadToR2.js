const { S3Client, PutObjectCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');
const fs = require('fs').promises;
const path = require('path');

class CloudFlareR2Uploader {
    constructor() {
        // CloudFlare R2 credentials - add these to your .env file
        this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        this.accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
        this.secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
        this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'carbot-models';
        
        if (!this.accountId || !this.accessKeyId || !this.secretAccessKey) {
            console.error('❌ CloudFlare R2 credentials not found in environment variables');
            console.log('Please add to your .env file:');
            console.log('CLOUDFLARE_ACCOUNT_ID=your_account_id');
            console.log('CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key');
            console.log('CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key');
            console.log('CLOUDFLARE_R2_BUCKET_NAME=carbot-models');
            return;
        }

        // Configure S3 client for CloudFlare R2
        this.s3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretAccessKey,
            },
        });
    }

    async createBucketIfNotExists() {
        try {
            console.log(`🪣 Creating bucket: ${this.bucketName}`);
            await this.s3Client.send(new CreateBucketCommand({ 
                Bucket: this.bucketName 
            }));
            console.log('✅ Bucket created successfully');
        } catch (error) {
            if (error.name === 'BucketAlreadyOwnedByYou' || error.name === 'BucketAlreadyExists') {
                console.log('✅ Bucket already exists');
            } else {
                console.error('❌ Error creating bucket:', error);
                throw error;
            }
        }
    }

    async uploadFile(localFilePath, s3Key) {
        try {
            console.log(`⬆️ Uploading ${localFilePath} to R2 as ${s3Key}`);
            
            const fileContent = await fs.readFile(localFilePath);
            const stats = await fs.stat(localFilePath);
            
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key,
                Body: fileContent,
                ContentLength: stats.size,
                ContentType: this.getContentType(localFilePath),
            });

            const result = await this.s3Client.send(command);
            console.log(`✅ Uploaded: ${s3Key} (${stats.size} bytes)`);
            return result;
            
        } catch (error) {
            console.error(`❌ Error uploading ${localFilePath}:`, error);
            throw error;
        }
    }

    async uploadDirectory(localDirPath, s3Prefix = '') {
        try {
            console.log(`📁 Uploading directory: ${localDirPath}`);
            
            const files = await this.getAllFiles(localDirPath);
            const uploadPromises = [];

            for (const filePath of files) {
                const relativePath = path.relative(localDirPath, filePath);
                const s3Key = s3Prefix ? `${s3Prefix}/${relativePath}` : relativePath;
                
                uploadPromises.push(this.uploadFile(filePath, s3Key));
            }

            await Promise.all(uploadPromises);
            console.log(`✅ Directory upload complete: ${files.length} files`);
            
        } catch (error) {
            console.error('❌ Error uploading directory:', error);
            throw error;
        }
    }

    async getAllFiles(dirPath) {
        const files = [];
        const items = await fs.readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            
            if (item.isDirectory()) {
                const subFiles = await this.getAllFiles(fullPath);
                files.push(...subFiles);
            } else {
                files.push(fullPath);
            }
        }

        return files;
    }

    getContentType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
            '.json': 'application/json',
            '.bin': 'application/octet-stream',
            '.mlmodelc': 'application/octet-stream',
            '.txt': 'text/plain',
            '.md': 'text/markdown',
        };
        return contentTypes[ext] || 'application/octet-stream';
    }

    getPublicUrl(s3Key) {
        return `https://${this.bucketName}.${this.accountId}.r2.cloudflarestorage.com/${s3Key}`;
    }
}

async function main() {
    try {
        const uploader = new CloudFlareR2Uploader();
        
        if (!uploader.s3Client) {
            console.error('❌ R2 client not initialized. Check your credentials.');
            process.exit(1);
        }

        // Create bucket if it doesn't exist
        await uploader.createBucketIfNotExists();

        // Upload Parakeet model
        const modelPath = path.join(__dirname, '../models/parakeet-tdt-0.6b-v2-coreml');
        await uploader.uploadDirectory(modelPath, 'parakeet-tdt-0.6b-v2-coreml');

        console.log('🎉 Upload complete!');
        console.log('Model URL:', uploader.getPublicUrl('parakeet-tdt-0.6b-v2-coreml/'));
        
    } catch (error) {
        console.error('❌ Upload failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = CloudFlareR2Uploader;