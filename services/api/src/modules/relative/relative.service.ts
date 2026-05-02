import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Relative } from './relative.entity';

@Injectable()
export class RelativeService {
  constructor(
    @InjectRepository(Relative)
    private relativeRepository: Repository<Relative>,
  ) {}
}
