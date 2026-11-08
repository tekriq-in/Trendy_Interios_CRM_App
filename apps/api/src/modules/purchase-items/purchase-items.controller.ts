import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { PurchaseItemsService } from './purchase-items.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '@ti/shared';
import { UpdatePurchaseItemDto } from './dto/update-purchase-item.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.PURCHASE_ITEMS_MANAGE)
export class PurchaseItemsController {
  constructor(private service: PurchaseItemsService) {}

  @Get('projects/:projectId/purchase-items')
  findByProject(@Param('projectId') projectId: string) {
    return this.service.findByProject(projectId);
  }

  @Post('projects/:projectId/purchase-items')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: { item: string; description?: string; quantity: number; unit?: string; supplier?: string },
    @CurrentUser() actor: { _id: string },
  ) {
    return this.service.create(projectId, dto, actor._id);
  }

  @Patch('purchase-items/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseItemDto,
    @CurrentUser() actor: { _id: string },
  ) {
    return this.service.update(id, dto, actor._id);
  }
}
