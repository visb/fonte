#!/usr/bin/env node
/**
 * Bancada de medicao da instabilidade da suite Maestro do ops.fonte (story 187).
 *
 * Contexto: na rodada 182-184, uma batelada de `pnpm test:ops` fechou 11/13 com
 * `census` e `dashboard` caindo em ~7s cada; os dois passaram isolados e na
 * batelada seguinte, sem edicao. Isso e sintoma, nao diagnostico. Este script
 * roda a suite N vezes, carimba cada execucao e recolhe os artefatos necessarios
 * para separar as hipoteses (driver/gRPC, launch do app, emulador, o proprio
 * fluxo) — ver stories/187-maestro-flakiness-diagnostico.md.
 *
 * REGRAS QUE ESTE SCRIPT NAO PODE QUEBRAR (decisao 2 da story):
 *  - nao ha retry, nem espera de readiness, nem reordenacao dentro de uma
 *    batelada "normal": a batelada normal e exatamente `maestro test e2e/`, o
 *    mesmo comando do `pnpm test:ops`. `--reverse` e um braco declarado do
 *    experimento (separa hipotese de fluxo de hipotese de posicao), nunca um
 *    contorno;
 *  - o script e ferramenta de bancada: NAO entra em `pnpm test:ops` nem em CI;
 *  - nada entra no app em runtime — o ops.fonte nao sabe que existe Maestro
 *    (mesma regra da story 184).
 *
 * A honestidade do experimento depende do parser: saida que o script nao
 * entende vira `inconclusive`, NUNCA "verde". Uma batelada que o runner nao
 * conseguiu ler nao pode contar como evidencia a favor da hipotese nula.
 *
 * As guardas de ambiente (ANDROID_HOME, serial explicito com mais de um
 * aparelho, API level <= 34) sao as MESMAS funcoes do build-e2e-android.js da
 * story 184 — reaproveitadas, nao copiadas, para as mensagens nao divergirem.
 *
 * Decisoes ficam em funcoes puras (testadas em tests/maestroFlakinessRun.test.ts);
 * `main()` so injeta adb/spawn/fs reais.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const {
  MAX_SUPPORTED_API_LEVEL,
  resolveAndroidHome,
  adbPath,
  parseAdbDevices,
  resolveSerial,
  parseSerialFlag,
  parseApiLevel,
  assertSupportedApiLevel,
} = require('./build-e2e-android');

const APP_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..', '..');
/** Artefatos (screenshots, logcat, hierarquia de views) sao pesados: gitignored. */
const OUTPUT_ROOT = '.maestro-flakiness';
/** Default da story: 10 bateladas distinguem "1 em 10" de "1 em 3" sem virar acampamento. */
const DEFAULT_RUNS = 10;
const FLOWS_DIR = 'e2e';
const LOG_PREFIX = '[maestro:flakiness]';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** `--runs N` / `--runs=N`. Default 10 (decisao 3 da story). */
function parseRunsFlag(argv = [], fallback = DEFAULT_RUNS) {
  let raw;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--runs' || arg === '-n') raw = argv[i + 1];
    else if (arg.startsWith('--runs=')) raw = arg.slice('--runs='.length);
  }
  if (raw === undefined) return fallback;

  const runs = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error(`--runs precisa ser um inteiro >= 1 (recebido: "${raw}").`);
  }
  return runs;
}

/** `--reverse`: braco do experimento que separa "falha do fluxo" de "falha da posicao". */
function parseReverseFlag(argv = []) {
  return argv.includes('--reverse');
}

// ---------------------------------------------------------------------------
// Ordem dos fluxos
// ---------------------------------------------------------------------------

/**
 * Fluxos de topo do `e2e/` (helpers/ sao subfluxos chamados por `runFlow`, nao
 * entram na lista). Ordem normal = a mesma que o Maestro usa ao receber o
 * diretorio (alfabetica); `reverse` inverte.
 */
function flowFilesInOrder(entries = [], { reverse = false } = {}) {
  const flows = entries
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort((a, b) => a.localeCompare(b));
  return reverse ? [...flows].reverse() : flows;
}

/** Nome do fluxo como o Maestro reporta quando o yaml nao declara `name:`. */
function flowNameFromFile(file = '') {
  return path.basename(file).replace(/\.ya?ml$/i, '');
}

/**
 * Argumentos do `maestro`. Na ordem normal passamos o DIRETORIO — byte a byte o
 * que `pnpm test:ops` faz. So no braco `--reverse` a lista vira explicita, e o
 * proprio laudo registra isso.
 */
