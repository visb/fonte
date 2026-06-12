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
import { Extension, Mark, mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table, TableRow, TableHeader, TableCell, TableView } from '@tiptap/extension-table';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight,
  Bold, Check, Eraser, ImageIcon, IndentDecrease, IndentIncrease,
  Italic, List, ListOrdered, Loader2, Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { api } from '@/lib/api';
import type { DocumentTemplate } from '@fonte/api-client';
import { useUpdateDocumentTemplate } from '../hooks/useDocumentTemplates';
import { TableToolbar } from './TableToolbar';
import { LinkToolbar } from './LinkToolbar';
import { LinkBubbleMenu } from './LinkBubbleMenu';
import { TableBlockMenu } from './TableBlockMenu';
import { A4EditorFrame } from './A4EditorFrame';

// ─── FontSize mark ────────────────────────────────────────────────────────────
// Custom inline mark — stores pt value; avoids @tiptap/extension-text-style
// version lock issues.

const DEFAULT_LINE_HEIGHT = 1.2;

// ─── Font size scale ──────────────────────────────────────────────────────────
// Single source of truth for the body font. Must match the PDF base
// (`body{font-size:12pt}` in document-template.service.ts) so the editor renders
// 1:1 with the print output. The A+/A− control steps from this default, so
// A− then A+ over default text returns to exactly the same size.

const DEFAULT_FONT_PT = 12; // body base size (pt) — decisão story 23
const FONT_STEP_PT = 2;     // A+/A− step (pt) — decisão story 23
const MIN_FONT_PT = 8;
const MAX_FONT_PT = 72;

// Pure font-size stepper — exported for unit testing.
// `current` is the active mark's pt value (or undefined when text has no mark,
// in which case it falls back to the body default).
export function nextFontPt(
  current: number | string | null | undefined,
  delta: number,
  defaultPt: number = DEFAULT_FONT_PT,
): number {
  const base = current != null && current !== '' ? Number(current) : defaultPt;
  return Math.max(MIN_FONT_PT, Math.min(MAX_FONT_PT, base + delta));
}

const FontSize = Mark.create({
  name: 'fontSize',
  addAttributes() {
    return {
      pt: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-font-size') ?? null,
        renderHTML: () => ({}), // style is built jointly in renderHTML below
      },
      lh: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-line-height') ?? null,
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() { return [{ tag: 'span[data-font-size]' }, { tag: 'span[data-line-height]' }]; },
  renderHTML({ mark, HTMLAttributes }) {
    const { pt, lh } = mark.attrs as { pt?: string | number | null; lh?: string | number | null };
    const styles: string[] = [];
    const dataAttrs: Record<string, string> = {};
    if (pt) {
      styles.push(`font-size: ${pt}pt`);
      dataAttrs['data-font-size'] = String(pt);
    }
    // Unitless line-height = multiplier of the current font-size (proportional).
    // Falls back to the default factor whenever a font-size is set.
    const factor = lh != null ? Number(lh) : pt ? DEFAULT_LINE_HEIGHT : null;
    if (factor != null) {
      styles.push(`line-height: ${factor}`);
      if (lh != null) dataAttrs['data-line-height'] = String(lh);
    }
    const attrs = styles.length ? { ...dataAttrs, style: styles.join('; ') } : {};
    return ['span', mergeAttributes(HTMLAttributes, attrs), 0];
  },
});

// ─── ParagraphIndent extension ────────────────────────────────────────────────
// First-line indent stored as a `text-indent` inline style on the paragraph.
// Survives PDF export (puppeteer) because it ships as an inline style, unlike
// leading spaces which the HTML/CSS whitespace collapse would strip.

const INDENT_STEP_EM = 2;
const MAX_INDENT_EM = 12;

const ParagraphIndent = Extension.create({
  name: 'paragraphIndent',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          textIndent: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.textIndent || null,
            renderHTML: (attrs) =>
              attrs.textIndent ? { style: `text-indent: ${attrs.textIndent}` } : {},
          },
        },
      },
    ];
  },
});

