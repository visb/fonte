import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Relative } from './relative.entity';
import { RelativeController } from './relative.controller';
import { RelativeService } from './relative.service';

@Module({
  imports: [TypeOrmModule.forFeature([Relative])],
  controllers: [RelativeController],
  providers: [RelativeService],
  exports: [RelativeService],
})
export class RelativeModule {}
