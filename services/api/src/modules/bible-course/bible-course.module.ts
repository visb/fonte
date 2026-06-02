import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BibleCourseClass } from './bible-course-class.entity';
import { BibleCourseEnrollment } from './bible-course-enrollment.entity';
import { BibleCourseController } from './bible-course.controller';
import { BibleCourseService } from './bible-course.service';

@Module({
  imports: [TypeOrmModule.forFeature([BibleCourseClass, BibleCourseEnrollment])],
  controllers: [BibleCourseController],
  providers: [BibleCourseService],
  exports: [BibleCourseService],
})
export class BibleCourseModule {}