function maestroArgs({ serial, debugDir, flows = [], reverse = false } = {}) {
  const args = [];
  if (serial) args.push('--device', serial);
  args.push('test');
  // `--debug-output` e flag do SUBCOMANDO `test`, nao global: antes do `test` o
  // Maestro 2.6.0 morre com "Unknown options: '--debug-output'" e a batelada
  // inteira vira inconclusiva (medido em aparelho, 2026-08-17).
  if (debugDir) args.push('--debug-output', debugDir);
  if (reverse) args.push(...flows.map((flow) => path.posix.join(FLOWS_DIR, flow)));
  else args.push(`${FLOWS_DIR}/`);
  return args;
}

// ---------------------------------------------------------------------------
// Parser da saida do `maestro test`
// ---------------------------------------------------------------------------

/** Cores ANSI da saida do maestro (ESC = 27; o parser trabalha em texto puro). */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
/** Molduras que o Maestro desenha em volta da saida interativa (║ | > -). */
const BOX_CHARS = /^[\s║|>-]+/;
const FLOW_LINE = /^\[(Passed|Failed|Skipped)\]\s+(.+?)\s+\(([^)]+)\)\s*$/;
const SUMMARY_LINE = /^(\d+)\/(\d+)\s+Flows?\s+(Passed|Failed)\s*$/i;

function stripDecoration(line = '') {
  return line.replace(ANSI, '').replace(BOX_CHARS, '').trimEnd();
}

/** "1m 3s" -> 63000. Devolve null quando nao reconhece (e null nao vira zero). */
function parseDurationToMs(raw) {
  const text = String(raw ?? '').trim().toLowerCase();
  if (!text) return null;
  const match = text.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+(?:\.\d+)?)\s*s)?$/);
  if (!match || (!match[1] && !match[2] && !match[3])) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
}

function formatDurationMs(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}

/**
 * Le a saida de uma batelada.
 *
 * Contrato inegociavel: `passed` exige TUDO alinhado — pelo menos um fluxo
 * reconhecido, linha de sumario presente, sumario batendo com os fluxos lidos,
 * exit code 0 e nenhum fluxo reprovado/pulado. Qualquer desvio (saida truncada,
 * formato desconhecido, runner morrendo sem reprovar fluxo) devolve
 * `inconclusive` com o motivo. Saida inesperada NAO pode virar verde em
 * silencio: e assim que um experimento passa a mentir a favor da hipotese nula.
 */
function parseMaestroOutput({ stdout = '', stderr = '', exitCode = 0 } = {}) {
  const lines = `${stdout}\n${stderr}`.split(/\r?\n/).map(stripDecoration);

  const flows = [];
  let summary = null;

  lines.forEach((line) => {
    const flowMatch = line.match(FLOW_LINE);
    if (flowMatch) {
      flows.push({
        name: flowMatch[2].trim(),
        status: flowMatch[1].toLowerCase(),
        durationMs: parseDurationToMs(flowMatch[3]),
        rawDuration: flowMatch[3].trim(),
      });
      return;
    }
    const summaryMatch = line.match(SUMMARY_LINE);
    if (summaryMatch) {
      const count = Number(summaryMatch[1]);
      const total = Number(summaryMatch[2]);
      summary = {
        total,
        passed: /passed/i.test(summaryMatch[3]) ? count : total - count,
        failed: /failed/i.test(summaryMatch[3]) ? count : total - count,
        raw: line,
      };
    }
  });

  const failed = flows.filter((flow) => flow.status === 'failed');
  const skipped = flows.filter((flow) => flow.status === 'skipped');
  const inconclusive = (reason) => ({ status: 'inconclusive', flows, summary, failed, reason });

  if (flows.length === 0) {
    return inconclusive(
      'nenhum resultado de fluxo reconhecido na saida do maestro ' +
        '(driver caiu antes de rodar, saida vazia ou formato mudou).',
    );
  }
  if (!summary) {
    return inconclusive(
      `saida truncada: ${flows.length} fluxo(s) lido(s), mas a linha de sumario ` +
        '("N/M Flows Passed") nao apareceu — a batelada nao terminou.',
    );
  }
  if (summary.total !== flows.length) {
    return inconclusive(
      `sumario declara ${summary.total} fluxo(s) e so ${flows.length} linha(s) de ` +
        'resultado foram lidas — saida incompleta.',
    );
  }
  if (summary.failed !== failed.length) {
    return inconclusive(
      `sumario declara ${summary.failed} fluxo(s) reprovado(s) e ${failed.length} ` +
        'foram lidos — saida inconsistente.',
    );
  }
  if (skipped.length > 0) {
    return inconclusive(
      `fluxo(s) pulado(s): ${skipped.map((flow) => flow.name).join(', ')} — ` +
        'batelada incompleta, nao conta como verde.',
    );
  }
  if (failed.length > 0) {
    return { status: 'failed', flows, summary, failed, reason: null };
  }
  if (exitCode !== 0) {
    return inconclusive(
      `maestro saiu com status ${exitCode} sem reprovar nenhum fluxo — ` +
        'falha do runner/driver, nao da suite.',
    );
  }
  return { status: 'passed', flows, summary, failed, reason: null };
}

