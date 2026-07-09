import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import * as mammoth from 'mammoth';
// jszip is CommonJS and the project does not enable esModuleInterop, so a default
// import resolves to `undefined` at runtime — use a namespace import instead.
import * as JSZip from 'jszip';
import { ImportAdmission } from '@fonte/types';

// Image media types the vision model accepts. EMF/WMF and other vector formats
// embedded by Word are skipped.
const SUPPORTED_IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

interface DocxImage {
  mime: string;
  base64: string;
}

export interface ParseDocxResident {
  name: string | null;
  birthDate: string | null;
  entryDate: string | null;
  // Todas as datas de acolhimento quando a ficha traz mais de uma (readmissões).
  // O cross-match usa junto com as saídas da planilha para montar o histórico
  // de acolhimentos (múltiplos internamentos).
  entryDates?: string[] | null;
  // A ficha não traz data de saída; o campo existe para receber o valor da
  // planilha no cross-match (story 102).
  exitDate: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  cpf: string | null;
  rg: string | null;
  nationality: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  maritalStatus: 'SINGLE' | 'MARRIED' | 'DIVORCED' | null;
  children: string | null;
  occupation: string | null;
  education: string | null;
  religion: string | null;
  addiction: string | null;
  healthIssues: string | null;
  continuousMedication: string | null;
  weight: string | null;
  height: string | null;
  familyInvestment: 'BASKET_500' | 'PAYMENT_700' | 'SOCIAL' | 'NEGOTIATED' | null;
  familyInvestmentAmount: number | null;
  contributionDueDay: string | null;
  contactPhone: string | null;
  // Histórico de acolhimentos vindo da planilha no cross-match (story 121). A
  // ficha .docx não traz múltiplos pares; o campo é preenchido pela linha casada.
  admissions?: ImportAdmission[];
}

export interface ParseDocxRelative {
  name: string;
  phone: string;
  relationship: string;
}

export interface ParseDocxResult {
  resident: Partial<ParseDocxResident>;
  relatives: ParseDocxRelative[];
  warnings: Record<string, string>;
  houseName: string;
  rawText: string;
  // Data URL (data:<mime>;base64,<...>) of the resident's photo when the document
  // contains a portrait. Null when no photo image is found.
  photoBase64: string | null;
}

const SYSTEM_PROMPT = `Você é um assistente especializado em extrair dados de fichas de acolhimento de comunidades terapêuticas brasileiras.
Extraia os campos abaixo do texto e retorne EXCLUSIVAMENTE um objeto JSON válido, sem markdown, sem explicação.
Use null para campos ausentes ou ilegíveis.`;

