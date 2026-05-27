import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useEditor, EditorContent,
  NodeViewWrapper, ReactNodeViewRenderer,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { Mark, mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight,
  Bold, ImageIcon, Italic, List, ListOrdered, Loader2, Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { api } from '@/lib/api';
import type { DocumentTemplate } from '@fonte/api-client';
import { useUpdateDocumentTemplate } from '../hooks/useDocumentTemplates';

// ─── FontSize mark ────────────────────────────────────────────────────────────
// Custom inline mark — stores pt value; avoids @tiptap/extension-text-style
// version lock issues.

const FontSize = Mark.create({
  name: 'fontSize',
  addAttributes() {
    return {
      pt: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-font-size') ?? null,
        renderHTML: (attrs) => attrs.pt
          ? { 'data-font-size': String(attrs.pt), style: `font-size: ${attrs.pt}pt` }
          : {},
      },
    };
  },
  parseHTML() { return [{ tag: 'span[data-font-size]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});

// ─── Resize handle config ─────────────────────────────────────────────────────

type HandlePos = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLES: { pos: HandlePos; cursor: string; style: React.CSSProperties }[] = [
  { pos: 'nw', cursor: 'nw-resize', style: { top: -4,    left: -4 } },
  { pos: 'n',  cursor: 'n-resize',  style: { top: -4,    left: '50%',  transform: 'translateX(-50%)' } },
  { pos: 'ne', cursor: 'ne-resize', style: { top: -4,    right: -4 } },
  { pos: 'e',  cursor: 'e-resize',  style: { top: '50%', right: -4,    transform: 'translateY(-50%)' } },
  { pos: 'se', cursor: 'se-resize', style: { bottom: -4, right: -4 } },
  { pos: 's',  cursor: 's-resize',  style: { bottom: -4, left: '50%',  transform: 'translateX(-50%)' } },
  { pos: 'sw', cursor: 'sw-resize', style: { bottom: -4, left: -4 } },
  { pos: 'w',  cursor: 'w-resize',  style: { top: '50%', left: -4,     transform: 'translateY(-50%)' } },
];

const ALIGN_OPTIONS: { value: string | null; label: string; icon: React.ReactNode }[] = [
  { value: null,     label: 'Inline',       icon: <AlignLeft size={13} /> },
  { value: 'left',   label: 'Flutuar esq.', icon: <AlignLeft size={13} /> },
  { value: 'center', label: 'Centralizar',  icon: <AlignCenter size={13} /> },
  { value: 'right',  label: 'Flutuar dir.', icon: <AlignRight size={13} /> },
];

// ─── ResizableImageNodeView ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ResizableImageNodeView({ node, updateAttributes, selected }: any) {
  const imgRef      = useRef<HTMLImageElement>(null);
  const liveSizeRef = useRef<{ w: number; h: number } | null>(null);
  const [sizeLabel, setSizeLabel] = useState<string | null>(null);

  const { src, alt, title } = node.attrs as Record<string, string | undefined>;
  const width    = node.attrs.width    as number | null;
  const height   = node.attrs.height   as number | null;
  const imgAlign = node.attrs.imgAlign as string | null;

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    lineHeight: 0,
    display: imgAlign === 'center' ? 'block' : 'inline-block',
    float: imgAlign === 'left' ? 'left' : imgAlign === 'right' ? 'right' : undefined,
    margin:
      imgAlign === 'left'   ? '0 1em 0.5em 0' :
      imgAlign === 'right'  ? '0 0 0.5em 1em' :
      imgAlign === 'center' ? '0 auto' : '0',
  };

  const imgStyle: React.CSSProperties = {
    display: 'block',
    maxWidth: '100%',
    userSelect: 'none',
    width:  width  ? `${width}px`  : undefined,
    height: height ? `${height}px` : undefined,
    outline: selected ? '2px solid hsl(var(--primary))' : 'none',
    outlineOffset: '1px',
  };

  const startDrag = (e: React.MouseEvent, pos: HandlePos) => {
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;

    const startW  = width  ?? img.offsetWidth;
    const startH  = (height ?? img.offsetHeight) || 1;
    const aspect  = startW / startH;
    const startX  = e.clientX;
    const startY  = e.clientY;
    const isCorner = ['nw', 'ne', 'se', 'sw'].includes(pos);

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let w = startW;
      let h = startH;
      if (['e', 'ne', 'se'].includes(pos)) w = startW + dx;
      if (['w', 'nw', 'sw'].includes(pos)) w = startW - dx;
      if (['s', 'se', 'sw'].includes(pos)) h = startH + dy;
      if (['n', 'ne', 'nw'].includes(pos)) h = startH - dy;
      w = Math.max(40, Math.round(w));
      h = isCorner ? Math.max(40, Math.round(w / aspect)) : Math.max(40, Math.round(h));
      liveSizeRef.current = { w, h };
      img.style.width  = `${w}px`;
      img.style.height = `${h}px`;
      setSizeLabel(`${w} × ${h} px`);
    };

    const onUp = () => {
      if (liveSizeRef.current) {
        updateAttributes({ width: liveSizeRef.current.w, height: liveSizeRef.current.h });
        liveSizeRef.current = null;
      }
      setSizeLabel(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <NodeViewWrapper style={wrapperStyle}>
      <img ref={imgRef} src={src} alt={alt ?? ''} title={title} style={imgStyle} draggable={false} />

      {selected && (
        <>
          <div
            className="absolute top-1.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-background/95 border rounded shadow-md px-1 py-0.5 z-30"
            onMouseDown={(e) => e.preventDefault()}
          >
            {ALIGN_OPTIONS.map(({ value, label, icon }) => (
              <button
                key={String(value)}
                type="button"
                title={label}
                onClick={() => updateAttributes({ imgAlign: value })}
                className={cn(
                  'p-1 rounded transition-colors',
                  imgAlign === value
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-muted-foreground',
                )}
              >
                {icon}
              </button>
            ))}
          </div>

          {sizeLabel && (
            <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-xs font-mono px-1.5 py-0.5 rounded pointer-events-none z-30">
              {sizeLabel}
            </div>
          )}

          {HANDLES.map(({ pos, cursor, style }) => (
            <div
              key={pos}
              onMouseDown={(e) => startDrag(e, pos)}
              style={{
                position: 'absolute',
                width: 8, height: 8, borderRadius: 2,
                backgroundColor: 'hsl(var(--primary))',
                border: '1.5px solid white',
                boxShadow: '0 1px 3px rgba(0,0,0,.35)',
                cursor, zIndex: 30,
                ...style,
              }}
            />
          ))}
        </>
      )}
    </NodeViewWrapper>
  );
}

// ─── ResizableImage extension ─────────────────────────────────────────────────

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width:  { default: null, parseHTML: (el) => { const v = el.getAttribute('data-img-width');  return v ? Number(v) : null; }, renderHTML: () => ({}) },
      height: { default: null, parseHTML: (el) => { const v = el.getAttribute('data-img-height'); return v ? Number(v) : null; }, renderHTML: () => ({}) },
      imgAlign: { default: null, parseHTML: (el) => el.getAttribute('data-img-align') ?? null, renderHTML: () => ({}) },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const width    = node.attrs.width    as number | null;
    const height   = node.attrs.height   as number | null;
    const imgAlign = node.attrs.imgAlign as string | null;
    const styles: string[] = ['max-width: 100%'];
    if (width)  styles.push(`width: ${width}px`);
    if (height) styles.push(`height: ${height}px`);
    if (imgAlign === 'left')   styles.push('float: left; margin-right: 1em; margin-bottom: 0.5em');
    else if (imgAlign === 'right')  styles.push('float: right; margin-left: 1em; margin-bottom: 0.5em');
    else if (imgAlign === 'center') styles.push('display: block; margin: 0 auto');
    return ['img', {
      ...HTMLAttributes,
      style: styles.join('; '),
      ...(width    ? { 'data-img-width':  String(width)  } : {}),
      ...(height   ? { 'data-img-height': String(height) } : {}),
      ...(imgAlign ? { 'data-img-align':  imgAlign }       : {}),
    }];
  },
  addNodeView() { return ReactNodeViewRenderer(ResizableImageNodeView); },
});

// ─── ToolbarButton ────────────────────────────────────────────────────────────

function ToolbarButton({ active, onClick, title, children }: {
  active: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

// ─── Variables ────────────────────────────────────────────────────────────────

const VARIABLES: { key: string; label: string; description: string }[] = [
  { key: '{{name}}',          label: 'Nome completo',      description: 'Nome completo do acolhido' },
  { key: '{{cpf}}',           label: 'CPF',                description: 'CPF formatado (000.000.000-00)' },
  { key: '{{rg}}',            label: 'RG',                 description: 'Registro Geral do acolhido' },
  { key: '{{birthDate}}',     label: 'Data de nascimento', description: 'Data de nascimento no formato dd/mm/aaaa' },
  { key: '{{age}}',           label: 'Idade',              description: 'Idade atual calculada em anos' },
  { key: '{{maritalStatus}}', label: 'Estado civil',       description: 'Solteiro(a), Casado(a) ou Divorciado(a)' },
  { key: '{{address}}',       label: 'Endereço',           description: 'Endereço residencial do acolhido' },
  { key: '{{phone}}',         label: 'Telefone',           description: 'Telefone de contato do acolhido' },
  { key: '{{house}}',         label: 'Nome da casa',       description: 'Nome da unidade de acolhimento' },
  { key: '{{entryDate}}',     label: 'Data de entrada',    description: 'Data de entrada na comunidade (dd/mm/aaaa)' },
  { key: '{{date}}',          label: 'Data de hoje',       description: 'Data atual no momento da impressão (dd/mm/aaaa)' },
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({ name: z.string().min(1), isRequired: z.boolean() });
type FormData = z.infer<typeof schema>;

// ─── TemplateEditor ───────────────────────────────────────────────────────────

interface Props { template: DocumentTemplate; onSaved: (updated: DocumentTemplate) => void; }

export function TemplateEditor({ template, onSaved }: Props) {
  const [copied, setCopied]                    = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const imageInputRef  = useRef<HTMLInputElement>(null);
  // Ref so the paste handler (defined at useEditor time) can call the latest upload fn
  const uploadFnRef = useRef<((file: File) => Promise<void>) | null>(null);

  const { register, getValues, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: template.name, isRequired: template.isRequired },
  });

  useEffect(() => {
    reset({ name: template.name, isRequired: template.isRequired });
  }, [template.id, reset]);

  const updateMutation = useUpdateDocumentTemplate();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Conteúdo do documento...' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FontSize,
      ResizableImage.configure({ inline: false, allowBase64: false }),
    ],
    content: template.content,
    editorProps: {
      attributes: { style: 'display: flow-root;' },
      // Intercept clipboard paste — if image file present, upload instead of embedding base64
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file && uploadFnRef.current) {
              event.preventDefault();
              void uploadFnRef.current(file);
              return true;
            }
          }
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor && template.content && editor.getHTML() !== template.content) {
      editor.commands.setContent(template.content);
    }
  }, [editor, template.content]);

  // Shared upload logic — used by file input AND clipboard paste
  const uploadFile = useCallback(async (file: File) => {
    if (!editor) return;
    if (file.size > 5 * 1024 * 1024) {
      setImageUploadError('Imagem muito grande. Máximo 5 MB.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setIsUploadingImage(true);
    setImageUploadError(null);
    try {
      const { url } = await api.documentTemplates.uploadImage(formData);
      editor.chain().focus().setImage({ src: api.photoUrl(url) ?? url }).run();
    } catch (err) {
      setImageUploadError(getErrorMessage(err, 'Erro ao enviar imagem.'));
    } finally {
      setIsUploadingImage(false);
    }
  }, [editor]);

  // Keep paste handler ref current
  useEffect(() => { uploadFnRef.current = uploadFile; }, [uploadFile]);

  const handleSave = useCallback(() => {
    if (!editor) return;
    const { name, isRequired } = getValues();
    updateMutation.mutate(
      { id: template.id, data: { name, content: editor.getHTML(), isRequired } },
      { onSuccess: (updated) => onSaved(updated) },
    );
  }, [editor, updateMutation, template.id, getValues, onSaved]);

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    e.target.value = '';
  };

  // Font size: read current pt value from textStyle mark, default 12
  const changeFontSize = (delta: number) => {
    if (!editor) return;
    const current = editor.getAttributes('fontSize').pt;
    const currentPt = current ? Number(current) : 12;
    const next = Math.max(8, Math.min(72, currentPt + delta));
    editor.chain().focus().setMark('fontSize', { pt: next }).run();
  };

  const insertVariable = (key: string) => {
    if (editor) editor.chain().focus().insertContent(key).run();
    navigator.clipboard.writeText(key).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!editor) return null;

  return (
    <div className="space-y-3">
      {/* Name + required */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label htmlFor="template-name" className="text-xs mb-1 block">Nome do template</Label>
          <Input id="template-name" {...register('name')} className="h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input id="is-required" type="checkbox" {...register('isRequired')} className="h-4 w-4 cursor-pointer" />
          <Label htmlFor="is-required" className="text-sm cursor-pointer whitespace-nowrap">
            Exigir no acolhimento
          </Label>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
        {/* Font size */}
        <ToolbarButton active={false} onClick={() => changeFontSize(2)} title="Aumentar fonte">
          <span className="text-[13px] font-bold leading-none select-none">A+</span>
        </ToolbarButton>
        <ToolbarButton active={false} onClick={() => changeFontSize(-2)} title="Diminuir fonte">
          <span className="text-[13px] font-bold leading-none select-none">A−</span>
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Inline formatting */}
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito">
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico">
          <Italic size={14} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Lists */}
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista com marcadores">
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
          <ListOrdered size={14} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Text alignment */}
        <ToolbarButton active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Alinhar à esquerda">
          <AlignLeft size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centralizar">
          <AlignCenter size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Alinhar à direita">
          <AlignRight size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justificar">
          <AlignJustify size={14} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* HR + Image */}
        <ToolbarButton active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Linha horizontal">
          <Minus size={14} />
        </ToolbarButton>
        <ToolbarButton active={false} onClick={() => !isUploadingImage && imageInputRef.current?.click()} title="Inserir imagem (ou cole do clipboard)">
          {isUploadingImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
        </ToolbarButton>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
      </div>

      {imageUploadError && <p className="text-xs text-destructive">{imageUploadError}</p>}

      {/* Editor */}
      <div className="min-h-64 rounded-md border bg-background p-4 focus-within:ring-1 focus-within:ring-ring">
        <EditorContent editor={editor} />
      </div>

      {/* Variables */}
      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Variáveis disponíveis — clique para inserir no editor
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {VARIABLES.map(({ key, label, description }) => (
            <button
              key={key}
              onClick={() => insertVariable(key)}
              className="flex items-start gap-2 rounded px-2 py-1.5 text-left bg-background border hover:bg-accent transition-colors group"
            >
              <span className="font-mono text-xs text-primary shrink-0 mt-0.5 group-hover:underline">
                {copied === key ? '✓ inserido' : key}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                <span className="font-medium text-foreground">{label}</span>{' — '}{description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {updateMutation.isError && (
        <p className="text-sm text-destructive">
          {getErrorMessage(updateMutation.error, 'Erro ao salvar template.')}
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || !getValues('name').trim()}>
          {updateMutation.isPending ? 'Salvando...' : 'Salvar template'}
        </Button>
      </div>
    </div>
  );
}
