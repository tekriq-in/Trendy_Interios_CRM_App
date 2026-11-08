import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ShadeCardService } from './shade-card.service';
import { CreateShadeCardEntryDto, UpdateShadeCardEntryDto } from './dto/shade-card.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class ShadeCardController {
  constructor(private service: ShadeCardService) {}

  @Get('projects/:projectId/shade-card')
  findByProject(@Param('projectId') projectId: string) {
    return this.service.findByProject(projectId);
  }

  @Post('projects/:projectId/shade-card')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateShadeCardEntryDto,
    @CurrentUser() actor: { _id: string },
  ) {
    return this.service.create(projectId, dto, actor._id);
  }

  @Patch('shade-card/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateShadeCardEntryDto,
    @CurrentUser() actor: { _id: string },
  ) {
    return this.service.update(id, dto, actor._id);
  }

  @Delete('shade-card/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('projects/:projectId/shade-card/reorder')
  reorder(
    @Param('projectId') projectId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.service.reorder(projectId, body.orderedIds);
  }
}
