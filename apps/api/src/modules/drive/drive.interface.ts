export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
}

export interface IDriveService {
  uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folderPath: string,
  ): Promise<DriveUploadResult>;

  deleteFile(fileId: string): Promise<void>;
}

export const DRIVE_SERVICE = 'DRIVE_SERVICE';
