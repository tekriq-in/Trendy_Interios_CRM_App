import { Body, Controller, Delete, Get, Param, Patch, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@ti/shared';
import { PurchaseItemsService } from './purchase-items.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AddPurchaseItemDto,
  UpdatePurchaseItemDetailsDto,
  UpdatePurchaseItemProgressDto,
} from './dto/purchase-item.dto';

type Actor = { _id: string; rolePermissions: string[] };

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchaseItemsController {
  constructor(private service: PurchaseItemsService) {}

  /** Anyone who can see the project can see its purchase list. */
  @Get('projects/:projectId/purchase-items')
  @RequirePermissions(PERMISSIONS.PROJECTS_READ_OWN)
  findByProject(@Param('projectId') projectId: string, @CurrentUser() actor: Actor) {
    return this.service.findByProject(projectId, actor);
  }

  @Get('projects/:projectId/purchase-items/pdf')
  @RequirePermissions(PERMISSIONS.PROJECTS_READ_OWN)
  async exportPdf(@Param('projectId') projectId: string, @CurrentUser() actor: Actor) {
    const { buffer, fileName } = await this.service.exportPdf(projectId, actor);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  /** Design: add an item, or add quantity to an identical existing row. */
  @Post('projects/:projectId/purchase-items')
  @RequirePermissions(PERMISSIONS.PURCHASE_ITEMS_ADD)
  add(@Param('projectId') projectId: string, @Body() dto: AddPurchaseItemDto, @CurrentUser() actor: Actor) {
    return this.service.add(projectId, dto, actor);
  }

  /** Design: correct details / order qty. */
  @Patch('purchase-items/:id')
  @RequirePermissions(PERMISSIONS.PURCHASE_ITEMS_ADD)
  updateDetails(@Param('id') id: string, @Body() dto: UpdatePurchaseItemDetailsDto, @CurrentUser() actor: Actor) {
    return this.service.updateDetails(id, dto, actor);
  }

  /** Purchase: mark ordered / record received qty (manual). */
  @Patch('purchase-items/:id/progress')
  @RequirePermissions(PERMISSIONS.PURCHASE_ITEMS_MANAGE)
  updateProgress(@Param('id') id: string, @Body() dto: UpdatePurchaseItemProgressDto, @CurrentUser() actor: Actor) {
    return this.service.updateProgress(id, dto, actor);
  }

  @Delete('purchase-items/:id')
  @RequirePermissions(PERMISSIONS.PURCHASE_ITEMS_ADD)
  remove(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.service.remove(id, actor);
  }
}
