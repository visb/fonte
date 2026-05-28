import { Injectable, BadRequestException } from '@nestjs/common';
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

Mapeamento de campos:
- "NOME" → name
- "DATA DO ACOLHIMENTO" → entryDate (formato ISO YYYY-MM-DD)
- "DATA DE NASCIMENTO" → birthDate (formato ISO YYYY-MM-DD)
- "SEXO" (Masculino/M → MALE, Feminino/F → FEMALE) → gender
- "CPF" → cpf (formatar como 000.000.000-00)
- "RG" → rg
- "ENDEREÇO" → address
- "ESTADO CIVIL" (Solteiro→SINGLE, Casado→MARRIED, Divorciado/Separado→DIVORCED) → maritalStatus
- "FILHOS" → children (número como string)
- "PROFISSÃO" ou "PROF" → occupation
- "TELEFONE" → relatives (múltiplos separados por / ou |, com nome e grau de parentesco em parênteses; extraia contactPhone do primeiro telefone sem nome associado)
- Seção "INFORMAÇÕES NECESSÁRIAS":
  1. Escolaridade → education
  2. Problema de saúde → healthIssues (se apenas "Sim" sem detalhes, adicione warning: "Confirmar detalhes do problema de saúde")
  3. Medicação contínua → continuousMedication (se apenas "Sim" sem detalhes, adicione warning: "Confirmar nome e dosagem da medicação")
  4. Religião → religion
  5. Vícios/Dependência → addiction
  6. Altura / Peso → height (cm, número como string) e weight (kg, número como string)
  7. Investimento familiar → familyInvestment (R$500+cestas→BASKET_500, R$700→PAYMENT_700, Social→SOCIAL, outro valor→NEGOTIATED)
- "FARÁ O TRATAMENTO NA FONTE" ou "UNIDADE" → houseName`;

@Injectable()
export class DocxParserService {
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
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: USER_PROMPT_TEMPLATE(rawText) }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';

    let parsed: ParseDocxResult;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BadRequestException('IA retornou resposta inválida. Tente novamente.');
    }

    return { ...parsed, rawText };
  }
}
