import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttachmentUploader } from './AttachmentUploader';

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

describe('AttachmentUploader', () => {
  it('chama onUpload para arquivo válido', () => {
    const onUpload = vi.fn();
    const { container } = render(
      <AttachmentUploader onUpload={onUpload} uploading={false} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    selectFile(input, new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('barra tipo fora da allowlist no cliente e NÃO chama onUpload', () => {
    const onUpload = vi.fn();
    const { container } = render(
      <AttachmentUploader onUpload={onUpload} uploading={false} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    selectFile(input, new File(['x'], 'a.exe', { type: 'application/x-msdownload' }));
    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByText(/não permitido/i)).toBeInTheDocument();
  });

  it('barra arquivo acima de 20 MB no cliente', () => {
    const onUpload = vi.fn();
    const { container } = render(
      <AttachmentUploader onUpload={onUpload} uploading={false} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const big = new File(['x'], 'grande.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 });
    selectFile(input, big);
    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByText(/20 MB/)).toBeInTheDocument();
  });

  it('desabilita o botão durante o envio', () => {
    render(<AttachmentUploader onUpload={vi.fn()} uploading />);
    expect(screen.getByRole('button', { name: /Enviando/ })).toBeDisabled();
  });
});
