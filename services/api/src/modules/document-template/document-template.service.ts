import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentType } from '@fonte/types';
import { Resident } from '../resident/resident.entity';
import { DocumentTemplate } from './document-template.entity';

const DOCUMENT_TITLE: Record<DocumentType, string> = {
  [DocumentType.IMAGE_AUTHORIZATION]: 'Termo de Autorização de Uso de Imagem',
  [DocumentType.COMMUNITY_RULES]:     'Regras de Permanência na Comunidade',
  [DocumentType.FAMILY_RULES]:        'Regras para as Famílias',
};

@Injectable()
export class DocumentTemplateService {
  constructor(
    @InjectRepository(DocumentTemplate)
    private repo: Repository<DocumentTemplate>,
  ) {}

  findAll(): Promise<DocumentTemplate[]> {
    return this.repo.find({ order: { type: 'ASC' } });
  }

  async findOne(type: DocumentType): Promise<DocumentTemplate> {
    const template = await this.repo.findOne({ where: { type } });
    if (!template) throw new NotFoundException(`Template ${type} not found`);
    return template;
  }

  async update(type: DocumentType, content: string): Promise<DocumentTemplate> {
    const template = await this.findOne(type);
    await this.repo.update(template.id, { content });
    return this.findOne(type);
  }

  async renderForResident(type: DocumentType, resident: Resident): Promise<string> {
    const template = await this.findOne(type);
    const content = this.applyVariables(template.content, resident);
    return this.wrapPage(DOCUMENT_TITLE[type], content);
  }

  private applyVariables(content: string, resident: Resident): string {
    const MARITAL_PT: Record<string, string> = {
      SINGLE: 'Solteiro(a)', MARRIED: 'Casado(a)', DIVORCED: 'Divorciado(a)',
    };

    const vars: Record<string, string> = {
      name:          resident.name ?? '',
      cpf:           this.formatCpf(resident.cpf),
      rg:            resident.rg ?? 'não informado',
      birthDate:     this.formatDate(resident.birthDate as Date | null),
      age:           this.computeAge(resident.birthDate as Date | null),
      maritalStatus: resident.maritalStatus ? (MARITAL_PT[resident.maritalStatus] ?? resident.maritalStatus) : 'não informado',
      address:       resident.address ?? 'não informado',
      phone:         resident.contactPhone ?? 'não informado',
      house:         resident.house?.name ?? '',
      entryDate:     this.formatDate(resident.entryDate as Date | null),
      date:          this.formatDate(new Date()),
    };
    let result = content;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }

  private computeAge(birthDate: Date | string | null): string {
    if (!birthDate) return 'não informado';
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return `${age} anos`;
  }

  private formatDate(date: Date | string | null): string {
    if (!date) return '___/___/______';
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }

  private formatCpf(cpf: string | null): string {
    if (!cpf) return 'não informado';
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return cpf;
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  private wrapPage(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:12pt;line-height:1.7;color:#000;max-width:800px;margin:0 auto;padding:48px 40px}
    h1,h2,h3{margin-bottom:14px;text-align:center}
    p{margin-bottom:10px}
    ol,ul{margin-left:28px;margin-bottom:10px}
    li{margin-bottom:6px}
    .print-btn{position:fixed;top:16px;right:16px;background:#1a1a1a;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:14px;font-family:inherit}
    .print-btn:hover{background:#333}
    @media print{.print-btn{display:none}body{padding:20px}}
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir</button>
  ${body}
</body>
</html>`;
  }
}
