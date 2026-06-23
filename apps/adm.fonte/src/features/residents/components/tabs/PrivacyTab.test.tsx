import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const { grantMutate, revokeMutate, anonymizeMutate, exportData } = vi.hoisted(() => ({
  grantMutate: vi.fn(),
  revokeMutate: vi.fn(),
  anonymizeMutate: vi.fn(),
  exportData: vi.fn(),
}));

let consentsResult: { data: unknown[]; isLoading: boolean } = { data: [], isLoading: false };
let auditResult: { data: unknown[]; isLoading: boolean } = { data: [], isLoading: false };

vi.mock('../../hooks/usePrivacy', () => ({
  useResidentConsents: () => consentsResult,
  useGrantConsent: () => ({ mutate: grantMutate, isPending: false }),
  useRevokeConsent: () => ({ mutate: revokeMutate, isPending: false }),
  useResidentAudit: () => auditResult,
  useAnonymizeResident: () => ({ mutate: anonymizeMutate, isPending: false }),
}));
vi.mock('@/lib/api', () => ({ api: { residents: { exportData } } }));

import { PrivacyTab } from './PrivacyTab';

beforeEach(() => {
  vi.clearAllMocks();
  consentsResult = { data: [], isLoading: false };
  auditResult = { data: [], isLoading: false };
});
afterEach(() => cleanup());

describe('PrivacyTab', () => {
  it('loading mostra estado de carregamento', () => {
    consentsResult = { data: [], isLoading: true };
    const { container } = render(<PrivacyTab residentId="r1" residentName="Filho A" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renderiza linhas de consentimento (sem consentimento por padrão)', () => {
    render(<PrivacyTab residentId="r1" residentName="Filho A" />);
    expect(screen.getByText('Uso de imagem / divulgação')).toBeInTheDocument();
    expect(screen.getByText('Divulgação religiosa / testemunho')).toBeInTheDocument();
    expect(screen.getAllByText('Sem consentimento').length).toBe(2);
  });

  it('registrar consentimento dispara grant com o purpose', () => {
    render(<PrivacyTab residentId="r1" residentName="Filho A" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar' })[0]);
    expect(grantMutate).toHaveBeenCalledWith('IMAGE_PUBLICATION');
  });

  it('consentimento concedido mostra "Revogar" e dispara revoke', () => {
    consentsResult = {
      data: [{ purpose: 'IMAGE_PUBLICATION', granted: true, since: '2026-01-01' }],
      isLoading: false,
    };
    render(<PrivacyTab residentId="r1" residentName="Filho A" />);
    fireEvent.click(screen.getByRole('button', { name: 'Revogar' }));
    expect(revokeMutate).toHaveBeenCalledWith('IMAGE_PUBLICATION');
  });

  it('exportar dados chama api.residents.exportData', async () => {
    exportData.mockResolvedValue({ ok: true });
    render(<PrivacyTab residentId="r1" residentName="Filho A" />);
    fireEvent.click(screen.getByRole('button', { name: /Exportar dados/ }));
    await waitFor(() => expect(exportData).toHaveBeenCalledWith('r1'));
  });

  it('ver trilha de auditoria mostra "Nenhum registro" quando vazio', () => {
    render(<PrivacyTab residentId="r1" residentName="Filho A" />);
    fireEvent.click(screen.getByRole('button', { name: /Ver trilha de auditoria/ }));
    expect(screen.getByText('Nenhum registro de acesso.')).toBeInTheDocument();
  });

  it('confirmar anonimização dispara anonymize', () => {
    render(<PrivacyTab residentId="r1" residentName="Filho A" />);
    fireEvent.click(screen.getByRole('button', { name: /Anonimizar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anonimização' }));
    expect(anonymizeMutate).toHaveBeenCalled();
  });
});
