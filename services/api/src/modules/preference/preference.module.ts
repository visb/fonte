import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPreference } from './user-preference.entity';
import { PreferenceController } from './preference.controller';
import { PreferenceService } from './preference.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserPreference])],
  controllers: [PreferenceController],
  providers: [PreferenceService],
})
export class PreferenceModule {}
