import { PartialType } from '@nestjs/mapped-types';
import { CreateStaffDto } from './create-staff.dto';

// Todos os campos opcionais no update, incluindo a ficha pessoal e o e-mail.
export class UpdateStaffDto extends PartialType(CreateStaffDto) {}
