import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeedService } from './seed.service';
import { Department, DepartmentSchema } from '../departments/schemas/department.schema';
import { Role, RoleSchema } from '../roles/schemas/role.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { SlaSettings, SlaSettingsSchema } from '../sla/schemas/sla-settings.schema';
import { ChatGroupsModule } from '../chat-groups/chat-groups.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Department.name, schema: DepartmentSchema },
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
      { name: SlaSettings.name, schema: SlaSettingsSchema },
    ]),
    ChatGroupsModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}
