import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { Resident } from './resident.entity';
import { ResidentService } from './resident.service';

const photoOptions = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads', 'residents'),
    filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new BadRequestException('Apenas imagens são permitidas'), false);
    }
    cb(null, true);
  },
};

@Controller('residents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResidentController {
  constructor(private residentService: ResidentService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findAll(): Promise<Resident[]> {
    return this.residentService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Resident> {
    return this.residentService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  create(@Body() dto: CreateResidentDto): Promise<Resident> {
    return this.residentService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResidentDto,
  ): Promise<Resident> {
    return this.residentService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.residentService.remove(id);
  }

  @Post(':id/photo')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @UseInterceptors(FileInterceptor('file', photoOptions))
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: máximo 5 MB'),
      }),
    )
    file: Express.Multer.File,
  ): Promise<Resident> {
    return this.residentService.uploadPhoto(id, file);
  }
}
