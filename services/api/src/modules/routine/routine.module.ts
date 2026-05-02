import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutineEntry } from './routine.entity';
import { RoutineController } from './routine.controller';
import { RoutineService } from './routine.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoutineEntry])],
  controllers: [RoutineController],
  providers: [RoutineService],
})
export class RoutineModule {}
