import { PartialType } from '@nestjs/mapped-types';
import { CreateStreetSaleDto } from './create-street-sale.dto';

export class UpdateStreetSaleDto extends PartialType(CreateStreetSaleDto) {}
