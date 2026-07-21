import { ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Browser } from 'puppeteer';
import { Role } from '@fonte/types';
import { DOCUMENT_PRINT_CSS } from '@fonte/doc-styles';
import { Resident } from '../resident/resident.entity';
import { Relative } from '../relative/relative.entity';
import { Staff } from '../staff/staff.entity';
import { DocumentTemplate } from './document-template.entity';
import { StorageService } from '../storage/storage.service';

// Label PT da role impressa sob a assinatura (story 128, decisão 3).
const ROLE_LABEL_PT: Record<string, string> = {
  [Role.ADMIN]: 'Administrador',
  [Role.COORDINATOR]: 'Coordenador',
  [Role.SERVANT]: 'Servo',
};

// Quem assina o documento: dados já resolvidos (nome, role e URL da assinatura
// JÁ ASSINADA de acesso). Pré-resolvido fora do applyVariables, que é síncrono
// e não pode aguardar o signUrl (decisão 7 — regra da story 76).
interface DocumentSigner {
  name: string;
  role: Role | null;
  signatureUrl: string | null;
}

@Injectable()
export class DocumentTemplateService implements OnModuleDestroy {
  constructor(
    @InjectRepository(DocumentTemplate)
    private repo: Repository<DocumentTemplate>,
    @InjectRepository(Relative)
    private relativeRepo: Repository<Relative>,
    @InjectRepository(Staff)
    private staffRepo: Repository<Staff>,
    private storageService: StorageService,
  ) {}

  private browserPromise: Promise<Browser> | null = null;
  private readonly logger = new Logger(DocumentTemplateService.name);

