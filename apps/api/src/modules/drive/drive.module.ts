import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DRIVE_SERVICE } from './drive.interface';
import { DriveMockService } from './drive-mock.service';
import { DriveGCSService } from './drive-gcs.service';
import { DriveCloudinaryService } from './drive-cloudinary.service';

@Module({
  imports: [ConfigModule],
  providers: [
    DriveGCSService,
    DriveCloudinaryService,
    {
      provide: DRIVE_SERVICE,
      useFactory: (
        config: ConfigService,
        gcsService: DriveGCSService,
        cloudinaryService: DriveCloudinaryService,
      ) => {
        const provider = config.get('DRIVE_PROVIDER', 'mock');
        if (provider === 'cloudinary') return cloudinaryService;
        if (provider === 'google') return gcsService;
        return new DriveMockService();
      },
      inject: [ConfigService, DriveGCSService, DriveCloudinaryService],
    },
  ],
  exports: [DRIVE_SERVICE],
})
export class DriveModule {}
