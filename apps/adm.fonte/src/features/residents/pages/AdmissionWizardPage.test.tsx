import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RESIDENT_CPF_IN_USE_CODE, todayInSaoPaulo } from '@fonte/types';
import {
  admissionDraftKey,
  readAdmissionDraft,
  writeAdmissionDraft,
  type AdmissionDraftData,
} from '../lib/admissionDraft';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ userId: 'u1' }) }));
vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [{ id: 'h1', name: 'Casa Belém' }], isLoading: false }),
}));
vi.mock('@/features/houses/hooks/useHouseMinistries', () => ({
  useHouseMinistriesList: () => ({ data: [], isSuccess: true }),
}));
vi.mock('@/features/settings/hooks/useDocumentTemplates', () => ({
  useDocumentTemplates: () => ({ data: [] }),
}));
vi.mock('@/components/AvatarUpload', () => ({
  AvatarUpload: ({ onBlobChange }: { onBlobChange: (b: Blob) => void }) => (
    <button type="button" onClick={() => onBlobChange(new Blob(['x']))}>escolher foto</button>
  ),
}));
vi.mock('../components/tabs/RelativesTab', () => ({
  RelativesTab: ({ residentId }: { residentId: string }) => <div>familiares de {residentId}</div>,
}));
vi.mock('../components/tabs/AttachmentsTab', () => ({
  AttachmentsTab: ({ residentId }: { residentId: string }) => <div>anexos de {residentId}</div>,
}));

const mutateAsync = vi.fn();
let residentError: unknown = null;
vi.mock('../hooks/useResidents', () => ({
  useCreateResident: () => ({ mutateAsync }),
  useResidentById: (id: string) =>
    id ? { data: residentError ? undefined : { id, status: 'ACTIVE' }, error: residentError } : { data: undefined, error: null },
  useResidentDocuments: () => ({ data: [] }),
}));

const update = vi.fn();
const createFollowUp = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    residents: {
      update: (...a: unknown[]) => update(...a),
      createFollowUp: (...a: unknown[]) => createFollowUp(...a),
      uploadFollowUpAttachment: vi.fn(),
    },
  },
}));

import { AdmissionWizardPage } from './AdmissionWizardPage';

const KEY = admissionDraftKey('u1');
const today = todayInSaoPaulo();

function seedDraft(overrides: Partial<AdmissionDraftData> = {}) {
  writeAdmissionDraft(KEY, {
    values: { name: 'Fulano Rascunho', entryDate: today, houseId: 'h1' },
    step: 1,
    residentId: null,
    firstPaymentPaid: false,
    firstPaymentMethod: '',
    hadPhoto: false,
    hadProof: false,
    ...overrides,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdmissionWizardPage />
    </MemoryRouter>,
  );
}

const nameInput = () => document.querySelector('input[name="name"]') as HTMLInputElement;
const houseSelect = () => document.querySelector('select[name="houseId"]') as HTMLSelectElement;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  residentError = null;
  update.mockResolvedValue({});
});
afterEach(() => cleanup());