const USER_PROMPT_TEMPLATE = (rawText: string, imageCount: number) => `Texto da ficha:
---
${rawText}
---

Retorne um JSON com esta estrutura exata:
{
  "resident": {
    "name": "string | null",
    "birthDate": "YYYY-MM-DD | null",
    "entryDate": "YYYY-MM-DD | null",
    "entryDates": "array de YYYY-MM-DD em ordem crescente quando houver MAIS DE UMA data de acolhimento; null quando houver só uma",
    "gender": "MALE | FEMALE | null",
    "cpf": "string | null (formato: 000.000.000-00)",
    "rg": "string | null",
    "nationality": "string | null",
    "city": "string | null",
    "state": "string | null (sigla UF, ex: SP)",
    "address": "string | null",
    "maritalStatus": "SINGLE | MARRIED | DIVORCED | null",
    "children": "string | null (número como string)",
    "occupation": "string | null",
    "education": "string | null",
    "religion": "string | null",
    "addiction": "string | null",
    "healthIssues": "string | null",
    "continuousMedication": "string | null",
    "weight": "string | null (número em kg)",
    "height": "string | null (número em cm)",
    "familyInvestment": "BASKET_500 | PAYMENT_700 | SOCIAL | NEGOTIATED | null",
    "familyInvestmentAmount": "number | null (valor em reais, sem símbolo)",
    "contributionDueDay": "string | null (dia do mês 1-31 do vencimento da contribuição)",
    "contactPhone": "string | null"
  },
  "relatives": [
    { "name": "string", "phone": "string", "relationship": "string" }
  ],
  "warnings": {
    "nomeDoCampo": "mensagem curta e clara para o operador"
  },
  "houseName": "string (nome da unidade/casa)",
  "photoImageIndex": "number | null (índice da imagem que é a foto do acolhido)"
}

Mapeamento de campos (modelo "FICHA DE ACOLHIMENTO - FILHO|RESIDENTE"):
- "NOME" → name
- "DATA DO ACOLHIMENTO" → entryDate (formato ISO YYYY-MM-DD). O campo PODE conter duas ou mais
  datas (acolhimento original + readmissões), ex: "14/09/2021 03/08/2023". Nesse caso use a data
  MAIS RECENTE como entryDate, liste TODAS as datas em "entryDates" (ordem crescente) e adicione
  warning em "entryDate": "Mais de uma data de acolhimento encontrada na ficha — confirmar o histórico de acolhimentos".
  Com uma única data, deixe "entryDates" como null.
- "DATA DE NASCIMENTO" → birthDate (formato ISO YYYY-MM-DD)
- "IDADE" → ignorar (derivável de birthDate)
- "SEXO" (Masculino/M → MALE, Feminino/F → FEMALE) → gender
- "CPF" → cpf (formatar como 000.000.000-00)
- "RG" → rg (quando existir)
- "NACIONALIDADE" → nationality (quando existir)
- "ENDEREÇO" → address, city e state. No modelo novo o endereço vem completo numa única linha,
  ex: "Rua 2850, nº 150 apto. 601 – Balneário Camboriú - SC". Separe:
    state = sigla UF de 2 letras no final (ex: SC); city = município antes da UF (ex: Balneário Camboriú);
    address = logradouro/número/complemento (sem cidade e UF).
  Se houver linhas separadas "CIDADE"/"MUNICÍPIO" e "UF"/"ESTADO", use-as diretamente.
- "ESTADO CIVIL" (Solteiro→SINGLE, Casado→MARRIED, Divorciado/Separado→DIVORCED) → maritalStatus
- "FILHOS" → children (número como string)
- "PROFISSÃO" ou "PROF" → occupation
- "TELEFONE DE CONTATO" ou "TELEFONE" → relatives + contactPhone. Múltiplos separados por "/" ou "|".
  O formato é número PRIMEIRO, depois o nome, e o grau de parentesco entre parênteses,
  ex: "(47)984037330 Carla (mãe) / (41)99651834 Fernando". Para cada bloco extraia:
    phone = número; name = nome após o número; relationship = texto entre parênteses (vazio se ausente).
  contactPhone = primeiro número da lista.
- "RESPONSÁVEL/ACOLHIMENTO DO FILHO" e o "RESPONSÁVEL" do rodapé → ignorar (não há campo correspondente).
- Seção "INFORMAÇÕES NECESSÁRIAS" (itens numerados — a numeração pode variar, guie-se pelo rótulo):
  - "ATÉ QUE SÉRIE ESTUDOU" / Escolaridade → education
  - "PROBLEMA DE SAÚDE" → healthIssues (se apenas "Sim" sem detalhes, warning: "Confirmar detalhes do problema de saúde")
  - "MEDICAÇÃO" → continuousMedication (se apenas "Sim" sem detalhes, warning: "Confirmar nome e dosagem da medicação")
  - "RELIGIÃO" → religion
  - "DEPENDÊNCIA" / Vícios → addiction
  - "PESO|ALTURA" / "ALTURA|PESO" / "PESO/ALTURA" → height e weight. ATENÇÃO: o rótulo e a ordem dos valores
    NÃO são confiáveis (ora vem peso primeiro, ora altura) e as unidades podem ter erros de digitação (ex "kl").
    Regra de desambiguação por valor (ignore a ordem do rótulo):
      respeite a unidade quando presente — "kg" é PESO, "m"/"cm" é ALTURA;
      o valor decimal pequeno (ex "1,87 m" ou "1,9") é a ALTURA → converta para cm inteiro ("1,87" → "187");
      o valor inteiro entre 30 e 250 é o PESO em kg (ex "74").
    Ex: "74 kg / 1,87 m" → weight "74", height "187". Se não distinguir com segurança, warning em "weight": "Confirmar peso e altura".
  - "INVESTIMENTO DA FAMÍLIA" (pode aparecer como "INVENSTIMENTO") — pode conter valor monetário E/OU uma
    nota sobre o dia de pagamento. Extraia o que houver:
      • Valor monetário (ex "500.00", "R$ 700") → familyInvestmentAmount (número em reais) e familyInvestment
        (~R$500 com cestas→BASKET_500, ~R$700→PAYMENT_700, social/isento→SOCIAL, outro valor→NEGOTIATED).
      • Nota de dia de vencimento (ex "Lembrar dia 26", "dia 26", "vencimento dia 5", "todo dia 10")
        → contributionDueDay = só o número do dia (1-31), ex "26".
      • Se houver APENAS a nota de dia, sem valor/modalidade, deixe familyInvestment e familyInvestmentAmount null
        e adicione warning em "familyInvestment": "A ficha não informa a modalidade de investimento, apenas o dia de pagamento. Selecione a modalidade."
  - "FARÁ O TRATAMENTO NA FONTE" ou "UNIDADE" → houseName

NÃO gere warning nestes casos normais (campo preenchido corretamente, nada a conferir):
- RG ausente/em branco na ficha → deixe "rg" vazio, SEM warning.
- "PROBLEMA DE SAÚDE" marcado como "não"/"ñ"/"nenhum" → deixe "healthIssues" vazio, SEM warning.
- "MEDICAÇÃO" marcada como "não"/"ñ"/"nenhuma" → deixe "continuousMedication" vazio, SEM warning.
- "FILHOS" indicando ausência ("0"/"ñ"/"não"/"nenhum") → registre "children" como "0", SEM warning.
Só avise sobre estes campos quando o dado estiver ilegível ou ambíguo — nunca quando a ausência é clara.

Regras de linguagem dos warnings (campo "warnings"):
- Escreva para um operador SEM conhecimento técnico. Frases curtas, claras, em português natural.
- NUNCA use termos técnicos: "null", "string", "JSON", "campo nulo", "interpretado como", "valor X mapeado para".
- Refira-se ao dado pelo nome comum: "medicação", "peso", "altura", "data de acolhimento", "modalidade de investimento".
- Quando um dado ficou sem preenchimento, diga "ficou em branco" ou "ficou vazio" (NUNCA "null").
- Diga o que foi encontrado na ficha e o que o operador deve conferir.
- Exemplos:
  ❌ "Campo medicação marcado como não, mantido null"
  ✅ "Medicação marcada como 'não' na ficha, então ficou em branco. Confira se está correto."
  ❌ "weight null, ilegível"
  ✅ "Não foi possível ler o peso na ficha. Preencha manualmente."
${
  imageCount > 0
    ? `
