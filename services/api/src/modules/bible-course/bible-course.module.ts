import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BibleCourseClass } from './bible-course-class.entity';
import { BibleCourseEnrollment } from './bible-course-enrollment.entity';
import { BibleCourseModule as BibleCourseModuleEntity } from './bible-course-module.entity';
import { BibleCourseGrade } from './bible-course-grade.entity';
import { BibleCourseClassPhoto } from './bible-course-class-photo.entity';
import { BibleCourseExternalCompletion } from './bible-course-external-completion.entity';
import { BibleCourseController } from './bible-course.controller';
import { BibleCourseClassPhotoController } from './bible-course-class-photo.controller';
import { BibleCourseService } from './bible-course.service';
import { BibleCourseClassPhotoService } from './bible-course-class-photo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BibleCourseClass,
      BibleCourseEnrollment,
      BibleCourseModuleEntity,
      BibleCourseGrade,
      BibleCourseClassPhoto,
      BibleCourseExternalCompletion,
    ]),
  ],
  controllers: [BibleCourseController, BibleCourseClassPhotoController],
  providers: [BibleCourseService, BibleCourseClassPhotoService],
  exports: [BibleCourseService],
})
export class BibleCourseModule {}
