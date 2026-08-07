import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Browser } from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { DOCUMENT_PRINT_CSS, A4_MARGIN_TOP_PX, A4_MARGIN_X_PX } from '@fonte/doc-styles';
import { TemplateAvailability, isTemplateAvailableForStatus } from '@fonte/types';
import { Resident } from '../resident/resident.entity';
import { Relative } from '../relative/relative.entity';
import { Staff } from '../staff/staff.entity';
import { DocumentTemplate } from './document-template.entity';
import { StorageService } from '../storage/storage.service';

// Quem assina o documento: dados já resolvidos (nome e URL da assinatura JÁ
// ASSINADA de acesso). Pré-resolvido fora do applyVariables, que é síncrono e
// não pode aguardar o signUrl (decisão 7 — regra da story 76). A role NÃO é mais
// impressa abaixo da assinatura (story 137).
interface DocumentSigner {
  name: string;
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
    this.assertAvailableForResident(template, resident);
    const html = await this.renderForResident(templateId, resident, signerUserId);
    const filename = this.slugify(`${resident.name} ${template.name}`) + '.pdf';
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
      return { buffer: Buffer.from(pdf), filename };
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
      this.assertAvailableForResident(await this.findOne(templateId), resident);
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
    const filename = this.slugify(`${resident.name} documentos`) + '.pdf';
    return { buffer: Buffer.from(bytes), filename };
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

  async create(
    name: string,
    content: string,
    isRequired = false,
    signAtAdmission = false,
    availableFor?: TemplateAvailability | string,
  ): Promise<DocumentTemplate> {
    // Sem o campo o template nasce ALL (default da coluna) — story 160.
    const availability =
      availableFor === undefined ? TemplateAvailability.ALL : this.assertValidAvailability(availableFor);
    const existing = await this.repo.findOne({ where: { name } });
    if (existing) throw new ConflictException(`Template com nome "${name}" já existe`);
    // Persist the canonical (unsigned) S3 URLs — never an expiring signature.
    const template = this.repo.create({
      name,
      content: this.storageService.stripContentSignatures(content),
      isRequired,
      signAtAdmission,
      availableFor: availability,
    });
    return this.signContent(await this.repo.save(template));
  }

  async update(
    id: string,
    data: Partial<Pick<DocumentTemplate, 'name' | 'content' | 'isRequired' | 'signAtAdmission' | 'availableFor'>>,
  ): Promise<DocumentTemplate> {
    if (data.availableFor !== undefined) this.assertValidAvailability(data.availableFor);
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
    this.assertAvailableForResident(template, resident);
    const responsible = await this.relativeRepo.findOne({
      where: { residentId: resident.id, isResponsible: true },
    });
    const signer = await this.resolveSigner(signerUserId);
    // Story 157 — a foto do acolhido é resolvida aqui, ao lado do signer, pelo
    // mesmo motivo: applyVariables é síncrono e não pode aguardar o signUrl/
    // toDataUri.
    const residentPhotoUrl = await this.resolveResidentPhotoUrl(resident);
    const content = this.applyVariables(template.content, resident, responsible, signer, residentPhotoUrl);
    return this.wrapPage(template.name, content);
  }

