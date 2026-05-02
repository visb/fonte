import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resident } from './resident.entity';

@Injectable()
export class ResidentService {
  constructor(
    @InjectRepository(Resident)
    private residentRepository: Repository<Resident>,
  ) {}
}
