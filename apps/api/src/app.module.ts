import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { HandoversModule } from './modules/handovers/handovers.module';
import { PurchaseItemsModule } from './modules/purchase-items/purchase-items.module';
import { BlockersModule } from './modules/blockers/blockers.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { DriveModule } from './modules/drive/drive.module';
import { SlaModule } from './modules/sla/sla.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SeedModule } from './modules/seed/seed.module';
import { MessagesModule } from './modules/messages/messages.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    RolesModule,
    DepartmentsModule,
    ClientsModule,
    ProjectsModule,
    TasksModule,
    HandoversModule,
    PurchaseItemsModule,
    BlockersModule,
    ApprovalsModule,
    PaymentsModule,
    DocumentsModule,
    DriveModule,
    SlaModule,
    ActivityLogModule,
    DashboardModule,
    SeedModule,
    MessagesModule,
    NotificationsModule,
    WhatsAppModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
