import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { IDriveService, DriveUploadResult } from './drive.interface';

@Injectable()
export class DriveCloudinaryService implements IDriveService, OnModuleInit {
  private readonly logger = new Logger(DriveCloudinaryService.name);
  private ready = false;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    if (this.config.get('DRIVE_PROVIDER', 'mock') !== 'cloudinary') return;

    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.warn(
        'Cloudinary not fully configured — CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET required.',
      );
      return;
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    this.ready = true;
    this.logger.log(`DriveCloudinaryService ready → cloud: ${cloudName}`);
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folderPath: string,
  ): Promise<DriveUploadResult> {
    if (!this.ready) throw new Error('Cloudinary is not configured. Set DRIVE_PROVIDER=cloudinary and supply credentials.');

    const resourceType = mimeType.startsWith('video/') ? 'video'
      : mimeType.startsWith('image/') ? 'image'
      : 'raw';

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: folderPath || 'trendy-interiors',
            resource_type: resourceType,
            use_filename: false,
            unique_filename: true,
            overwrite: false,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result!);
          },
        )
        .end(buffer);
    });

    this.logger.log(`Uploaded ${fileName} → ${result.secure_url}`);

    return {
      fileId: result.public_id,
      webViewLink: result.secure_url,
      mimeType,
      fileName,
      fileSize: result.bytes,
    };
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!this.ready) return;
    await cloudinary.uploader.destroy(fileId, { invalidate: true });
    this.logger.log(`Deleted Cloudinary file ${fileId}`);
  }
}
