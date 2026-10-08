import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Department, DepartmentDocument } from '../departments/schemas/department.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { SlaSettings, SlaSettingsDocument } from '../sla/schemas/sla-settings.schema';
import { DEFAULT_DEPARTMENTS, DEFAULT_ROLE_PERMISSIONS } from '@ti/shared';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private logger = new Logger('SeedService');

  constructor(
    @InjectModel(Department.name) private deptModel: Model<DepartmentDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(SlaSettings.name) private slaModel: Model<SlaSettingsDocument>,
    private config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedDepartments();
    await this.seedRoles();
    await this.seedMdUser();
    this.logger.log('Seed complete');
  }

  private async seedDepartments() {
    for (const dept of DEFAULT_DEPARTMENTS) {
      const existing = await this.deptModel.findOne({ name: dept.name });
      if (!existing) {
        const created = await this.deptModel.create({
          name: dept.name,
          order: dept.order,
          defaultSlaHours: dept.defaultSlaHours,
          isActive: true,
        });
        await this.slaModel.updateOne(
          { department: created._id },
          { department: created._id, defaultHours: dept.defaultSlaHours },
          { upsert: true },
        );
        this.logger.log(`Seeded department: ${dept.name}`);
      }
    }
  }

  private async seedRoles() {
    const roleNames = Object.keys(DEFAULT_ROLE_PERMISSIONS);
    for (const name of roleNames) {
      const existing = await this.roleModel.findOne({ name });
      if (!existing) {
        await this.roleModel.create({
          name,
          permissions: DEFAULT_ROLE_PERMISSIONS[name],
          isSystem: true,
        });
        this.logger.log(`Seeded role: ${name}`);
      }
    }
  }

  private async seedMdUser() {
    const email = this.config.get('SEED_MD_EMAIL', 'admin@trendyinteriors.in');
    const password = this.config.get('SEED_MD_PASSWORD', 'ChangeMe123!');

    const existing = await this.userModel.findOne({ email });
    if (existing) return;

    const mdRole = await this.roleModel.findOne({ name: 'MD' });
    if (!mdRole) return;

    const passwordHash = await bcrypt.hash(password, 12);
    await this.userModel.create({
      name: 'MD Admin',
      email,
      passwordHash,
      role: mdRole._id,
      isActive: true,
      preferredLanguage: 'en',
    });

    this.logger.log(`Seeded MD user: ${email}`);
  }
}
