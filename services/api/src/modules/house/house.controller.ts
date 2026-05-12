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
import { memoryStorage } from 'multer';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateHouseDto } from './dto/create-house.dto';
import { CreateHouseRuleDto } from './dto/create-house-rule.dto';
import { UpdateHouseDto } from './dto/update-house.dto';
import { House } from './house.entity';
import { HousePhoto } from './house-photo.entity';
import { HouseRule } from './house-rule.entity';
import { HouseService } from './house.service';
import { MinistryService } from '../ministry/ministry.service';
import { CreateMinistryDto } from '../ministry/dto/create-ministry.dto';

const photoOptions = {
  storage: memoryStorage(),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new BadRequestException('Apenas imagens são permitidas'), false);
    }
    cb(null, true);
  },
};

@Controller('houses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HouseController {
  constructor(
    private houseService: HouseService,
    private ministryService: MinistryService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findAll(): Promise<House[]> {
    return this.houseService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<House> {
    return this.houseService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateHouseDto): Promise<House> {
    return this.houseService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHouseDto,
  ): Promise<House> {
    return this.houseService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.houseService.remove(id);
  }

  @Post(':id/photos')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @UseInterceptors(FileInterceptor('file', photoOptions))
  addPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: máximo 5 MB'),
      }),
    )
    file: Express.Multer.File,
  ): Promise<HousePhoto> {
    return this.houseService.addPhoto(id, file);
  }

  @Delete(':id/photos/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  removePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<void> {
    return this.houseService.removePhoto(id, photoId);
  }

  // ─── Residents ──────────────────────────────────────────────────────────────

  @Get(':id/residents')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findResidents(@Param('id', ParseUUIDPipe) id: string) {
    return this.houseService.findResidents(id);
  }

  // ─── Staff ──────────────────────────────────────────────────────────────────

  @Get(':id/staff')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findHouseStaff(@Param('id', ParseUUIDPipe) id: string) {
    return this.houseService.findStaffForHouse(id);
  }

  // ─── Ministries ─────────────────────────────────────────────────────────────

  @Get(':id/ministries')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findMinistries(@Param('id', ParseUUIDPipe) id: string) {
    return this.ministryService.findByHouse(id);
  }

  @Post(':id/ministries')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  createMinistry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMinistryDto,
  ) {
    return this.ministryService.create(id, dto);
  }

  // ─── Rules ──────────────────────────────────────────────────────────────────

  @Get(':id/rules')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findRules(@Param('id', ParseUUIDPipe) id: string) {
    return this.houseService.findRules(id);
  }

  @Post(':id/rules')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  createRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateHouseRuleDto,
  ): Promise<HouseRule> {
    return this.houseService.createRule(id, dto);
  }

  @Delete(':id/rules/:ruleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  removeRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ): Promise<void> {
    return this.houseService.removeRule(id, ruleId);
  }
}
