import { useRef, useState } from 'react';
import { ArrowLeft, Paperclip, Trash2, Upload } from 'lucide-react';
import { AvatarUpload } from '@/components/AvatarUpload';
import { Button } from '@/components/ui/button';

interface ImportDocumentsStepProps {
  initialPhoto: Blob | null;
  initialFiles: File[];
  onBack: () => void;
  onNext: (photo: Blob | null, files: File[]) => void;
}

export function ImportDocumentsStep({
  initialPhoto,
  initialFiles,
  onBack,
  onNext,
}: ImportDocumentsStepProps) {
  const [photo, setPhoto] = useState<Blob | null>(initialPhoto);
  const [files, setFiles] = useState<File[]>(initialFiles);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming);
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...arr.filter((f) => !existingNames.has(f.name))];
    });
  };

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Documentos</h2>
        <p className="text-sm text-muted-foreground">
          Opcional. Adicione foto de perfil e documentos assinados antes de salvar.
        </p>
      </div>

      {/* Foto */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium">Foto do residente</h3>
        <div className="flex justify-center py-2">
          <AvatarUpload onBlobChange={setPhoto} />
        </div>
        {photo && (
          <p className="text-xs text-center text-muted-foreground">
            Foto selecionada — será salva ao confirmar.
          </p>
        )}
      </section>

      {/* Documentos assinados / outros arquivos */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Documentos assinados e outros arquivos</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} className="mr-1.5" />
            Adicionar
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground py-1">Nenhum arquivo adicionado.</p>
        ) : (
          <ul className="space-y-2">
            {files.map((f) => (
              <li
                key={f.name}
                className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5"
              >
                <Paperclip size={14} className="text-muted-foreground shrink-0" />
                <span className="flex-1 min-w-0 text-sm truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive shrink-0"
                  onClick={() => removeFile(f.name)}
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-between gap-3 pt-2">
        <Button type="button" variant="outline" className="gap-2" onClick={onBack}>
          <ArrowLeft size={14} />
          Voltar
        </Button>
        <Button type="button" onClick={() => onNext(photo, files)}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
