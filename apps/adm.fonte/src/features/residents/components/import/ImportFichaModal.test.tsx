import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    residents: { checkImportConflict: vi.fn(), commitImport: vi.fn() },
    houses: { list: vi.fn() },
  },
}));

import { api } from '@/lib/api';
import { renderWithClient } from '@/test/utils';
import { ImportFichaModal } from './ImportFichaModal';
import type { ImportQueueItem } from '../../hooks/useBulkImport';

function item(over: Partial<ImportQueueItem['preview']> = {}): ImportQueueItem {
  return {
    id: 'i1',
    fileName: 'ficha.docx',
    status: 'ready',
    error: null,
    preview: {
      resident: { name: 'João Silva', cpf: '12345678900', entryDate: '2023-02-10' },
      relatives: [{ name: 'Maria', phone: '999998888', relationship: 'Mãe' }],
      warnings: {},
      houseName: 'Casa A',
      rawText: '',
      photoBase64: null,
      matchedHouseName: 'Casa A',
      contributionMonths: ['2023-02-01'],
      matchStatus: 'matched',
      ...over,
    },
  } as ImportQueueItem;
}

async function renderModal(over?: Partial<ImportQueueItem['preview']>, props?: { sessionConflictName?: string }) {
  const onApproved = vi.fn();
  const onClose = vi.fn();
  const utils = renderWithClient(
    <ImportFichaModal
      item={item(over)}
      open
      onClose={onClose}
      onApproved={onApproved}
      sessionConflictName={props?.sessionConflictName ?? null}
    />,
  );
  // espera casas carregarem (auto-match da casa)
  await waitFor(() => expect(api.houses.list).toHaveBeenCalled());
  return { ...utils, onApproved, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.residents.checkImportConflict).mockResolvedValue({ conflicts: [] } as never);
  vi.mocked(api.houses.list).mockResolvedValue([{ id: 'h1', name: 'Casa A' }] as never);
  vi.mocked(api.residents.commitImport).mockResolvedValue({
    resident: { id: 'r1' },
    contributionsCreated: { created: 1, skipped: 0 },
  } as never);
});
afterEach(() => cleanup());

