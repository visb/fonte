import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, {
  type SuggestionOptions,
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from '@tiptap/suggestion';
import {
  VariableSuggestionList,
  type VariableSuggestionListProps,
  type VariableSuggestionListRef,
} from './VariableSuggestionList';
import {
  buildVariableInsertion,
  filterVariables,
  MAX_SUGGESTIONS,
  type TemplateVariable,
} from './templateVariables';

// ─── VariableSuggestion (story 144) ───────────────────────────────────────────
// Autocomplete inline de variáveis no editor de template. Ao digitar `{{`, o
// utilitário `Suggestion` do TipTap v3 abre um popup no cursor filtrando a MESMA
// lista `VARIABLES` (via `filterVariables`) e, ao escolher, substitui o trecho
// `{{parcial` pelo token completo `{{key}}` (sem duplicar as chaves). O `onStart`
// também dispara a abertura do drawer `VariablesPanel` (callback `onOpen`).
//
// Este arquivo é o "wiring" fino do ProseMirror/@tiptap — depende de um editor
// contenteditable real que o jsdom não implementa, então fica FORA da cobertura
// unitária (coberto pelo E2E Playwright); as funções puras (`filterVariables`,
// `buildVariableInsertion`) e o popup (`VariableSuggestionList`) têm testes
// próprios. Mesmo padrão do `TemplateEditor` (story 143/80).

export interface VariableSuggestionOptions {
  /** Disparado quando o gatilho `{{` abre — o editor usa para expandir o drawer. */
  onOpen?: () => void;
  suggestion: Omit<SuggestionOptions<TemplateVariable, TemplateVariable>, 'editor'>;
}

// Posiciona o popup logo abaixo do cursor (rect do caractere). Sem lib externa de
// tooltip — `position: fixed` a partir do clientRect do ProseMirror.
function positionPopup(popup: HTMLElement, clientRect?: (() => DOMRect | null) | null) {
  if (!clientRect) return;
  const rect = clientRect();
  if (!rect) return;
  popup.style.left = `${rect.left}px`;
  popup.style.top = `${rect.bottom + 4}px`;
}

export const VariableSuggestion = Extension.create<VariableSuggestionOptions>({
  name: 'variableSuggestion',

  addOptions() {
    return {
      onOpen: undefined,
      suggestion: {
        char: '{{',
        startOfLine: false,
        allowSpaces: false,
        // Fecha o gatilho assim que aparece uma chave de fechamento `}`: sem isto,
        // o token recém-inserido `{{name}}` reabriria o popup (a query `name}}`
        // casaria a própria key `{{name}}`). Enquanto o usuário digita `{{parc`,
        // não há `}`, então o autocomplete segue ativo.
        allow: ({ state, range }) => !state.doc.textBetween(range.from, range.to).includes('}'),
        // Fatia em MAX_SUGGESTIONS; a filtragem accent/case-insensitive é pura.
        items: ({ query }): TemplateVariable[] => filterVariables(query).slice(0, MAX_SUGGESTIONS),
        // Substitui o range do gatilho (`{{` + digitado) pelo token completo.
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, buildVariableInsertion(props.key))
            .run();
        },
      },
    };
  },

  addProseMirrorPlugins() {
    const onOpen = this.options.onOpen;

    return [
      Suggestion<TemplateVariable, TemplateVariable>({
        editor: this.editor,
        ...this.options.suggestion,
        render: () => {
          let component: ReactRenderer<VariableSuggestionListRef, VariableSuggestionListProps> | null =
            null;
          let popup: HTMLDivElement | null = null;

          const setVisible = (visible: boolean) => {
            if (popup) popup.style.display = visible ? '' : 'none';
          };

          return {
            onStart: (props: SuggestionProps<TemplateVariable, TemplateVariable>) => {
              // Colateral do gatilho: abre o drawer de variáveis (decisão do plano).
              onOpen?.();

              component = new ReactRenderer(VariableSuggestionList, {
                props: { items: props.items, command: props.command },
                editor: props.editor,
              });

              popup = document.createElement('div');
              popup.setAttribute('data-variable-suggestion', 'true');
              popup.style.position = 'fixed';
              popup.style.zIndex = '50';
              popup.appendChild(component.element);
              document.body.appendChild(popup);

              positionPopup(popup, props.clientRect);
              // Popup some se não há match (não bloqueia digitar `{{` literal).
              setVisible(props.items.length > 0);
            },

            onUpdate: (props: SuggestionProps<TemplateVariable, TemplateVariable>) => {
              component?.updateProps({ items: props.items, command: props.command });
              if (popup) positionPopup(popup, props.clientRect);
              setVisible(props.items.length > 0);
            },

            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                popup?.remove();
                component?.destroy();
                popup = null;
                component = null;
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },

            onExit: () => {
              popup?.remove();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      }),
    ];
  },
});
