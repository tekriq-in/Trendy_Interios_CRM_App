import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '@ti/shared';

@Controller('approvals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApprovalsController {
  constructor(private service: ApprovalsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.APPROVALS_DECIDE)
  findAll() {
    return this.service.findAll();
  }

  @Post('generate-message')
  @RequirePermissions(PERMISSIONS.APPROVALS_REQUEST)
  generateMessage(
    @Body() dto: {
      rawNotes: string;
      clientName: string;
      projectTitle: string;
      updateKind: string;
      language?: 'en' | 'ta';
    },
  ) {
    return this.service.generateMessage(dto);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.APPROVALS_REQUEST)
  request(
    @Body() dto: {
      projectId: string;
      kind: string;
      rawNotes?: string;
      generatedMessage?: string;
      linkedDocumentId?: string;
    },
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.request(dto, actor);
  }

  @Patch(':id/approve')
  @RequirePermissions(PERMISSIONS.APPROVALS_DECIDE)
  approve(
    @Param('id') id: string,
    @Body() dto: { finalMessage?: string },
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.approve(id, dto, actor);
  }

  @Patch(':id/reject')
  @RequirePermissions(PERMISSIONS.APPROVALS_DECIDE)
  reject(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.reject(id, body.reason, actor);
  }
}
