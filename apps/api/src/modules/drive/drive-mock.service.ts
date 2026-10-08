import { Injectable, Logger } from '@nestjs/common';
import { IDriveService, DriveUploadResult } from './drive.interface';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const MOCK_DIR = '/tmp/drive-mock';

@Injectable()
export class DriveMockService implements IDriveService {
  private logger = new Logger('DriveMockService');

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folderPath: string,
  ): Promise<DriveUploadResult> {
    const fileId = randomUUID();
    const dir = path.join(MOCK_DIR, folderPath);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${fileId}_${fileName}`), buffer);

    this.logger.log(`[MOCK] Uploaded ${fileName} → ${folderPath}/${fileId}`);

    return {
      fileId,
      webViewLink: `http://localhost:3001/mock-drive/${fileId}`,
      mimeType,
      fileName,
      fileSize: buffer.length,
    };
  }

  async deleteFile(fileId: string): Promise<void> {
    this.logger.log(`[MOCK] Deleted file ${fileId}`);
  }
}
