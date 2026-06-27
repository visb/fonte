import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegistrationFileField } from './RegistrationFileField';

const uploadRegistrationFile = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    events: {
      public: {
        uploadRegistrationFile: (eventId: string, fd: FormData) =>
          uploadRegistrationFile(eventId, fd),
      },
    },
  },
}));

function makeFile() {
  return new File(['conteúdo'], 'doc.pdf', { type: 'application/pdf' });
}

describe('RegistrationFileField (story 68)', () => {
  beforeEach(() => {
    uploadRegistrationFile.mockReset();
  });

  it('faz upload ao escolher o arquivo e propaga a fileKey', async () => {
    uploadRegistrationFile.mockResolvedValue({ fileKey: 'uploads/abc.pdf' });
    const onChange = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <RegistrationFileField eventId="e1" value="" onChange={onChange} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, makeFile());

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('uploads/abc.pdf'));
    expect(uploadRegistrationFile).toHaveBeenCalledWith('e1', expect.any(FormData));
    const [, fd] = uploadRegistrationFile.mock.calls[0];
    expect((fd as FormData).get('file')).toBeInstanceOf(File);
  });

  it('mostra "Arquivo enviado." quando há value e não está enviando', () => {
    render(<RegistrationFileField eventId="e1" value="uploads/abc.pdf" onChange={vi.fn()} />);
    expect(screen.getByText(/arquivo enviado\./i)).toBeInTheDocument();
  });

  it('exibe erro e limpa o valor quando o upload falha', async () => {
    uploadRegistrationFile.mockRejectedValue(new Error('boom'));
    const onChange = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <RegistrationFileField eventId="e1" value="" onChange={onChange} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, makeFile());

    await waitFor(() =>
      expect(screen.getByText(/não foi possível enviar o arquivo\./i)).toBeInTheDocument(),
    );
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('não faz nada quando nenhum arquivo é selecionado', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <RegistrationFileField eventId="e1" value="" onChange={onChange} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    // Dispara change sem arquivos (early return).
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(uploadRegistrationFile).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
