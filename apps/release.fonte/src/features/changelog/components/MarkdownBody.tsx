import { parseMarkdown } from '@/lib/markdown';
import { InlineText } from './InlineText';

export function MarkdownBody({ source }: { source: string }) {
  return (
    <div className="markdown">
      {parseMarkdown(source).map((block, index) => {
        if (block.kind === 'heading') {
          const Heading = block.level === 2 ? 'h2' : 'h3';
          return (
            <Heading key={index}>
              <InlineText text={block.text} />
            </Heading>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineText text={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index}>
            <InlineText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
