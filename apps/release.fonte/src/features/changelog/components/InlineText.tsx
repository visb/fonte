import { parseInline } from '@/lib/markdown';

export function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((segment, index) => {
        if (segment.kind === 'strong') return <strong key={index}>{segment.text}</strong>;
        if (segment.kind === 'code') return <code key={index}>{segment.text}</code>;
        return <span key={index}>{segment.text}</span>;
      })}
    </>
  );
}