  async onModuleDestroy() {
    if (this.browserPromise) {
      const browser = await this.browserPromise.catch(() => null);
      await browser?.close();
    }
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = import('puppeteer').then((p) =>
        p.default.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        }),
      );
    }
    return this.browserPromise;
  }

  async generatePdf(templateId: string, resident: Resident, signerUserId?: string): Promise<{ buffer: Buffer; filename: string }> {
    const template = await this.findOne(templateId);
    const html = await this.renderForResident(templateId, resident, signerUserId);
    const filename = this.slugify(`${resident.name} ${template.name}`) + '.pdf';
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      // Single margin convention (story 24 §2): puppeteer margin is ZEROED so the
      // ONLY page margin is the body `padding` from DOCUMENT_PRINT_CSS. This makes
      // the usable content height unambiguous (A4 1123px − 2×48px = 1027px) and
      // lets the editor's A4 frame paginate at exactly the same offset as the PDF.
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
      return { buffer: Buffer.from(pdf), filename };
    } finally {
      await page.close();
    }
  }

  private slugify(text: string): string {
    return text
      .normalize('NFD')
      .split('')
      .filter((c) => c.charCodeAt(0) < 0x0300 || c.charCodeAt(0) > 0x036f)
      .join('')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async findAll(): Promise<DocumentTemplate[]> {
    const templates = await this.repo.find({ order: { name: 'ASC' } });
    await Promise.all(templates.map((t) => this.signContent(t)));
    return templates;
  }

  // Templates marcados para assinatura no acolhimento.
  findAdmissionTemplates(): Promise<DocumentTemplate[]> {
    return this.repo.find({ where: { signAtAdmission: true }, order: { name: 'ASC' } });
  }

  // Signs every embedded <img src> S3 URL in the template content so the editor
  // and the PDF always receive a valid, non-expired URL. Mutates and returns the
  // entity for convenience. No-op outside S3 mode.
  private async signContent(template: DocumentTemplate): Promise<DocumentTemplate> {
    template.content = await this.storageService.signContentUrls(template.content);
    return template;
  }

  async findOne(id: string): Promise<DocumentTemplate> {
    const template = await this.repo.findOne({ where: { id } });
    if (!template) throw new NotFoundException(`Template ${id} not found`);
    return this.signContent(template);
  }

  async create(name: string, content: string, isRequired = false, signAtAdmission = false): Promise<DocumentTemplate> {
    const existing = await this.repo.findOne({ where: { name } });
    if (existing) throw new ConflictException(`Template com nome "${name}" já existe`);
    // Persist the canonical (unsigned) S3 URLs — never an expiring signature.
    const template = this.repo.create({
      name,
      content: this.storageService.stripContentSignatures(content),
      isRequired,
      signAtAdmission,
    });
    return this.signContent(await this.repo.save(template));
  }

  async update(id: string, data: Partial<Pick<DocumentTemplate, 'name' | 'content' | 'isRequired' | 'signAtAdmission'>>): Promise<DocumentTemplate> {
    // Conteúdo bruto (canônico) atual, para diff de imagens (story 93).
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Template ${id} not found`);
    if (data.name) {
      const conflict = await this.repo.findOne({ where: { name: data.name } });
      if (conflict && conflict.id !== id) throw new ConflictException(`Template com nome "${data.name}" já existe`);
    }
    // Persist the canonical (unsigned) S3 URLs — never an expiring signature.
    const newContent =
      data.content !== undefined
        ? this.storageService.stripContentSignatures(data.content)
        : undefined;
    const persisted = newContent !== undefined ? { ...data, content: newContent } : data;
    await this.repo.update(id, persisted);
    // Limpa do bucket as imagens que sumiram do conteúdo (story 93). Best-effort.
    if (newContent !== undefined) {
      await this.cleanupRemovedImages(existing.content, newContent);
    }
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    // Conteúdo bruto antes de apagar, para limpar suas imagens do bucket (story 93).
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Template ${id} not found`);
    await this.repo.delete(id);
    for (const url of this.storageService.extractBucketImageUrls(existing.content)) {
      await this.safeDelete(url);
    }
  }

  // Apaga do bucket as imagens presentes no conteúdo antigo e ausentes no novo.
  // Só URLs do nosso bucket (externas/base64 são ignoradas por extractBucketImageUrls).
  private async cleanupRemovedImages(oldContent: string, newContent: string): Promise<void> {
    const oldUrls = this.storageService.extractBucketImageUrls(oldContent);
    if (!oldUrls.length) return;
    const kept = new Set(this.storageService.extractBucketImageUrls(newContent));
    for (const url of oldUrls) {
      if (!kept.has(url)) await this.safeDelete(url);
    }
  }

  // Deleção best-effort: falha ao apagar o objeto não aborta o save/remove.
  private async safeDelete(url: string): Promise<void> {
    try {
      await this.storageService.delete(url);
    } catch (error) {
      this.logger.warn(
        `Falha ao remover imagem órfã ${url}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    const filename = this.storageService.uniqueFilename(file.originalname, 'doc-');
    const url = await this.storageService.upload('documents', filename, file.buffer, file.mimetype);
    return { url };
  }

  async renderForResident(templateId: string, resident: Resident, signerUserId?: string): Promise<string> {
    const template = await this.findOne(templateId);
    const responsible = await this.relativeRepo.findOne({
      where: { residentId: resident.id, isResponsible: true },
    });
    const signer = await this.resolveSigner(signerUserId);
    const content = this.applyVariables(template.content, resident, responsible, signer);
    return this.wrapPage(template.name, content);
  }

  // Resolve o staff que está gerando o documento e pré-assina a URL da sua
  // assinatura (decisão 7): applyVariables é síncrono e roda depois do findOne
  // que já assinou o conteúdo, então a URL da imagem tem que chegar pronta.
  private async resolveSigner(userId?: string): Promise<DocumentSigner | null> {
    if (!userId) return null;
    const staff = await this.staffRepo.findOne({ where: { userId }, relations: ['user'] });
    if (!staff) return null;
    let signatureUrl: string | null = null;
    if (staff.signatureUrl) {
      const canonical = this.storageService.canonicalizeS3Url(staff.signatureUrl);
      signatureUrl = this.storageService.isS3Url(canonical)
        ? await this.storageService.signUrl(canonical)
        : await this.storageService.toDataUri(staff.signatureUrl);
    }
    return { name: staff.name, role: staff.user?.role ?? null, signatureUrl };
  }

  // Bloco da assinatura (story 128, decisão 3): imagem acima da linha (25 "_"),
  // nome e label da role abaixo. Sem imagem, sai só a linha + identificação —
  // o documento nunca imprime {{signature}} cru.
  private buildSignatureBlock(signer: DocumentSigner | null): string {
    const line = '_'.repeat(25);
    const img = signer?.signatureUrl
      ? `<img class="doc-signature-img" src="${signer.signatureUrl}" alt="Assinatura"/>`
      : '';
    const name = signer?.name
      ? `<div class="doc-signature-name">${signer.name}</div>`
      : '';
    const roleLabel = signer?.role ? (ROLE_LABEL_PT[signer.role] ?? '') : '';
    const role = roleLabel ? `<div class="doc-signature-role">${roleLabel}</div>` : '';
    return `<div class="doc-signature">${img}<div class="doc-signature-line">${line}</div>${name}${role}</div>`;
  }

  private applyVariables(content: string, resident: Resident, responsible: Relative | null, signer?: DocumentSigner | null): string {
    const MARITAL_PT: Record<string, string> = {
      SINGLE: 'Solteiro(a)', MARRIED: 'Casado(a)', DIVORCED: 'Divorciado(a)',
    };

    const vars: Record<string, string> = {
      name:          resident.name ?? '',
      cpf:           this.formatCpf(resident.cpf),
      rg:            resident.rg ?? 'não informado',
      nationality:   resident.nationality ?? 'não informado',
      city:          resident.city ?? 'não informado',
      state:         resident.state ?? 'não informado',
      birthDate:     this.formatDate(resident.birthDate as Date | null),
      age:           this.computeAge(resident.birthDate as Date | null),
      maritalStatus: resident.maritalStatus ? (MARITAL_PT[resident.maritalStatus] ?? resident.maritalStatus) : 'não informado',
      address:       resident.address ?? 'não informado',
      phone:         resident.contactPhone ?? 'não informado',
      house:         resident.house?.name ?? '',
      houseName:     resident.house?.name ?? '',
      houseAddress:  resident.house?.address ?? 'não informado',
      houseCity:     resident.house?.city ?? 'não informado',
      houseState:    resident.house?.state ?? 'não informado',
      entryDate:     this.formatDate(resident.entryDate as Date | null),
      date:          this.formatDate(new Date()),
      dateLong:      this.formatDateLong(new Date()),
      responsibleName:         responsible?.name ?? 'não informado',
      responsibleRelationship: responsible?.relationship ?? 'não informado',
      responsiblePhone:        responsible?.phone ?? 'não informado',
    };
    let result = content;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    // {{signature}} sai só quando o template a usa. Substituição por função para
    // não interpretar `$` da URL assinada como padrão de replace.
    const signatureBlock = this.buildSignatureBlock(signer ?? null);
    result = result.replace(/\{\{signature\}\}/g, () => signatureBlock);
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

  private formatDateLong(date: Date | string | null): string {
    if (!date) return '_______________';
    return new Date(date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
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
    /* Shared document typography/layout — single source of truth used by BOTH
       this PDF and the editor's A4 frame (story 24). Do not inline rules here. */
    ${DOCUMENT_PRINT_CSS}
    /* Signature block (story 128). Fixed image height so the drawn signature
       never pushes the A4 pagination (story 24 convention). */
    .doc-signature{margin-top:24px}
    .doc-signature-img{display:block;height:64px;width:auto;max-width:280px;object-fit:contain}
    .doc-signature-line{font-family:inherit;letter-spacing:1px;line-height:1;margin-bottom:2px}
    .doc-signature-name{font-weight:600}
    .doc-signature-role{color:#333}
    /* PDF-document-only chrome (the on-screen "Imprimir" button). */
    .print-btn{position:fixed;top:16px;right:16px;background:#1a1a1a;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:14px;font-family:inherit}
    .print-btn:hover{background:#333}
    @media print{.print-btn{display:none}}
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir</button>
  ${body}
</body>
</html>`;
  }
}
