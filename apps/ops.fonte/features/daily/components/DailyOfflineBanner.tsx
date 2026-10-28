import { OfflineNotice } from '@/components/shared/OfflineNotice';
import { DAILY_LABELS } from '../constants';

interface Props {
  visible: boolean;
}

/** Decisão 11: sem rede o board fica somente leitura e este aviso explica por quê. */
export function DailyOfflineBanner({ visible }: Props) {
  if (!visible) return null;
  return <OfflineNotice message={DAILY_LABELS.offline} />;
}