describe('AdmissionWizardPage — rascunho (story 211)', () => {
  it('sem rascunho abre o wizard direto, sem banner', () => {
    renderPage();
    expect(screen.queryByRole('region', { name: 'Rascunho de acolhimento' })).not.toBeInTheDocument();
    expect(nameInput()).toBeInTheDocument();
  });

  it('rascunho nos passos 1–2: Continuar restaura os campos e o passo', async () => {
    seedDraft();
    renderPage();
    expect(screen.getByText('Fulano Rascunho')).toBeInTheDocument();
    expect(nameInput()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(houseSelect()).toBeInTheDocument());
    expect(houseSelect().value).toBe('h1');

    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));
    await waitFor(() => expect(nameInput()).toBeInTheDocument());
    expect(nameInput().value).toBe('Fulano Rascunho');
  });

  it('rascunho com residentId abre no passo 3 sem chamar create (duplicidade)', async () => {
    seedDraft({ step: 2, residentId: 'r1' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('familiares de r1')).toBeInTheDocument();

    // Voltar até a Admissão e avançar de novo atualiza o mesmo filho.
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));
    await waitFor(() => expect(houseSelect()).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('r1', expect.anything()));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('residentId com 404 descarta o rascunho e avisa', async () => {
    residentError = { response: { status: 404 } };
    seedDraft({ step: 2, residentId: 'sumiu' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByText('O filho deste rascunho não existe mais. O rascunho foi descartado.'),
    ).toBeInTheDocument();
    expect(nameInput()).toBeInTheDocument();
    expect(nameInput().value).toBe('');
    expect(readAdmissionDraft(KEY)).toBeNull();
  });

  it('concluir apaga o rascunho', async () => {
    seedDraft({ step: 3, residentId: 'r1' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(await screen.findByRole('button', { name: /Concluir acolhimento/ }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/residents/r1?tab=overview'));
    expect(readAdmissionDraft(KEY)).toBeNull();
  });

  it('erro ao concluir mantém o rascunho', async () => {
    update.mockRejectedValue({ response: { data: { message: 'falhou' } } });
    seedDraft({ step: 3, residentId: 'r1' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(await screen.findByRole('button', { name: /Concluir acolhimento/ }));
    expect(await screen.findByText('falhou')).toBeInTheDocument();
    expect(readAdmissionDraft(KEY)).not.toBeNull();
  });

  it('Descartar apaga e abre o wizard vazio', () => {
    seedDraft();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(readAdmissionDraft(KEY)).toBeNull();
    expect(nameInput().value).toBe('');
  });

  it('rascunho que tinha foto e comprovante pede para reanexar', () => {
    seedDraft({ hadPhoto: true, hadProof: true, firstPaymentPaid: true, firstPaymentMethod: 'PIX' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      screen.getByText('A foto e o comprovante do 1º pagamento não ficam no rascunho. Anexe-os novamente.'),
    ).toBeInTheDocument();
  });

  it.each([
    [{ hadPhoto: true }, 'A foto não fica no rascunho. Anexe-a novamente.'],
    [{ hadProof: true }, 'O comprovante do 1º pagamento não fica no rascunho. Anexe-o novamente.'],
  ])('aviso de reanexar só do que faltou (%o)', (flags, message) => {
    seedDraft(flags);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('com o filho já criado, não pede para reanexar a foto', async () => {
    seedDraft({ step: 2, residentId: 'r1', hadPhoto: true });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText('familiares de r1');
    expect(screen.queryByText(/não fica no rascunho/)).not.toBeInTheDocument();
  });

  it('Cancelar sem dados sai direto', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(navigate).toHaveBeenCalledWith('/residents/admission');
  });

  it('digitar salva o rascunho; Cancelar confirma e apaga', async () => {
    renderPage();
    fireEvent.change(nameInput(), { target: { value: 'Novo Filho' } });
    await waitFor(() => expect(readAdmissionDraft(KEY)?.values).toMatchObject({ name: 'Novo Filho' }), {
      timeout: 2500,
    });
    expect(screen.getByText(/Rascunho salvo às/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar e sair' }));
    expect(navigate).toHaveBeenCalledWith('/residents/admission');
    expect(readAdmissionDraft(KEY)).toBeNull();
  });

  it('criar o filho grava o residentId no rascunho na hora', async () => {
    mutateAsync.mockResolvedValue({ id: 'novo1' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'escolher foto' }));
    fireEvent.change(nameInput(), { target: { value: 'Criado Agora' } });
    fireEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    await waitFor(() => expect(houseSelect()).toBeInTheDocument());
    expect(readAdmissionDraft(KEY)).toMatchObject({ step: 1, hadPhoto: true });

    fireEvent.change(houseSelect(), { target: { value: 'h1' } });
    fireEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    expect(await screen.findByText('familiares de novo1')).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(readAdmissionDraft(KEY)).toMatchObject({ step: 2, residentId: 'novo1' });
  });
});

describe('AdmissionWizardPage — CPF do filho (story 219)', () => {
  const cpfInput = () => document.querySelector('input[name="cpf"]') as HTMLInputElement;

  it('CPF inválido segura a ficha com "CPF inválido."', async () => {
    renderPage();
    fireEvent.change(nameInput(), { target: { value: 'Filho CPF' } });
    fireEvent.change(cpfInput(), { target: { value: '12345678900' } });
    fireEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    expect(await screen.findByText('CPF inválido.')).toBeInTheDocument();
    expect(houseSelect()).toBeNull();
  });

  it('409 de CPF em uso volta à ficha com o erro no campo e o link', async () => {
    mutateAsync.mockRejectedValue({
      response: {
        status: 409,
        data: {
          code: RESIDENT_CPF_IN_USE_CODE,
          message: 'Já existe um filho com este CPF: Bruno (Alta).',
          conflictResidentId: 'r9',
        },
      },
    });
    renderPage();
    fireEvent.change(nameInput(), { target: { value: 'Filho CPF' } });
    fireEvent.change(cpfInput(), { target: { value: '52998224725' } });
    fireEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    await waitFor(() => expect(houseSelect()).toBeInTheDocument());
    fireEvent.change(houseSelect(), { target: { value: 'h1' } });
    fireEvent.click(screen.getByRole('button', { name: /Avançar/ }));

    expect(await screen.findByText(/Já existe um filho com este CPF: Bruno \(Alta\)\./)).toBeInTheDocument();
    expect(cpfInput()).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver cadastro' })).toHaveAttribute('href', '/residents/r9');
    expect(mutateAsync.mock.calls[0][0].data.cpf).toBe('52998224725');
  });
});