describe('ImportFichaModal', () => {
  it('pré-carrega os campos com o preview', async () => {
    await renderModal();
    expect(screen.getByPlaceholderText('Nome do acolhido')).toHaveValue('João Silva');
    expect(screen.getByPlaceholderText('000.000.000-00')).toHaveValue('12345678900');
    // familiar do preview pré-carregado
    expect(screen.getByLabelText('Nome do familiar 1')).toHaveValue('Maria');
  });

  it('assume UF "PR" no lote quando o preview não traz UF', async () => {
    await renderModal();
    expect(screen.getByPlaceholderText('Ex: SP')).toHaveValue('PR');
  });

  it('mostra a data de saída e carrega a exitDate do preview (story 120)', async () => {
    await renderModal({
      resident: { name: 'João Silva', cpf: '12345678900', entryDate: '2023-01-10', exitDate: '2023-08-10' },
    });
    expect(screen.getByText('Data de saída')).toBeInTheDocument();
    const exitInput = document.querySelector('input[name="exitDate"]') as HTMLInputElement;
    expect(exitInput.value).toBe('2023-08-10');
  });

  it('envia a exitDate no payload do commit (backend deriva ALTA/EVASÃO)', async () => {
    const { onApproved } = await renderModal({
      resident: { name: 'João Silva', cpf: '12345678900', entryDate: '2023-01-10', exitDate: '2023-08-10' },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprovar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(onApproved).toHaveBeenCalledWith('i1'));
    const payload = vi.mocked(api.residents.commitImport).mock.calls[0][0];
    expect((payload.resident as { exitDate?: unknown }).exitDate).toBe('2023-08-10');
  });

  it('mostra os acolhimentos detectados e os envia no payload do commit (story 121)', async () => {
    const admissions = [
      { entryDate: '2022-01-10', exitDate: '2022-09-10' },
      { entryDate: '2023-03-01', exitDate: '2023-05-01' },
    ];
    const { onApproved } = await renderModal({
      resident: {
        name: 'João Silva',
        cpf: '12345678900',
        entryDate: '2023-03-01',
        exitDate: '2023-05-01',
        admissions,
      },
    });

    // bloco read-only visível com os pares + status previsto
    const list = screen.getByRole('list', { name: 'Acolhimentos detectados' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('10/01/2022');
    expect(items[0]).toHaveTextContent('Alta');
    expect(items[1]).toHaveTextContent('Evasão');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprovar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(onApproved).toHaveBeenCalledWith('i1'));

    const payload = vi.mocked(api.residents.commitImport).mock.calls[0][0];
    expect((payload.resident as { admissions?: unknown }).admissions).toEqual(admissions);
  });

  it('não exibe o bloco de acolhimentos quando há só um (o topo do resident)', async () => {
    await renderModal({
      resident: {
        name: 'João Silva',
        cpf: '12345678900',
        entryDate: '2023-03-01',
        exitDate: '2023-11-01',
        admissions: [{ entryDate: '2023-03-01', exitDate: '2023-11-01' }],
      },
    });
    expect(screen.queryByText('Acolhimentos detectados')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprovar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(api.residents.commitImport).toHaveBeenCalled());
    const payload = vi.mocked(api.residents.commitImport).mock.calls[0][0];
    // um único acolhimento não vira Admission extra → sem campo admissions
    expect((payload.resident as { admissions?: unknown }).admissions).toBeUndefined();
  });

  it('preserva a UF extraída do preview no lote', async () => {
    await renderModal({ resident: { name: 'João Silva', cpf: '12345678900', state: 'SC' } });
    expect(screen.getByPlaceholderText('Ex: SP')).toHaveValue('SC');
  });

  it('edição de um campo altera o payload enviado no commit', async () => {
    const { onApproved } = await renderModal();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprovar' })).toBeEnabled());

    fireEvent.change(screen.getByPlaceholderText('Nome do acolhido'), { target: { value: 'João Editado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));

    await waitFor(() => expect(onApproved).toHaveBeenCalledWith('i1'));
    const payload = vi.mocked(api.residents.commitImport).mock.calls[0][0];
    expect(payload.resident.name).toBe('João Editado');
    expect(payload.resident.houseId).toBe('h1');
    expect(payload.relatives).toEqual([{ name: 'Maria', phone: '(41) 99999-8888', relationship: 'Mãe' }]);
    expect(payload.contributionMonths).toEqual(['2023-02-01']);
  });

  it('zod barra o submit quando o nome fica vazio', async () => {
    await renderModal();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprovar' })).toBeEnabled());

    fireEvent.change(screen.getByPlaceholderText('Nome do acolhido'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));

    await waitFor(() => expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument());
    expect(api.residents.commitImport).not.toHaveBeenCalled();
  });

  it('desabilita Aprovar quando há conflito com filho já cadastrado', async () => {
    vi.mocked(api.residents.checkImportConflict).mockResolvedValue({
      conflicts: [{ id: 'r9', name: 'João Duplicado', cpf: '12345678900', status: 'ACTIVE', houseName: 'Casa A' }],
    } as never);
    await renderModal();
    await waitFor(() =>
      expect(screen.getByText(/Já existe um filho cadastrado que confere: João Duplicado/)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeDisabled();
  });

  it('desabilita Aprovar quando há conflito de sessão', async () => {
    await renderModal(undefined, { sessionConflictName: 'João Silva' });
    await waitFor(() =>
      expect(screen.getByText(/Já importado nesta sessão: João Silva/)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeDisabled();
  });

  it('desabilita Aprovar sem nenhum familiar preenchido', async () => {
    await renderModal({ relatives: [] });
    await waitFor(() => expect(api.residents.checkImportConflict).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeDisabled();
  });

  it('mostra a mensagem de erro quando o commit falha', async () => {
    vi.mocked(api.residents.commitImport).mockRejectedValue({
      response: { data: { message: 'conflito no servidor' } },
    });
    await renderModal();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprovar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(screen.getByText('conflito no servidor')).toBeInTheDocument());
  });

  it('mostra a foto e normaliza familiar sem telefone/parentesco no payload', async () => {
    const { onApproved } = await renderModal({
      photoBase64: 'data:image/png;base64,zzz',
      relatives: [{ name: 'Ana', phone: '', relationship: '' }],
    });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,zzz');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprovar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(onApproved).toHaveBeenCalled());
    const payload = vi.mocked(api.residents.commitImport).mock.calls[0][0];
    expect(payload.relatives).toEqual([{ name: 'Ana', phone: null, relationship: null }]);
    expect(payload.photoBase64).toBe('data:image/png;base64,zzz');
  });

  it('cancelar fecha o modal', async () => {
    const { onClose } = await renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renderiza a seção de alertas com os warnings do preview', async () => {
    await renderModal({
      warnings: {
        entryDate: 'ficha=2023-02-10, planilha=2023-03-01',
        spreadsheet: 'Nenhum filho da planilha corresponde a esta ficha.',
        empty: '',
      },
    });
    expect(screen.getByText(/precisam de revisão manual/)).toBeInTheDocument();
    expect(screen.getByText('Data de entrada:')).toBeInTheDocument();
    expect(screen.getByText(/ficha=2023-02-10, planilha=2023-03-01/)).toBeInTheDocument();
    expect(screen.getByText('Planilha:')).toBeInTheDocument();
    // Sem botão de dispensa: no lote a seção é só visualização.
    expect(screen.queryByLabelText('Dispensar alerta')).not.toBeInTheDocument();
  });

  it('não renderiza a seção de alertas sem warnings', async () => {
    await renderModal();
    expect(screen.queryByText(/precisam de revisão manual/)).not.toBeInTheDocument();
  });

  it('lista o histórico de contribuição vindo do preview', async () => {
    await renderModal({ contributionMonths: ['2023-01-01', '2023-02-01'] });
    const list = screen.getByRole('list', { name: 'Histórico de contribuição' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(list).toHaveTextContent('Janeiro/2023');
    expect(list).toHaveTextContent('Fevereiro/2023');
  });

  it('mostra estado vazio de contribuição quando o preview não traz competências', async () => {
    await renderModal({ contributionMonths: [] });
    expect(
      screen.queryByRole('list', { name: 'Histórico de contribuição' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Nenhuma contribuição registrada na planilha.')).toBeInTheDocument();
  });
});
