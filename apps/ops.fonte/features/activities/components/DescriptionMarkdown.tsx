import { Text, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';

interface Props {
  /** Descrição em markdown (ou null/'' quando ausente). */
  markdown: string | null | undefined;
}

/**
 * Render read-only da descrição em markdown no ops (story 72). Mostra negrito,
 * listas e links clicáveis. `react-native-markdown-display` NÃO interpreta HTML
 * bruto (sem passo MD→HTML no device) — fecha XSS por construção. Links abrem no
 * navegador externo; só http/https/mailto são abertos (protocolos perigosos são
 * ignorados).
 */
export function DescriptionMarkdown({ markdown }: Props) {
  if (!markdown) {
    return <Text className="text-sm italic text-gray-400">Sem descrição.</Text>;
  }

  return (
    <Markdown
      style={markdownStyles}
      onLinkPress={(url) => {
        // Só abre esquemas seguros; bloqueia javascript:/data:/etc.
        if (/^(https?:|mailto:)/i.test(url.trim())) {
          void Linking.openURL(url);
        }
        return false; // já tratamos a abertura manualmente
      }}
    >
      {markdown}
    </Markdown>
  );
}

const markdownStyles = {
  body: { fontSize: 14, color: '#4b5563' },
  link: { color: '#4f46e5', textDecorationLine: 'underline' as const },
  bullet_list: { marginVertical: 2 },
  ordered_list: { marginVertical: 2 },
  strong: { fontWeight: '700' as const },
};
