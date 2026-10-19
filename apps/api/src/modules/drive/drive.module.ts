import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DRIVE_SERVICE } from './drive.interface';
import { DriveMockService } from './drive-mock.service';
import { DriveGoogleService } from './drive-google.service';

@Module({
  imports: [ConfigModule],
  providers: [
    DriveGoogleService,
    {
      provide: DRIVE_SERVICE,
      useFactory: (config: ConfigService, googleService: DriveGoogleService) => {
        const provider = config.get('DRIVE_PROVIDER', 'mock');
        if (provider === 'google') {
          return googleService;
        }
        return new DriveMockService();
      },
      inject: [ConfigService, DriveGoogleService],
    },
  ],
  exports: [DRIVE_SERVICE],
})
export class DriveModule {}