  // Resolve o staff que está gerando o documento e pré-assina a URL da sua
  // assinatura (decisão 7): applyVariables é síncrono e roda depois do findOne
  // que já assinou o conteúdo, então a URL da imagem tem que chegar pronta.
  private async resolveSigner(userId?: string): Promise<DocumentSigner | null> {
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

  // Bloco da assinatura (story 128): imagem acima da linha (25 "_") e nome abaixo.
  // Sem imagem, sai só a linha + nome — o documento nunca imprime {{signature}}
  // cru. Story 137: a role deixou de ser impressa e o nome não é mais negrito.
  private buildSignatureBlock(signer: DocumentSigner | null, align?: string): string {
    const line = '_'.repeat(25);
    const img = signer?.signatureUrl
      ? `<img class="doc-signature-img" src="${signer.signatureUrl}" alt="Assinatura"/>`
      : '';
    const name = signer?.name
      ? `<div class="doc-signature-name">${signer.name}</div>`
      : '';
    // Story 136 — quando o {{signature}} está numa linha com alinhamento próprio,
    // carrega o text-align para o style do bloco (o CSS centraliza a img via
    // .doc-signature-img{display:inline-block}). Sem align → default à esquerda.
    const style = align ? ` style="text-align:${align}"` : '';
    return `<div class="doc-signature"${style}>${img}<div class="doc-signature-line">${line}</div>${name}</div>`;
  }

  // Story 157 — bloco da foto do acolhido ({{residentPhoto}}). Com foto, a
  // imagem em quadrado fixo (CSS `.doc-photo-img`, 151px ≈ 4 cm); sem foto, a
  // MOLDURA VAZIA rotulada "Foto" — análogo direto da linha de 25 "_" que a
  // assinatura imprime quando não há imagem: o papel sai com o espaço reservado
  // para colar a foto à mão, e o documento nunca imprime {{residentPhoto}} cru.
  // `align` funciona igual ao bloco de assinatura (story 136).
  private buildResidentPhotoBlock(photoUrl: string | null, align?: string): string {
    const inner = photoUrl
      ? `<img class="doc-photo-img" src="${photoUrl}" alt="Foto"/>`
      : '<div class="doc-photo-placeholder">Foto</div>';
    const style = align ? ` style="text-align:${align}"` : '';
    return `<div class="doc-photo"${style}>${inner}</div>`;
  }

  // Story 136 — extrai o text-align dos atributos de um <p> que só contém o
  // {{signature}}, para que o bloco da assinatura honre o alinhamento do editor.
  private extractTextAlign(attrs: string): string | undefined {
    const match = attrs.match(/text-align\s*:\s*(left|right|center|justify)/i);
    return match ? match[1].toLowerCase() : undefined;
  }

  // Ruído que o editor deixa em volta do token dentro do <p>: espaços, `&nbsp;`
  // e os <span> de fonte (ex.:
  // `<p style="text-align:center"><span …>&nbsp;{{signature}}</span></p>`).
  // Sem tolerar isso, o parágrafo não casa e o bloco cai no fallback inline sem
  // alinhamento (bug de produção da story 136). Compartilhado pelas DUAS
  // variáveis de bloco desde a story 157 — era o `SIG_WRAP` da assinatura.
  private static readonly TOKEN_WRAP = String.raw`(?:\s|&nbsp;|<span[^>]*>|</span>)*`;

  // Mecânica das variáveis de BLOCO ({{signature}}, story 128/136;
  // {{residentPhoto}}, story 157): um token cujo valor é HTML de bloco, não
  // texto. Extraído na story 157 para as duas variáveis compartilharem
  // exatamente o mesmo comportamento. Em ordem:
  //   1. troca o <p …> INTEIRO quando o token é seu único conteúdo visível,
  //      carregando o text-align do parágrafo — evita <div> dentro de <p>
  //      (parser fecha o <p> e o alinhamento se perde);
  //   2. fallback inline para as ocorrências remanescentes (sem alinhamento).
  // Os dois `replace` usam FUNÇÃO: o `$` de uma URL presignada não pode ser
  // interpretado como padrão de substituição.
  private replaceBlockToken(
    html: string,
    token: string,
    build: (align?: string) => string,
  ): string {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wrap = DocumentTemplateService.TOKEN_WRAP;
    const result = html.replace(
      new RegExp(`<p([^>]*)>${wrap}${escaped}${wrap}</p>`, 'g'),
      (_m, attrs: string) => build(this.extractTextAlign(attrs)),
    );
    const inlineBlock = build();
    return result.replace(new RegExp(escaped, 'g'), () => inlineBlock);
  }

  // Story 153 — variável ÚNICA e condicional para o rótulo de assinatura do
  // familiar responsável. Substitui o rodapé escrito à mão
  // `{{responsibleName}}({{responsibleRelationship}})`, que imprimia
  // `não informado(não informado)` quando o acolhido não tinha responsável.
  //
  //   nome + parentesco → `Maria Souza (Mãe)`  (com espaço antes do parêntese)
  //   nome sem parentesco → `Maria Souza`      (sem parênteses vazios)
  //   sem responsável / nome em branco → `Responsável` (rótulo da linha de assinatura)
  //
  // `relationship` é texto livre: sai como foi digitado, sem tradução. O `trim()`
  // vale para os dois campos, então espaços em branco contam como ausência.
  private buildResponsibleWithRelationship(responsible: Relative | null): string {
    const name = responsible?.name?.trim();
    if (!name) return 'Responsável';
    const rel = responsible?.relationship?.trim();
    return rel ? `${name} (${rel})` : name;
  }

  private applyVariables(
    content: string,
    resident: Resident,
    responsible: Relative | null,
    signer?: DocumentSigner | null,
    residentPhotoUrl?: string | null,
  ): string {
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
      // Story 159 — DIVERGE de propósito das demais datas: sem saída imprime
      // 'não informado' (fallback de `rg`/`city`/`address`) em vez do traço
      // `___/___/______` que `formatDate(null)` devolve. Filho SEM saída é o caso
      // normal (está ativo) e o traço convidaria a preencher à mão uma data que
      // não existe. O ternário é o que evita cair no traço.
      exitDate:      resident.exitDate
        ? this.formatDate(resident.exitDate as Date | null)
        : 'não informado',
      date:          this.formatDate(new Date()),
      dateLong:      this.formatDateLong(new Date()),
      responsibleName:         responsible?.name ?? 'não informado',
      responsibleRelationship: responsible?.relationship ?? 'não informado',
      responsibleWithRelationship: this.buildResponsibleWithRelationship(responsible),
      responsiblePhone:        responsible?.phone ?? 'não informado',
    };
    let result = content;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    // Variáveis de BLOCO — saem só quando o template as usa; ambas passam pelo
    // mesmo replaceBlockToken (parágrafo inteiro + fallback inline).
    const resolvedSigner = signer ?? null;
    result = this.replaceBlockToken(result, '{{signature}}', (align) =>
      this.buildSignatureBlock(resolvedSigner, align),
    );
    // Story 157 — foto do acolhido. Sem foto (`null`), o bloco vira a moldura
    // vazia: nunca sobra `{{residentPhoto}}` cru no papel.
    result = this.replaceBlockToken(result, '{{residentPhoto}}', (align) =>
      this.buildResidentPhotoBlock(residentPhotoUrl ?? null, align),
    );
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