// Read current paragraph indent in em (0 when unset).
function currentIndentEm(value: string | null | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

// ─── readImageSize ──────────────────────────────────────────────────────────
// Story 22 — lê as dimensões naturais (em px) do arquivo de imagem antes de
// inseri-lo no editor, para que o nó nasça no tamanho real do arquivo (sem
// "tratamento"/escala silenciosa). O usuário ainda pode redimensionar pelos
// handles. Em caso de falha de leitura, devolve null e o nó cai no fallback
// `max-width: 100%`.
function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new globalThis.Image();
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(size.width && size.height ? size : null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

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
    width: imgAlign === 'center' ? '100%' : undefined,
    float: imgAlign === 'left' ? 'left' : imgAlign === 'right' ? 'right' : undefined,
    margin:
      imgAlign === 'left'  ? '0 1em 0.5em 0' :
      imgAlign === 'right' ? '0 0 0.5em 1em' :
      '0',
  };

  const imgStyle: React.CSSProperties = {
    display: 'block',
    maxWidth: '100%',
    margin: imgAlign === 'center' ? '0 auto' : undefined,
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
    // `max-width: 100%` é guarda de página (evita a imagem vazar a margem da
    // A4) — NÃO é "tratamento": os bytes não são recomprimidos/redimensionados.
    // O nó já nasce com width/height naturais (ver readImageSize), então só é
    // reduzido quando realmente excede a largura útil.
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

// ─── DocTable extension ───────────────────────────────────────────────────────
// Story 21 — adiciona um atributo `class` persistível ao nó de tabela para que
// o toggle de borda (classe `no-border`) e a classe base `doc-table` sobrevivam
// ao HTML salvo (e portanto ao PDF do puppeteer). O Table padrão do TipTap não
// serializa `class`.
// O NodeView padrão do TipTap (`TableView`, usado quando `resizable: true`)
// monta um <table> "cru" que só copia `node.attrs.style` — ignora `class`. Por
// isso o editor não recebia a classe `doc-table`/`no-border` ao vivo (embora o
// getHTML/PDF a serializasse certo). Este NodeView espelha a classe no <table>
// vivo para que o editor case visualmente com o PDF (story §4).
class DocTableView extends TableView {
  constructor(node: ProseMirrorNode, cellMinWidth: number) {
    super(node, cellMinWidth);
    this.syncClass(node);
  }
  override update(node: ProseMirrorNode): boolean {
    const ok = super.update(node);
    if (ok) this.syncClass(node);
    return ok;
  }
  private syncClass(node: ProseMirrorNode) {
    const cls = (node.attrs.class as string | undefined) ?? 'doc-table no-border';
    this.table.setAttribute('class', cls);
  }
}

const DocTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: 'doc-table no-border',
        parseHTML: (el) => (el as HTMLElement).getAttribute('class') || 'doc-table no-border',
        renderHTML: (attrs) => (attrs.class ? { class: attrs.class } : {}),
      },
    };
  },
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
  { key: '{{nationality}}',   label: 'Nacionalidade',      description: 'Nacionalidade do acolhido' },
  { key: '{{city}}',          label: 'Cidade',             description: 'Cidade de residência do acolhido' },
  { key: '{{state}}',         label: 'UF',                 description: 'Estado (sigla) de residência do acolhido' },
  { key: '{{birthDate}}',     label: 'Data de nascimento', description: 'Data de nascimento no formato dd/mm/aaaa' },
  { key: '{{age}}',           label: 'Idade',              description: 'Idade atual calculada em anos' },
  { key: '{{maritalStatus}}', label: 'Estado civil',       description: 'Solteiro(a), Casado(a) ou Divorciado(a)' },
  { key: '{{address}}',       label: 'Endereço',           description: 'Endereço residencial do acolhido' },
  { key: '{{phone}}',         label: 'Telefone',           description: 'Telefone de contato do acolhido' },
  { key: '{{house}}',         label: 'Nome da casa',       description: 'Nome da unidade de acolhimento' },
  { key: '{{houseName}}',     label: 'Casa — nome',        description: 'Nome da casa onde o acolhido está' },
  { key: '{{houseAddress}}',  label: 'Casa — endereço',    description: 'Endereço da casa onde o acolhido está' },
  { key: '{{houseCity}}',     label: 'Casa — cidade',      description: 'Cidade da casa onde o acolhido está' },
  { key: '{{houseState}}',    label: 'Casa — UF',          description: 'Estado (sigla) da casa onde o acolhido está' },
  { key: '{{entryDate}}',     label: 'Data de entrada',    description: 'Data de entrada na comunidade (dd/mm/aaaa)' },
  { key: '{{date}}',          label: 'Data de hoje',       description: 'Data atual no momento da impressão (dd/mm/aaaa)' },
  { key: '{{dateLong}}',      label: 'Data por extenso',   description: 'Data atual por extenso (ex: 1 de junho de 2026)' },
  { key: '{{responsibleName}}',         label: 'Responsável — nome',       description: 'Nome do familiar marcado como responsável' },
  { key: '{{responsibleRelationship}}', label: 'Responsável — parentesco', description: 'Parentesco do responsável com o acolhido' },
  { key: '{{responsiblePhone}}',        label: 'Responsável — telefone',   description: 'Telefone do familiar responsável' },
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({ name: z.string().min(1), isRequired: z.boolean(), signAtAdmission: z.boolean() });
type FormData = z.infer<typeof schema>;