// ---------------------------------------------------------------------------
// Logcat
// ---------------------------------------------------------------------------

/** Recorte do logcat: processo do app + driver/gRPC + crash/ANR. O resto e ruido. */
const LOGCAT_PATTERNS = [
  /org\.fonte\.ops/i,
  /maestro/i,
  /grpc/i,
  /ActivityManager/i,
  /AndroidRuntime/i,
  /\bANR\b/i,
  /FATAL EXCEPTION/i,
];

function filterLogcat(raw = '') {
  return raw
    .split(/\r?\n/)
    .filter((line) => LOGCAT_PATTERNS.some((pattern) => pattern.test(line)))
    .join('\n');
}

// ---------------------------------------------------------------------------
// Agregacao
// ---------------------------------------------------------------------------

function rate(failures, executions) {
  return executions > 0 ? failures / executions : 0;
}

/**
 * Consolida N bateladas em duas leituras que o laudo precisa cruzar:
 *  - por FLUXO (a falha segue o yaml?);
 *  - por POSICAO na ordem (a falha segue o lugar na fila?).
 * Se a falha seguir a posicao e nao o fluxo, a hipotese (d) cai — e esse cruzamento
 * so existe porque as bateladas `--reverse` entram na mesma agregacao.
 */
function aggregateRuns(runs = []) {
  const byFlow = new Map();
  const byPosition = new Map();
  const inconclusive = [];

  runs.forEach((run) => {
    if (run.status === 'inconclusive') {
      inconclusive.push({ run: run.index, order: run.order, reason: run.reason });
    }
    (run.flows || []).forEach((flow, position) => {
      if (!byFlow.has(flow.name)) {
        byFlow.set(flow.name, {
          name: flow.name,
          executions: 0,
          failures: 0,
          passDurations: [],
          failDurations: [],
          positions: new Set(),
        });
      }
      const entry = byFlow.get(flow.name);
      entry.executions += 1;
      entry.positions.add(position + 1);
      if (flow.status === 'failed') {
        entry.failures += 1;
        if (flow.durationMs !== null && flow.durationMs !== undefined) {
          entry.failDurations.push(flow.durationMs);
        }
      } else if (flow.durationMs !== null && flow.durationMs !== undefined) {
        entry.passDurations.push(flow.durationMs);
      }

      const slot = position + 1;
      if (!byPosition.has(slot)) {
        byPosition.set(slot, { position: slot, executions: 0, failures: 0, flows: new Set() });
      }
      const posEntry = byPosition.get(slot);
      posEntry.executions += 1;
      posEntry.flows.add(flow.name);
      if (flow.status === 'failed') posEntry.failures += 1;
    });
  });

  const average = (values) =>
    values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

  const flows = [...byFlow.values()]
    .map((entry) => ({
      name: entry.name,
      executions: entry.executions,
      failures: entry.failures,
      failureRate: rate(entry.failures, entry.executions),
      avgDurationMs: average(entry.passDurations),
      failureDurationsMs: entry.failDurations,
      positions: [...entry.positions].sort((a, b) => a - b),
    }))
    .sort((a, b) => b.failures - a.failures || a.name.localeCompare(b.name));

  const positions = [...byPosition.values()]
    .map((entry) => ({
      position: entry.position,
      executions: entry.executions,
      failures: entry.failures,
      failureRate: rate(entry.failures, entry.executions),
      flows: [...entry.flows].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.position - b.position);

  return {
    runs: runs.length,
    runsByStatus: {
      passed: runs.filter((run) => run.status === 'passed').length,
      failed: runs.filter((run) => run.status === 'failed').length,
      inconclusive: inconclusive.length,
    },
    inconclusive,
    flows,
    positions,
  };
}

function formatPercent(value) {
  return `${(value * 100).toFixed(0)}%`;
}

function padRight(text, width) {
  return String(text).padEnd(width, ' ');
}

function padLeft(text, width) {
  return String(text).padStart(width, ' ');
}

/** Tabela final: fluxo x execucoes, falhas, tempo medio, tempo da falha. */
function formatTable(aggregate) {
  const header = ['fluxo', 'exec', 'falhas', 'taxa', 'tempo medio', 'tempo da falha'];
  const rows = aggregate.flows.map((flow) => [
    flow.name,
    String(flow.executions),
    String(flow.failures),
    formatPercent(flow.failureRate),
    formatDurationMs(flow.avgDurationMs),
    flow.failureDurationsMs.length > 0
      ? flow.failureDurationsMs.map(formatDurationMs).join(', ')
      : '—',
  ]);

  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => row[column].length), 0),
  );
  const line = (cells) =>
    cells
      .map((cell, column) =>
        column === 0 ? padRight(cell, widths[column]) : padLeft(cell, widths[column]),
      )
      .join('  ');

  const out = [line(header), widths.map((width) => '-'.repeat(width)).join('  '), ...rows.map(line)];

  out.push('');
  out.push('posicao na ordem  exec  falhas  taxa  fluxos');
  aggregate.positions.forEach((entry) => {
    out.push(
      `${padLeft(entry.position, 16)}  ${padLeft(entry.executions, 4)}  ` +
        `${padLeft(entry.failures, 6)}  ${padLeft(formatPercent(entry.failureRate), 4)}  ` +
        `${entry.flows.join(', ')}`,
    );
  });

  out.push('');
  out.push(
    `bateladas: ${aggregate.runs} (verdes ${aggregate.runsByStatus.passed}, ` +
      `vermelhas ${aggregate.runsByStatus.failed}, ` +
      `inconclusivas ${aggregate.runsByStatus.inconclusive})`,
  );
  aggregate.inconclusive.forEach((entry) => {
    out.push(`  ! batelada ${entry.run} (${entry.order}) inconclusiva: ${entry.reason}`);
  });

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Diretorios de saida
// ---------------------------------------------------------------------------

