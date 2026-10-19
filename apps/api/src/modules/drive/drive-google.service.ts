import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { IDriveService, DriveUploadResult } from './drive.interface';

@Injectable()
export class DriveGoogleService implements IDriveService, OnModuleInit {
  private drive: drive_v3.Drive;
  private rootFolderId: string;
  private readonly logger = new Logger(DriveGoogleService.name);
  private folderCache = new Map<string, string>();

  constructor(private config: ConfigService) {}

  onModuleInit() {
    if (this.config.get('DRIVE_PROVIDER', 'mock') !== 'google') return;

    const raw = this.config.get<string>('GOOGLE_DRIVE_SERVICE_ACCOUNT');
    if (!raw) throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT env var is required when DRIVE_PROVIDER=google');

    const credentials = JSON.parse(raw);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    this.drive = google.drive({ version: 'v3', auth });
    this.rootFolderId = this.config.get<string>('GOOGLE_DRIVE_FOLDER_ID', '');
    if (!this.rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID env var is required when DRIVE_PROVIDER=google');
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folderPath: string,
  ): Promise<DriveUploadResult> {
    if (!this.drive) throw new Error('DriveGoogleService not initialized — set DRIVE_PROVIDER=google and credentials');
    const folderId = await this.resolveFolder(folderPath);

    const response = await this.drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: 'id,webViewLink,name,size,mimeType',
    });

    const file = response.data;

    // Make the file readable by anyone with the link
    await this.drive.permissions.create({
      fileId: file.id!,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    this.logger.log(`Uploaded ${fileName} → Drive folder ${folderPath} (id: ${file.id})`);

    return {
      fileId: file.id!,
      webViewLink: file.webViewLink!,
      mimeType: file.mimeType ?? mimeType,
      fileName: file.name ?? fileName,
      fileSize: Number(file.size ?? buffer.length),
    };
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.drive.files.delete({ fileId });
    this.logger.log(`Deleted Drive file ${fileId}`);
  }

  // Resolves "projectId/photos" → Drive folder id, creating sub-folders as needed
  private async resolveFolder(folderPath: string): Promise<string> {
    if (!folderPath) return this.rootFolderId;

    const cacheKey = folderPath;
    if (this.folderCache.has(cacheKey)) return this.folderCache.get(cacheKey)!;

    const segments = folderPath.split('/').filter(Boolean);
    let parentId = this.rootFolderId;

    for (const segment of segments) {
      const key = `${parentId}/${segment}`;
      if (this.folderCache.has(key)) {
        parentId = this.folderCache.get(key)!;
        continue;
      }

      // Check if folder already exists
      const existing = await this.drive.files.list({
        q: `name='${segment}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
        fields: 'files(id)',
      });

      let folderId: string;
      if (existing.data.files?.length) {
        folderId = existing.data.files[0].id!;
      } else {
        const created = await this.drive.files.create({
          requestBody: {
            name: segment,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
          },
          fields: 'id',
        });
        folderId = created.data.id!;
      }

      this.folderCache.set(key, folderId);
      parentId = folderId;
    }

    this.folderCache.set(cacheKey, parentId);
    return parentId;
  }
}