// ─── TemplateEditor ───────────────────────────────────────────────────────────

interface Props { template: DocumentTemplate; onSaved: (updated: DocumentTemplate) => void; }

export function TemplateEditor({ template, onSaved }: Props) {
  const [copied, setCopied]                    = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInputRef  = useRef<HTMLInputElement>(null);
  // Ref so the paste handler (defined at useEditor time) can call the latest upload fn
  const uploadFnRef = useRef<((file: File) => Promise<void>) | null>(null);

  const { register, getValues, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: template.name, isRequired: template.isRequired, signAtAdmission: template.signAtAdmission },
  });

  useEffect(() => {
    reset({ name: template.name, isRequired: template.isRequired, signAtAdmission: template.signAtAdmission });
    setJustSaved(false);
  }, [template.id, reset]);

  const updateMutation = useUpdateDocumentTemplate();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Conteúdo do documento...' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FontSize,
      ParagraphIndent,
      ResizableImage.configure({ inline: false, allowBase64: false }),
      // Link visível (azul + sublinhado vêm do CSS compartilhado, não daqui, p/
      // o editor casar 1:1 com o PDF). openOnClick: false p/ não navegar ao
      // clicar dentro do editor.
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: 'doc-link', rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      // Story 21 — tabelas (também servem de layout multicoluna sem borda).
      // `View: DocTableView` espelha a classe `doc-table`/`no-border` no <table>
      // vivo (o TableView padrão só copia o style — ver DocTableView).
      DocTable.configure({ resizable: true, View: DocTableView, HTMLAttributes: { class: 'doc-table' } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: template.content,
    editorProps: {
      attributes: {
        style: `display: flow-root; font-family: Arial, Helvetica, sans-serif; font-size: ${DEFAULT_FONT_PT}pt; line-height: ${DEFAULT_LINE_HEIGHT};`,
      },
      // Clicar num link NÃO navega — apenas posiciona o cursor (o LinkBubbleMenu cuida
      // das ações). `openOnClick: false` não basta: o browser segue âncoras
      // target="_blank" no clique mesmo dentro do contenteditable, então prevenimos
      // o default aqui.
      handleClick: (_view, _pos, event) => {
        const el = event.target as HTMLElement | null;
        if (el?.closest('a')) event.preventDefault();
        return false;
      },
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
      // Lê as dimensões naturais ANTES do upload — o arquivo local já está
      // disponível e isso evita uma viagem de rede extra.
      const dims = await readImageSize(file);
      const { url } = await api.documentTemplates.uploadImage(formData);
      const src = api.photoUrl(url) ?? url;
      const chain = editor.chain().focus().setImage({ src });
      // Insere a imagem no tamanho exato do arquivo (px). Sem dimensões, o nó
      // cairia no fallback `max-width: 100%` (guarda de página), dando a
      // impressão de "tratamento". Não há recompressão/resize dos bytes.
      if (dims) chain.updateAttributes('image', { width: dims.width, height: dims.height });
      chain.run();
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
    const { name, isRequired, signAtAdmission } = getValues();
    updateMutation.mutate(
      { id: template.id, data: { name, content: editor.getHTML(), isRequired, signAtAdmission } },
      {
        onSuccess: (updated) => {
          onSaved(updated);
          setJustSaved(true);
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setJustSaved(false), 2500);
        },
      },
    );
  }, [editor, updateMutation, template.id, getValues, onSaved]);

  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); }, []);

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    e.target.value = '';
  };

  // Font size: read current pt value from fontSize mark, falling back to the
  // body default. Preserve any custom line-height factor on the same mark.
  const changeFontSize = (delta: number) => {
    if (!editor) return;
    const attrs = editor.getAttributes('fontSize');
    const next = nextFontPt(attrs.pt, delta);
    editor.chain().focus().setMark('fontSize', { pt: next, lh: attrs.lh ?? null }).run();
  };

  // Line-height: unitless multiplier of the font size, default 1.2.
  const changeLineHeight = (delta: number) => {
    if (!editor) return;
    const attrs = editor.getAttributes('fontSize');
    const current = attrs.lh ? Number(attrs.lh) : DEFAULT_LINE_HEIGHT;
    const next = Math.round(Math.max(1, Math.min(3, current + delta)) * 10) / 10;
    editor.chain().focus().setMark('fontSize', { pt: attrs.pt ?? null, lh: next }).run();
  };

  // First-line paragraph indent: step the `text-indent` em value up/down.
  const changeIndent = (delta: number) => {
    if (!editor) return;
    const current = currentIndentEm(editor.getAttributes('paragraph').textIndent as string | null);
    const next = Math.max(0, Math.min(MAX_INDENT_EM, current + delta * INDENT_STEP_EM));
    editor
      .chain()
      .focus()
      .updateAttributes('paragraph', { textIndent: next > 0 ? `${next}em` : null })
      .run();
  };

  const clearFormatting = () => {
    if (!editor) return;
    editor.chain().focus().unsetAllMarks().clearNodes().run();
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
        <div className="flex items-center gap-2 pt-5">
          <input id="sign-at-admission" type="checkbox" {...register('signAtAdmission')} className="h-4 w-4 cursor-pointer" />
          <Label htmlFor="sign-at-admission" className="text-sm cursor-pointer whitespace-nowrap">
            Assinar no acolhimento
          </Label>
        </div>
      </div>

      {/* Toolbar — fica fixa no topo ao rolar. Offset/margens negativos cancelam
          o padding do <main> (p-4 sm:p-8) pra encostar flush no topo. */}
      <div className="sticky -top-4 z-20 -mx-4 flex flex-wrap items-center gap-1 border-b bg-muted/95 px-4 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-muted/80 sm:-top-8 sm:-mx-8 sm:px-8">
        {/* Font size */}
        <ToolbarButton active={false} onClick={() => changeFontSize(FONT_STEP_PT)} title="Aumentar fonte">
          <span className="text-[13px] font-bold leading-none select-none">A+</span>
        </ToolbarButton>
        <span className="px-1 text-[11px] font-mono tabular-nums text-muted-foreground select-none" title="Tamanho da fonte (pt)">
          {Number(editor.getAttributes('fontSize').pt ?? DEFAULT_FONT_PT)}
        </span>
        <ToolbarButton active={false} onClick={() => changeFontSize(-FONT_STEP_PT)} title="Diminuir fonte">
          <span className="text-[13px] font-bold leading-none select-none">A−</span>
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Line height */}
        <ToolbarButton active={false} onClick={() => changeLineHeight(0.1)} title="Aumentar entrelinha">
          <span className="text-[11px] font-bold leading-none select-none">LH+</span>
        </ToolbarButton>
        <ToolbarButton active={false} onClick={() => changeLineHeight(-0.1)} title="Diminuir entrelinha">
          <span className="text-[11px] font-bold leading-none select-none">LH−</span>
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Inline formatting */}
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito">
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico">
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton active={false} onClick={clearFormatting} title="Remover formatação">
          <Eraser size={14} />
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

        {/* Paragraph indent */}
        <ToolbarButton active={false} onClick={() => changeIndent(1)} title="Recuar primeira linha do parágrafo">
          <IndentIncrease size={14} />
        </ToolbarButton>
        <ToolbarButton active={false} onClick={() => changeIndent(-1)} title="Diminuir recuo da primeira linha">
          <IndentDecrease size={14} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Link / unlink */}
        <LinkToolbar editor={editor} />

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* HR + Image */}
        <ToolbarButton active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Linha horizontal">
          <Minus size={14} />
        </ToolbarButton>
        <ToolbarButton active={false} onClick={() => !isUploadingImage && imageInputRef.current?.click()} title="Inserir imagem (ou cole do clipboard)">
          {isUploadingImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
        </ToolbarButton>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Tabela / multicoluna (story 21) */}
        <TableToolbar editor={editor} />
      </div>

      {imageUploadError && <p className="text-xs text-destructive">{imageUploadError}</p>}

      {/* Editor — folha A4 real com geometria/typografia idêntica ao PDF e guias
          de quebra de página (ver A4EditorFrame). Substitui o antigo max-width. */}
      <A4EditorFrame>
        <EditorContent editor={editor} />
      </A4EditorFrame>

      {/* Tooltip de ações ao clicar/posicionar o cursor num link (story 28) */}
      <LinkBubbleMenu editor={editor} />

      {/* Alça de seleção + menu de ações da tabela inteira (story 30) */}
      <TableBlockMenu editor={editor} />

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

      <div className="sticky -bottom-4 z-20 -mx-4 -mb-4 mt-6 flex items-center justify-end gap-3 border-t bg-background/95 px-4 pt-3 pb-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-bottom-8 sm:-mx-8 sm:-mb-8 sm:px-8 sm:pt-4 sm:pb-8">
        {justSaved && !updateMutation.isPending && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <Check size={15} />
            Template salvo
          </span>
        )}
        <Button onClick={handleSave} disabled={updateMutation.isPending || !getValues('name').trim()}>
          {updateMutation.isPending ? 'Salvando...' : 'Salvar template'}
        </Button>
      </div>
    </div>
  );
}