Imagens: ${imageCount} imagem(ns) do documento estão anexadas a esta mensagem, na ordem,
com índice começando em 0. Identifique qual delas é a FOTO (retrato) do rosto do acolhido/residente.
IGNORE logotipos, brasões, símbolos institucionais (ex: logo "Fonte de Misericórdia"), assinaturas e carimbos.
Defina "photoImageIndex" com o índice da foto do acolhido, ou null se nenhuma imagem for um retrato de pessoa.`
    : `
Não há imagens anexadas. Defina "photoImageIndex" como null.`
}`;

/**
 * Extracts a JSON object from the model response, tolerating markdown code
 * fences (```json ... ```) and surrounding prose. Falls back to the substring
 * between the first `{` and the last `}`.
 */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return candidate.slice(start, end + 1);
  }
  return candidate;
}

@Injectable()
export class DocxParserService {
  private readonly logger = new Logger(DocxParserService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Extracts raster images embedded in a .docx (word/media/*) in document order,
   * skipping unsupported vector formats (EMF/WMF). The model max is 5MB/image, so
   * anything larger is dropped to keep the request valid.
   */
  private async extractImages(buffer: Buffer): Promise<DocxImage[]> {
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      return [];
    }

    const entries = Object.values(zip.files)
      .filter((f) => !f.dir && /^word\/media\/.+\.(jpe?g|png|gif|webp)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const images: DocxImage[] = [];
    for (const entry of entries) {
      const ext = entry.name.split('.').pop()!.toLowerCase();
      const mime = SUPPORTED_IMAGE_MIME[ext];
      if (!mime) continue;
      const data = await entry.async('nodebuffer');
      if (data.length > MAX_IMAGE_BYTES) continue;
      images.push({ mime, base64: data.toString('base64') });
    }
    return images;
  }

  async parseDocx(buffer: Buffer): Promise<ParseDocxResult> {
    const { value: rawText } = await mammoth.extractRawText({ buffer });
    const images = await this.extractImages(buffer);

    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('ANTHROPIC_API_KEY não configurada');
    }

    // Interleave an index label before each image so the model can reference them
    // unambiguously by index in its photoImageIndex answer.
    const imageBlocks: Anthropic.ContentBlockParam[] = images.flatMap((img, i) => [
      { type: 'text', text: `Imagem índice ${i}:` },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: img.base64,
        },
      },
    ]);

    const content: Anthropic.ContentBlockParam[] = [
      { type: 'text', text: USER_PROMPT_TEMPLATE(rawText, images.length) },
      ...imageBlocks,
    ];

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const json = extractJson(text);

    let parsed: ParseDocxResult & { photoImageIndex?: number | null };
    try {
      parsed = JSON.parse(json);
    } catch {
      this.logger.error(
        `Falha ao parsear resposta da IA (stop_reason=${message.stop_reason}). Resposta bruta:\n${text}`,
      );
      throw new BadRequestException('IA retornou resposta inválida. Tente novamente.');
    }

    const idx = parsed.photoImageIndex;
    const photo = typeof idx === 'number' && idx >= 0 && idx < images.length ? images[idx] : null;
    const photoBase64 = photo ? `data:${photo.mime};base64,${photo.base64}` : null;

    delete parsed.photoImageIndex;
    return { ...parsed, warnings: sanitizeWarnings(parsed.warnings), rawText, photoBase64 };
  }
}

/**
 * Safety net: replaces technical jargon that may slip into AI-generated warning
 * messages with plain language for non-technical operators.
 */
function sanitizeWarnings(warnings: Record<string, string> | undefined): Record<string, string> {
  if (!warnings) return {};
  const result: Record<string, string> = {};
  for (const [key, message] of Object.entries(warnings)) {
    if (typeof message !== 'string') continue;
    result[key] = message
      .replace(/\bnulls?\b/gi, 'vazio')
      .replace(/\bem branco \(vazio\)\b/gi, 'em branco');
  }
  return result;
}