function sessionDirName(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function runDirName(index) {
  return `run-${String(index).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Orquestracao
// ---------------------------------------------------------------------------

/**
 * Roda o experimento. `adb`, `exec`, `capture` e o fs sao injetados para o teste
 * poder provar, entre outras coisas, que sem ANDROID_HOME nenhuma batelada
 * comeca e que API level 37 aborta antes de gastar 85 minutos de emulador.
 */
function run({
  env = {},
  platform = process.platform,
  argv = [],
  adb,
  exec,
  capture,
  listFlows = () => [],
  mkdir = () => {},
  writeFile = () => {},
  now = () => new Date(),
  log = console.log,
} = {}) {
  const runs = parseRunsFlag(argv);
  const reverse = parseReverseFlag(argv);

  const androidHome = resolveAndroidHome(env);
  const adbBinary = adbPath(androidHome, platform);

  const serial = resolveSerial({
    envSerial: parseSerialFlag(argv) || env.ANDROID_SERIAL,
    devicesStdout: adb(adbBinary, ['devices']),
  });

  const level = assertSupportedApiLevel(
    parseApiLevel(adb(adbBinary, ['-s', serial, 'shell', 'getprop', 'ro.build.version.sdk'])),
  );

  const order = reverse ? 'reverse' : 'normal';
  const flows = flowFilesInOrder(listFlows(), { reverse });
  const sessionDir = path.join(OUTPUT_ROOT, sessionDirName(now()));

  mkdir(path.join(APP_ROOT, sessionDir));
  log(`${LOG_PREFIX} aparelho ${serial} — API ${level}`);
  log(`${LOG_PREFIX} ${runs} batelada(s) em ordem ${order} — artefatos em ${sessionDir}`);

  const results = [];

  for (let index = 1; index <= runs; index += 1) {
    const runDir = path.join(sessionDir, runDirName(index));
    mkdir(path.join(APP_ROOT, runDir));

    // Decisao 4: banco recem-semeado antes de cada batelada tira a hipotese de
    // estado do banco da mesa (as suites ja sao idempotentes desde a story 182).
    exec('pnpm', ['test:setup'], { cwd: REPO_ROOT, env });
    // Zera o buffer para o logcat coletado ser o da batelada, e nao da anterior.
    adb(adbBinary, ['-s', serial, 'logcat', '-c']);

    const startedAt = now();
    const maestro = capture(
      'maestro',
      maestroArgs({ serial, debugDir: path.join(runDir, 'debug'), flows, reverse }),
      { cwd: APP_ROOT, env },
    );
    const finishedAt = now();

    const parsed = parseMaestroOutput({
      stdout: maestro.stdout,
      stderr: maestro.stderr,
      exitCode: maestro.status,
    });

    const logcat = filterLogcat(adb(adbBinary, ['-s', serial, 'logcat', '-d', '-v', 'time']));

    const result = {
      index,
      order,
      status: parsed.status,
      reason: parsed.reason,
      flows: parsed.flows,
      exitCode: maestro.status,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      wallClockMs: finishedAt.getTime() - startedAt.getTime(),
    };
    results.push(result);

    writeFile(path.join(APP_ROOT, runDir, 'maestro-stdout.txt'), maestro.stdout || '');
    writeFile(path.join(APP_ROOT, runDir, 'maestro-stderr.txt'), maestro.stderr || '');
    writeFile(path.join(APP_ROOT, runDir, 'logcat.txt'), logcat);
    writeFile(path.join(APP_ROOT, runDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);

    const failedNames = parsed.failed.map((flow) => flow.name).join(', ');
    log(
      `${LOG_PREFIX} batelada ${index}/${runs}: ${result.status}` +
        (failedNames ? ` — falhou: ${failedNames}` : '') +
        (parsed.reason ? ` — ${parsed.reason}` : ''),
    );
  }

  const aggregate = aggregateRuns(results);
  const table = formatTable(aggregate);

  writeFile(
    path.join(APP_ROOT, sessionDir, 'summary.json'),
    `${JSON.stringify({ serial, apiLevel: level, order, runs: results, aggregate }, null, 2)}\n`,
  );
  writeFile(path.join(APP_ROOT, sessionDir, 'summary.txt'), `${table}\n`);

  log(`\n${table}\n`);
  log(`${LOG_PREFIX} artefatos: ${path.join(APP_ROOT, sessionDir)}`);

  return { serial, level, order, runs: results, aggregate, sessionDir };
}

// ---------------------------------------------------------------------------
// Injecoes reais
// ---------------------------------------------------------------------------

function realAdb(binary, args) {
  const result = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) {
    throw new Error(`Falha ao executar "${binary} ${args.join(' ')}": ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `"${binary} ${args.join(' ')}" falhou (status ${result.status}): ` +
        `${(result.stderr || '').trim()}`,
    );
  }
  return result.stdout;
}

