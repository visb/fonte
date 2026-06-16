import { BrandHeader } from './BrandHeader';

export function LoadingState({ message = 'Carregando...' }: { message?: string }) {
  return (
    <div className="page">
      <BrandHeader />
      <div className="card center">
        <div className="emoji">⏳</div>
        <p>{message}</p>
      </div>
    </div>
  );
}

interface MessageScreenProps {
  emoji: string;
  title: string;
  message: string;
}

export function MessageScreen({ emoji, title, message }: MessageScreenProps) {
  return (
    <div className="page">
      <BrandHeader />
      <div className="card center">
        <div className="emoji">{emoji}</div>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    </div>
  );
}
