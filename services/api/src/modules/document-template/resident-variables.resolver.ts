import { Resident } from '../resident/resident.entity';
import { Relative } from '../relative/relative.entity';
import {
  buildSignatureBlock,
  computeAge,
  formatCpf,
  formatDate,
  formatDateLong,
  type DocumentSigner,
  type DocumentVariableResolver,
  type DocumentVariables,
} from './document-variables';

/**
 * Story 178 — resolver do documento do FILHO.
 *
 * É o `applyVariables` de sempre, movido para trás do contrato
 * `DocumentVariableResolver` sem NENHUMA mudança de saída: cada token imprime
 * exatamente o que imprimia antes (os specs de regressão são o gate disso).
 * O que muda é só quem monta o dicionário — o que abre espaço para o recibo,
 * que não tem filho nenhum.
 *
 * Tudo que é assíncrono (URL assinada da assinatura e da foto) chega
 * PRÉ-RESOLVIDO no construtor, pela mesma razão de sempre (decisão 7 da story
 * 76): quem monta o dicionário não pode aguardar o `signUrl`.
 */
export class ResidentVariablesResolver implements DocumentVariableResolver {
  constructor(
    private readonly resident: Resident,
    private readonly responsible: Relative | null,
    private readonly signer: DocumentSigner | null,
    private readonly residentPhotoUrl: string | null,
  ) {}

  private static readonly MARITAL_PT: Record<string, string> = {
    SINGLE: 'Solteiro(a)',
    MARRIED: 'Casado(a)',
    STABLE_UNION: 'União estável',
    DIVORCED: 'Divorciado(a)',
    WIDOWED: 'Viúvo(a)',
  };

  /**
   * Story 153 — variável ÚNICA e condicional para o rótulo de assinatura do
   * familiar responsável. Substitui o rodapé escrito à mão
   * `{{responsibleName}}({{responsibleRelationship}})`, que imprimia
   * `não informado(não informado)` quando o acolhido não tinha responsável.
   *
   *   nome + parentesco → `Maria Souza (Mãe)`  (com espaço antes do parêntese)
   *   nome sem parentesco → `Maria Souza`      (sem parênteses vazios)
   *   sem responsável / nome em branco → `Responsável` (rótulo da linha)
   *
   * `relationship` é texto livre: sai como foi digitado, sem tradução. O
   * `trim()` vale para os dois campos, então espaços em branco contam como
   * ausência.
   */
  private buildResponsibleWithRelationship(): string {
    const name = this.responsible?.name?.trim();
    if (!name) return 'Responsável';
    const rel = this.responsible?.relationship?.trim();
    return rel ? `${name} (${rel})` : name;
  }

  // Síncrono por dentro; a Promise existe só para casar com o contrato (o
  // resolver do recibo também não precisa de I/O, mas outros podem precisar).
  async resolve(): Promise<DocumentVariables> {
    const resident = this.resident;
    const responsible = this.responsible;
    return {
      text: {
        name: resident.name ?? '',
        cpf: formatCpf(resident.cpf),
        rg: resident.rg ?? 'não informado',
        nationality: resident.nationality ?? 'não informado',
        city: resident.city ?? 'não informado',
        state: resident.state ?? 'não informado',
        birthDate: formatDate(resident.birthDate as Date | null),
        age: computeAge(resident.birthDate as Date | null),
        maritalStatus: resident.maritalStatus
          ? (ResidentVariablesResolver.MARITAL_PT[resident.maritalStatus] ?? resident.maritalStatus)
          : 'não informado',
        address: resident.address ?? 'não informado',
        phone: resident.contactPhone ?? 'não informado',
        house: resident.house?.name ?? '',
        houseName: resident.house?.name ?? '',
        houseAddress: resident.house?.address ?? 'não informado',
        houseCity: resident.house?.city ?? 'não informado',
        houseState: resident.house?.state ?? 'não informado',
        entryDate: formatDate(resident.entryDate as Date | null),
        // Story 159 — DIVERGE de propósito das demais datas: sem saída imprime
        // 'não informado' (fallback de `rg`/`city`/`address`) em vez do traço
        // `___/___/______` que `formatDate(null)` devolve. Filho SEM saída é o
        // caso normal (está ativo) e o traço convidaria a preencher à mão uma
        // data que não existe.
        exitDate: resident.exitDate
          ? formatDate(resident.exitDate as Date | null)
          : 'não informado',
        date: formatDate(new Date()),
        dateLong: formatDateLong(new Date()),
        responsibleName: responsible?.name ?? 'não informado',
        responsibleRelationship: responsible?.relationship ?? 'não informado',
        responsibleWithRelationship: this.buildResponsibleWithRelationship(),
        responsiblePhone: responsible?.phone ?? 'não informado',
      },
      blocks: {
        '{{signature}}': (align) => buildSignatureBlock(this.signer, align),
        // Story 157 — foto do acolhido. Sem foto (`null`), o bloco vira a
        // moldura vazia: nunca sobra `{{residentPhoto}}` cru no papel.
        '{{residentPhoto}}': (align) =>
          buildResidentPhotoBlock(this.residentPhotoUrl, align),
      },
    };
  }
}

/**
 * Story 157 — bloco da foto do acolhido ({{residentPhoto}}). Com foto, a
 * imagem em quadrado fixo (CSS `.doc-photo-img`, 151px ≈ 4 cm); sem foto, a
 * MOLDURA VAZIA rotulada "Foto" — análogo direto da linha de 25 "_" que a
 * assinatura imprime quando não há imagem: o papel sai com o espaço reservado
 * para colar a foto à mão, e o documento nunca imprime {{residentPhoto}} cru.
 * `align` funciona igual ao bloco de assinatura (story 136).
 */
export function buildResidentPhotoBlock(photoUrl: string | null, align?: string): string {
  const inner = photoUrl
    ? `<img class="doc-photo-img" src="${photoUrl}" alt="Foto"/>`
    : '<div class="doc-photo-placeholder">Foto</div>';
  const style = align ? ` style="text-align:${align}"` : '';
  return `<div class="doc-photo"${style}>${inner}</div>`;
}
