import type { ResidentFormData } from './residentSchema';

export interface DraftRelative {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  include: boolean;
}

export interface ParseResult {
  resident: Partial<ResidentFormData>;
  relatives: DraftRelative[];
  warnings: Partial<Record<keyof ResidentFormData, string>>;
  houseName: string;
  rawText: string;
}
