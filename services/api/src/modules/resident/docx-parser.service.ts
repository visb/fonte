import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import * as mammoth from 'mammoth';

export interface ParseDocxResident {
  name: string | null;
  birthDate: string | null;
  entryDate: string | null;
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
  contactPhone: string | null;
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
}

const SYSTEM_PROMPT = `Você é um assistente especializado em extrair dados de fichas de acolhimento de comunidades terapêuticas brasileiras.
Extraia os campos abaixo do texto e retorne EXCLUSIVAMENTE um objeto JSON válido, sem markdown, sem explicação.
Use null para campos ausentes ou ilegíveis.`;

const USER_PROMPT_TEMPLATE = (rawText: string) => `Texto da ficha:
---
${rawText}
---

Retorne um JSON com esta estrutura exata:
{
  "resident": {
    "name": "string | null",
    "birthDate": "YYYY-MM-DD | null",
    "entryDate": "YYYY-MM-DD | null",
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
    "contactPhone": "string | null"
  },
  "relatives": [
    { "name": "string", "phone": "string", "relationship": "string" }
  ],
  "warnings": {
    "campo": "mensagem descritiva sobre ambiguidade"
  },
  "houseName": "string (nome da unidade/casa)"
}

Mapeamento de campos (modelo "FICHA DE ACOLHIMENTO - FILHO|RESIDENTE"):
- "NOME" → name
- "DATA DO ACOLHIMENTO" → entryDate (formato ISO YYYY-MM-DD). O campo PODE conter duas datas
  (acolhimento original + readmissão), ex: "14/09/2021 03/08/2023". Nesse caso use a data MAIS
  RECENTE como entryDate e adicione warning em "entryDate": "Duas datas de acolhimento encontradas — confirmar a correta".
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
  - "PESO|ALTURA" / "ALTURA|PESO" → height e weight. ATENÇÃO: o rótulo e a ordem dos valores podem não bater
    e as unidades podem ter erros de digitação (ex "kl"). Regra de desambiguação:
      o valor decimal pequeno (ex 1,92 ou "1,9 m") é a ALTURA → converta para cm inteiro (1,92 → "192");
      o valor inteiro entre 30 e 250 é o PESO em kg (ex "80").
    Se não der para distinguir com segurança, adicione warning em "weight": "Confirmar peso e altura".
  - "INVESTIMENTO DA FAMÍLIA" (pode aparecer como "INVENSTIMENTO") → familyInvestment + familyInvestmentAmount.
    familyInvestmentAmount = valor numérico em reais (ex "500.00" → 500).
    familyInvestment: ~R$500 (cestas)→BASKET_500, ~R$700→PAYMENT_700, social/isento→SOCIAL, outro valor→NEGOTIATED.
  - "FARÁ O TRATAMENTO NA FONTE" ou "UNIDADE" → houseName`;

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

  async parseDocx(buffer: Buffer): Promise<ParseDocxResult> {
    const { value: rawText } = await mammoth.extractRawText({ buffer });

    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('ANTHROPIC_API_KEY não configurada');
    }

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: USER_PROMPT_TEMPLATE(rawText) }],
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const json = extractJson(text);

    let parsed: ParseDocxResult;
    try {
      parsed = JSON.parse(json);
    } catch {
      this.logger.error(
        `Falha ao parsear resposta da IA (stop_reason=${message.stop_reason}). Resposta bruta:\n${text}`,
      );
      throw new BadRequestException('IA retornou resposta inválida. Tente novamente.');
    }

    return { ...parsed, rawText };
  }
}