function realExec(command, args, { cwd, env } = {}) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`"${command} ${args.join(' ')}" falhou com status ${result.status}.`);
  }
}

/** Diferente do exec: falha de batelada e DADO do experimento, nao aborta a sessao. */
function realCapture(command, args, { cwd, env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    return { status: null, stdout: '', stderr: result.error.message };
  }
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function realListFlows() {
  return fs
    .readdirSync(path.join(APP_ROOT, FLOWS_DIR), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
}

function main() {
  try {
    run({
      env: process.env,
      platform: process.platform,
      argv: process.argv.slice(2),
      adb: realAdb,
      exec: realExec,
      capture: realCapture,
      listFlows: realListFlows,
      mkdir: (dir) => fs.mkdirSync(dir, { recursive: true }),
      writeFile: (file, content) => fs.writeFileSync(file, content, 'utf8'),
    });
  } catch (error) {
    console.error(`\n${LOG_PREFIX} ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  MAX_SUPPORTED_API_LEVEL,
  DEFAULT_RUNS,
  OUTPUT_ROOT,
  FLOWS_DIR,
  LOG_PREFIX,
  resolveAndroidHome,
  adbPath,
  parseAdbDevices,
  resolveSerial,
  parseSerialFlag,
  parseApiLevel,
  assertSupportedApiLevel,
  parseRunsFlag,
  parseReverseFlag,
  flowFilesInOrder,
  flowNameFromFile,
  maestroArgs,
  stripDecoration,
  parseDurationToMs,
  formatDurationMs,
  parseMaestroOutput,
  filterLogcat,
  aggregateRuns,
  formatTable,
  sessionDirName,
  runDirName,
  run,
  realAdb,
  realExec,
  realCapture,
  realListFlows,
  main,
};

if (require.main === module) main();
