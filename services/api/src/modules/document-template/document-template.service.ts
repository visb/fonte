import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Browser } from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { DOCUMENT_PRINT_CSS, A4_MARGIN_TOP_PX, A4_MARGIN_X_PX } from '@fonte/doc-styles';
import {
  ReceiptType,
  TemplateAvailability,
  TemplateKind,
  isTemplateAvailableForStatus,
} from '@fonte/types';
import { Resident } from '../resident/resident.entity';
import { Relative } from '../relative/relative.entity';
import { Staff } from '../staff/staff.entity';
import { DocumentTemplate } from './document-template.entity';
import { StorageService } from '../storage/storage.service';
import {
  applyDocumentVariables,
  slugify,
  type DocumentSigner,
  type DocumentVariableResolver,
} from './document-variables';
import { ResidentVariablesResolver } from './resident-variables.resolver';

// Story 178 — os campos que um template de RECIBO não pode escolher: recibo não
// é documento de acolhimento nem tem status de filho a respeitar. Forçados aqui
// (e não só escondidos na tela) porque a API é pública para o operador.
const RECEIPT_FORCED_FIELDS = {
  isRequired: false,
  signAtAdmission: false,
  availableFor: TemplateAvailability.ALL,
} as const;

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

  // Story 160 — o documento só pode ser gerado para um filho cujo status case com
  // a disponibilidade do template. Guarda dos TRÊS caminhos de geração (render,
  // PDF e PDF combinado): esconder o card na tela não é regra — a URL direta e a
  // seleção do combinado continuariam gerando o documento oculto.
  private assertAvailableForResident(template: DocumentTemplate, resident: Resident): void {
    if (!isTemplateAvailableForStatus(template.availableFor, resident?.status)) {
      throw new BadRequestException(
        'Este documento não está disponível para o status atual do acolhido',
      );
    }
  }

  // Story 178, decisão 9 — guarda dos TRÊS caminhos de geração de documento de
  // filho, espelhando a lição da story 160: sumir da tela não é regra. Um
  // template de RECIBO alcançado pela URL direta (ou colado na lista do PDF
  // combinado) recusa, em vez de renderizar um recibo sem sujeito nenhum.
  private assertResidentKind(template: DocumentTemplate): void {
    if (template.kind && template.kind !== TemplateKind.RESIDENT) {
      throw new BadRequestException(
        'Este template não é um documento do acolhido e não pode ser gerado por aqui',
      );
    }
  }

  private assertValidKind(value: unknown): TemplateKind {
    const allowed = Object.values(TemplateKind) as string[];
    if (typeof value !== 'string' || !allowed.includes(value)) {
      throw new BadRequestException(`kind inválido: use ${allowed.join(', ')}`);
    }
    return value as TemplateKind;
  }

  private assertValidReceiptType(value: unknown): ReceiptType {
    const allowed = Object.values(ReceiptType) as string[];
    if (typeof value !== 'string' || !allowed.includes(value)) {
      throw new BadRequestException(`receiptType inválido: use ${allowed.join(', ')}`);
    }
    return value as ReceiptType;
  }

  // Story 178 — invariantes da tabela do plano (§2), em UM lugar só porque
  // create e update têm exatamente as mesmas:
  //   RESIDENT → receiptType tem que ser nulo; demais campos livres.
  //   RECEIPT  → receiptType obrigatório e válido; isRequired/signAtAdmission/
  //              availableFor forçados, mesmo se o corpo mandar outra coisa.
  private async resolveKindFields(
    kind: TemplateKind,
    receiptType: unknown,
    currentId?: string,
  ): Promise<Partial<DocumentTemplate>> {
    if (kind === TemplateKind.RESIDENT) {
      if (receiptType !== undefined && receiptType !== null) {
        throw new BadRequestException('receiptType só é aceito em template de recibo');
      }
      return { kind, receiptType: null };
    }
    if (receiptType === undefined || receiptType === null) {
      throw new BadRequestException('Template de recibo exige um receiptType');
    }
    const type = this.assertValidReceiptType(receiptType);
    // Decisão 2 — um template ativo por tipo: o gerador ACHA o template pelo
    // tipo, então dois seria ambiguidade silenciosa. Mesma forma do conflito de
    // nome que já existia.
    const conflict = await this.repo.findOne({ where: { receiptType: type } });
    if (conflict && conflict.id !== currentId) {
      throw new ConflictException(`Já existe um template de recibo para ${type}`);
    }
    return { kind, receiptType: type, ...RECEIPT_FORCED_FIELDS };
  }

  // Valor do ternário vindo do corpo da requisição. Regra de negócio (e não
  // roteamento), por isso vive aqui e não no controller — que segue com
  // `@Body('campo')` avulso, sem DTO.
  private assertValidAvailability(value: unknown): TemplateAvailability {
    const allowed = Object.values(TemplateAvailability) as string[];
    if (typeof value !== 'string' || !allowed.includes(value)) {
      throw new BadRequestException(`availableFor inválido: use ${allowed.join(', ')}`);
    }
    return value as TemplateAvailability;
  }

  async generatePdf(templateId: string, resident: Resident, signerUserId?: string): Promise<{ buffer: Buffer; filename: string }> {
    const template = await this.findOne(templateId);
    this.assertResidentKind(template);
    this.assertAvailableForResident(template, resident);
    const html = await this.renderForResident(templateId, resident, signerUserId);
    const filename = slugify(`${resident.name} ${template.name}`) + '.pdf';
    return { buffer: await this.htmlToPdf(html), filename };
  }

  /**
   * Story 178 — HTML já resolvido → PDF A4. Extraído do `generatePdf` para o
   * recibo reusar a MESMA impressora (mesmo browser, mesma margem): o que muda
   * entre um documento de filho e um recibo é o dicionário de variáveis, não a
   * impressão.
   */
  async htmlToPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      // Margem única (story 24), agora na CAIXA DA PÁGINA (story 154): os mesmos
      // valores são declarados no `@page` do DOCUMENT_PRINT_CSS e aqui, sempre
      // vindos do @fonte/doc-styles — nunca hardcodados. Repetir aqui não é
      // redundância: no Chrome a margem passada ao printToPDF tem PRECEDÊNCIA
      // sobre o `@page`, então deixá-la zerada (como era até a story 154)
      // anularia o CSS justo no caminho principal. Antes a margem era o `padding`
      // do body, que é caixa do fluxo e só aparecia na 1ª e na última página;
      // como margem de página ela vale em TODAS, e a altura útil declarada
      // (A4_CONTENT_HEIGHT_PX = 1027px) passa a ser verdadeira em todas elas.
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: `${A4_MARGIN_TOP_PX}px`,
          bottom: `${A4_MARGIN_TOP_PX}px`,
          left: `${A4_MARGIN_X_PX}px`,
          right: `${A4_MARGIN_X_PX}px`,
        },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  // Story 152 — PDF único para impressão em lote no acolhimento.
  //
  // Cada template é renderizado pelo `generatePdf` normal (mesmo browser, página
  // aberta e fechada por documento) e só DEPOIS os PDFs são mesclados. NÃO
  // concatenar os HTMLs num único `wrapPage`: num fluxo só, o 2º documento
  // começaria onde o 1º terminou, no meio da página. Mesclando PDFs já
  // paginados, cada documento sai idêntico ao download individual e, por ser um
  // arquivo inteiro, começa obrigatoriamente numa página nova.
  //
  // (O motivo original registrado aqui — "o `padding` do body só vale na 1ª e na
  // última página do fluxo, então do 2º documento em diante o texto encostaria na
  // borda" — deixou de valer na story 154, que moveu a margem para o `@page`. A
  // decisão de mesclar PDFs continua certa, pelo motivo acima.)
  async generateCombinedPdf(
    templateIds: string[],
    resident: Resident,
    signerUserId?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    if (!templateIds?.length) {
      throw new BadRequestException('Selecione ao menos um documento.');
    }
    // Story 160 — valida a lista INTEIRA antes de abrir qualquer página do
    // browser: um template incompatível com o status do filho reprova a
    // requisição toda, em vez de devolver um PDF parcial silenciosamente.
    for (const templateId of templateIds) {
      const template = await this.findOne(templateId);
      // Story 178 — um RECIBO no meio da lista reprova a requisição inteira,
      // pela mesma razão da story 160: PDF parcial silencioso é pior que erro.
      this.assertResidentKind(template);
      this.assertAvailableForResident(template, resident);
    }
    const merged = await PDFDocument.create();
    // Sequencial de propósito: uma página do puppeteer por vez (paralelo estoura
    // memória do browser) e a ordem recebida é a ordem final do impresso.
    for (const templateId of templateIds) {
      const { buffer } = await this.generatePdf(templateId, resident, signerUserId);
      const source = await PDFDocument.load(buffer);
      const pages = await merged.copyPages(source, source.getPageIndices());
      for (const page of pages) merged.addPage(page);
    }
    const bytes = await merged.save();
    const filename = slugify(`${resident.name} documentos`) + '.pdf';
    return { buffer: Buffer.from(bytes), filename };
  }

  /**
   * Story 178, decisão 8 — o isolamento é no REPOSITÓRIO, não na tela. O
   * default `RESIDENT` faz o consumidor atual (aba de Anexos, editor, wizard)
   * continuar vendo exatamente o que via, e um recibo novo nascer invisível
   * para eles sem que nenhuma tela precise saber que recibos existem.
   */
  async findAll(kind?: TemplateKind | string): Promise<DocumentTemplate[]> {
    const filter = kind === undefined ? TemplateKind.RESIDENT : this.assertValidKind(kind);
    const templates = await this.repo.find({ where: { kind: filter }, order: { name: 'ASC' } });
    await Promise.all(templates.map((t) => this.signContent(t)));
    return templates;
  }

  // Templates marcados para assinatura no acolhimento. Recibo nunca entra aqui
  // (é forçado a signAtAdmission = false, mas o filtro por kind é o cinto).
  findAdmissionTemplates(): Promise<DocumentTemplate[]> {
    return this.repo.find({
      where: { signAtAdmission: true, kind: TemplateKind.RESIDENT },
      order: { name: 'ASC' },
    });
  }

  /**
   * Story 178 — o gerador ACHA o template pelo tipo de recibo (decisão 2): não
   * existe escolha de template na hora de emitir, logo não existe risco de
   * emitir com o template errado. Sem template cadastrado, quem vê o erro é o
   * operador — daí a mensagem acionável, e não um 404 mudo.
   */
  async findByReceiptType(receiptType: ReceiptType, label: string): Promise<DocumentTemplate> {
    const template = await this.repo.findOne({
      where: { receiptType, kind: TemplateKind.RECEIPT },
    });
    if (!template) {
      throw new NotFoundException(
        `Nenhum template de recibo cadastrado para ${label}. Cadastre em Configurações → Templates.`,
      );
    }
    return this.signContent(template);
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

  async create(
    name: string,
    content: string,
    isRequired = false,
    signAtAdmission = false,
    availableFor?: TemplateAvailability | string,
    // Story 178 — sem o campo o template nasce RESIDENT (default da coluna e da
    // leitura): tudo que existe hoje segue sendo documento de filho.
    kind?: TemplateKind | string,
    receiptType?: ReceiptType | string | null,
  ): Promise<DocumentTemplate> {
    // Sem o campo o template nasce ALL (default da coluna) — story 160.
    const availability =
      availableFor === undefined ? TemplateAvailability.ALL : this.assertValidAvailability(availableFor);
    const resolvedKind = kind === undefined ? TemplateKind.RESIDENT : this.assertValidKind(kind);
    const kindFields = await this.resolveKindFields(resolvedKind, receiptType);
    const existing = await this.repo.findOne({ where: { name } });
    if (existing) throw new ConflictException(`Template com nome "${name}" já existe`);
    // Persist the canonical (unsigned) S3 URLs — never an expiring signature.
    const template = this.repo.create({
      name,
      content: this.storageService.stripContentSignatures(content),
      isRequired,
      signAtAdmission,
      availableFor: availability,
      ...kindFields,
    });
    return this.signContent(await this.repo.save(template));
  }

  async update(
    id: string,
    data: Partial<
      Pick<
        DocumentTemplate,
        'name' | 'content' | 'isRequired' | 'signAtAdmission' | 'availableFor' | 'kind' | 'receiptType'
      >
    >,
  ): Promise<DocumentTemplate> {
    if (data.availableFor !== undefined) this.assertValidAvailability(data.availableFor);
    // Conteúdo bruto (canônico) atual, para diff de imagens (story 93).
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Template ${id} not found`);
    // Story 178 — as invariantes valem sobre o estado FINAL: quem não mandou
    // `kind` continua no que já era, e quem promove um template a recibo tem
    // que mandar o tipo junto.
    if (data.kind !== undefined || data.receiptType !== undefined) {
      const nextKind =
        data.kind !== undefined
          ? this.assertValidKind(data.kind)
          : (existing.kind ?? TemplateKind.RESIDENT);
      const nextReceiptType =
        data.receiptType !== undefined ? data.receiptType : (existing.receiptType ?? undefined);
      Object.assign(data, await this.resolveKindFields(nextKind, nextReceiptType, id));
    }
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
    this.assertResidentKind(template);
    this.assertAvailableForResident(template, resident);
    const responsible = await this.relativeRepo.findOne({
      where: { residentId: resident.id, isResponsible: true },
    });
    const signer = await this.resolveSigner(signerUserId);
    // Story 157 — a foto do acolhido é resolvida aqui, ao lado do signer, pelo
    // mesmo motivo: o dicionário de variáveis é montado sem I/O e não pode
    // aguardar o signUrl/toDataUri.
    const residentPhotoUrl = await this.resolveResidentPhotoUrl(resident);
    return this.renderWithResolver(
      template,
      new ResidentVariablesResolver(resident, responsible, signer, residentPhotoUrl),
    );
  }

  /**
   * Story 178 — renderização compartilhada: o resolver diz O QUE cada token
   * vale, esta função aplica e embrulha na página A4. É o ponto por onde o
   * recibo entra sem tocar em nada do filho.
   */
  async renderWithResolver(
    template: DocumentTemplate,
    resolver: DocumentVariableResolver,
  ): Promise<string> {
    const vars = await resolver.resolve();
    return this.wrapPage(template.name, applyDocumentVariables(template.content, vars));
  }

  // Resolve o staff que está gerando o documento e pré-assina a URL da sua
  // assinatura (decisão 7): o dicionário de variáveis é montado sem I/O e roda
  // depois do findOne que já assinou o conteúdo, então a URL da imagem tem que
  // chegar pronta. Público desde a story 178: o recibo também é assinado por
  // quem o emitiu, e pelo mesmo caminho.
  async resolveSigner(userId?: string): Promise<DocumentSigner | null> {
    if (!userId) return null;
    const staff = await this.staffRepo.findOne({ where: { userId } });
    if (!staff) return null;
    let signatureUrl: string | null = null;
    if (staff.signatureUrl) {
      const canonical = this.storageService.canonicalizeS3Url(staff.signatureUrl);
      signatureUrl = this.storageService.isS3Url(canonical)
        ? await this.storageService.signUrl(canonical)
        : await this.storageService.toDataUri(staff.signatureUrl);
    }
    return { name: staff.name, signatureUrl };
  }

  // Story 157 — URL da foto do acolhido pronta para o `<img src>` do documento.
  // Espelha o resolveSigner acima: canonicaliza ANTES (uma URL que já chegue
  // assinada não pode ser assinada de novo) e então presigna (S3) ou inline como
  // data URI (modo local — o puppeteer não resolve `/uploads/...`, regra da
  // story 135). Sem foto → null, e o bloco imprime a moldura vazia; a foto NUNCA
  // bloqueia a geração do documento.
  private async resolveResidentPhotoUrl(resident: Resident): Promise<string | null> {
    if (!resident?.photoUrl) return null;
    const canonical = this.storageService.canonicalizeS3Url(resident.photoUrl);
    return this.storageService.isS3Url(canonical)
      ? this.storageService.signUrl(canonical)
      : this.storageService.toDataUri(resident.photoUrl);
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
    .doc-signature-img{display:inline-block;height:64px;width:auto;max-width:280px;object-fit:contain}
    .doc-signature-line{font-family:inherit;letter-spacing:1px;line-height:1;margin-bottom:2px}
    /* Story 137 — nome sem negrito (peso herdado do corpo); a role deixou de ser impressa. */
    .doc-signature-name{font-weight:normal}
    /* Foto do acolhido (story 157) — variável residentPhoto. Quadrado FIXO de 151px
       (≈ 4 cm a 96 dpi), a mesma proporção do avatar das telas: object-fit cover
       enquadra sem deformar. Altura fixa pelo mesmo motivo da assinatura — é o
       que mantém a paginação A4 do editor fiel à do PDF (convenção da story 24).
       Sem foto sai a moldura vazia rotulada, do MESMO tamanho, para colar a foto
       à mão. Se estes 151 mudarem, sincronizar ResidentPhotoPlaceholder no adm. */
    .doc-photo-img{width:151px;height:151px;object-fit:cover;display:inline-block;vertical-align:top}
    .doc-photo-placeholder{width:151px;height:151px;box-sizing:border-box;border:1px solid #333;display:inline-flex;align-items:center;justify-content:center;color:#666;vertical-align:top}
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
