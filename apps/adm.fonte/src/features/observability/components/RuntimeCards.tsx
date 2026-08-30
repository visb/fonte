import type { ObservabilityRuntime } from '@fonte/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  CPU_PERCENT_ALERT,
  EVENT_LOOP_LAG_ALERT_MS,
  EVENT_LOOP_LAG_HINT,
  RSS_ALERT_MB,
} from '../constants';
import { formatMb, formatMs, formatPercent, formatUptime } from '../utils';

interface RuntimeCardProps {
  label: string;
  value: string;
  detail: string;
  alert?: boolean;
  hint?: string;
}

function RuntimeCard({ label, value, detail, alert, hint }: RuntimeCardProps) {
  return (
    <Card title={hint}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          data-testid={`runtime-value-${label}`}
          className={cn('text-2xl font-bold', alert && 'text-destructive')}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

interface Props {
  runtime: ObservabilityRuntime;
}

/**
 * Saúde do processo agora (story 192). Ordem de importância para 1 vCPU: o lag
 * de event loop vem primeiro porque é o sinal que denuncia trabalho síncrono
 * pesado bloqueando a API inteira.
 */
export function RuntimeCards({ runtime }: Props) {
  const lag = runtime.eventLoopLagMs;
  const memory = runtime.memory;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <RuntimeCard
        label="Event loop lag (p99)"
        value={formatMs(lag?.p99)}
        detail={`p50 ${formatMs(lag?.p50)} · máx ${formatMs(lag?.max)}`}
        alert={(lag?.p99 ?? 0) > EVENT_LOOP_LAG_ALERT_MS}
        hint={EVENT_LOOP_LAG_HINT}
      />
      <RuntimeCard
        label="Memória (RSS)"
        value={formatMb(memory?.rssMb)}
        detail={`heap ${formatMb(memory?.heapUsedMb)} de ${formatMb(
          memory?.heapTotalMb,
        )}`}
        alert={(memory?.rssMb ?? 0) > RSS_ALERT_MB}
      />
      <RuntimeCard
        label="CPU"
        value={formatPercent(runtime.cpuPercent)}
        detail="Desde a leitura anterior"
        alert={(runtime.cpuPercent ?? 0) > CPU_PERCENT_ALERT}
      />
      <RuntimeCard
        label="Uptime"
        value={formatUptime(runtime.uptimeSec)}
        detail={`Node ${runtime.nodeVersion ?? '—'}`}
      />
    </div>
  );
}
