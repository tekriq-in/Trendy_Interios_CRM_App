import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIVE_SERVICE } from './drive.interface';
import { DriveMockService } from './drive-mock.service';

@Module({
  providers: [
    {
      provide: DRIVE_SERVICE,
      useFactory: (config: ConfigService) => {
        const provider = config.get('DRIVE_PROVIDER', 'mock');
        if (provider === 'google') {
          // Real Google Drive service would be injected here
          throw new Error('Google Drive provider not yet implemented — set DRIVE_PROVIDER=mock');
        }
        return new DriveMockService();
      },
      inject: [ConfigService],
    },
  ],
  exports: [DRIVE_SERVICE],
})
export class DriveModule {}
