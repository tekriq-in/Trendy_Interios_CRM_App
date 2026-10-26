import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf', 'application/vnd', 'application/msword'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '@ti/shared';

@Controller('documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentsController {
  constructor(private service: DocumentsService) {}

  @Post('upload')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_UPLOAD)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      const allowed = ALLOWED_MIME_PREFIXES.some(p => file.mimetype.startsWith(p));
      cb(allowed ? null : new BadRequestException('Unsupported file type'), allowed);
    },
  }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() meta: { projectId?: string; departmentId?: string; type?: string },
    @CurrentUser() actor: { _id: string },
  ) {
    return this.service.upload(
      { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype, size: file.size },
      meta,
      actor._id,
    );
  }

  @Get()
  findByProject(@Query('projectId') projectId: string) {
    return this.service.findByProject(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_DELETE)
  remove(@Param('id') id: string, @CurrentUser() actor: { _id: string }) {
    return this.service.softDelete(id, actor._id);
  }
}
