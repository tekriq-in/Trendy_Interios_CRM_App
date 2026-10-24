import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import { IDriveService, DriveUploadResult } from './drive.interface';

@Injectable()
export class DriveGCSService implements IDriveService, OnModuleInit {
  private storage: Storage;
  private bucketName: string;
  private readonly logger = new Logger(DriveGCSService.name);

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    if (this.config.get('DRIVE_PROVIDER', 'mock') !== 'google') return;

    const raw = this.config.get<string>('GOOGLE_DRIVE_SERVICE_ACCOUNT');
    if (!raw) throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT is required when DRIVE_PROVIDER=google');

    this.bucketName = this.config.get<string>('GOOGLE_DRIVE_BUCKET_NAME', '');
    if (!this.bucketName) throw new Error('GOOGLE_DRIVE_BUCKET_NAME is required when DRIVE_PROVIDER=google');

    const credentials = JSON.parse(raw);
    this.storage = new Storage({ credentials });
    this.logger.log(`DriveGCSService initialized → bucket: ${this.bucketName}`);

    // Auto-create the bucket if it doesn't exist (non-fatal — fails gracefully if billing disabled)
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [exists] = await bucket.exists();
      if (!exists) {
        await bucket.create({ location: 'asia-south1' });
        await bucket.makePublic();
        this.logger.log(`Created GCS bucket: ${this.bucketName}`);
      }
    } catch (err) {
      this.logger.warn(
        `GCS bucket check failed (billing may be disabled): ${(err as Error).message}. ` +
        `Uploads will fail until billing is enabled on the GCP project.`,
      );
      // Don't rethrow — app starts, uploads will fail gracefully
    }
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folderPath: string,
  ): Promise<DriveUploadResult> {
    if (!this.storage) throw new Error('DriveGCSService not initialized');

    const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
    const fileId = randomUUID();
    const destPath = folderPath
      ? `${folderPath}/${fileId}${ext ? '.' + ext : ''}`
      : `${fileId}${ext ? '.' + ext : ''}`;

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(destPath);

    await file.save(buffer, {
      metadata: { contentType: mimeType, metadata: { originalName: fileName } },
      public: true,
    });

    const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${destPath}`;
    this.logger.log(`Uploaded ${fileName} → gs://${this.bucketName}/${destPath}`);

    return {
      fileId: destPath,
      webViewLink: publicUrl,
      mimeType,
      fileName,
      fileSize: buffer.length,
    };
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!this.storage) return;
    await this.storage.bucket(this.bucketName).file(fileId).delete({ ignoreNotFound: true });
    this.logger.log(`Deleted GCS file ${fileId}`);
  }
}
