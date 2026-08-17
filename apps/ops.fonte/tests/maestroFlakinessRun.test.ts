// Testes das decisoes do scripts/maestro-flakiness-run.js (story 187).
//
// O script nao e importado pelo app: e a bancada que mede a instabilidade da
// suite Maestro (11/13 numa batelada, 13/13 na seguinte, sem edicao — achado da
// rodada 182-184). O que se prova aqui e o que decide se o experimento vale:
//
//  1. o parser da saida do `maestro test` — saida inesperada NAO pode virar
//     "verde" em silencio, senao a bancada mente a favor da hipotese nula;
//  2. a agregacao de N bateladas — taxa por fluxo e por POSICAO na ordem, que e
//     o cruzamento que separa a hipotese (d) das hipoteses (b)/(c);
//  3. as guardas de ambiente herdadas da story 184 (ANDROID_HOME, serial
//     explicito, API level <= 34);
//  4. a regressao da decisao 2: `pnpm test:ops` continua sendo `maestro test
//     e2e/`, sem retry e sem espera nova.

// Nenhum teste aqui pode tocar adb, pnpm ou maestro de verdade.
jest.mock('child_process', () => ({ spawnSync: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { spawnSync } = require('child_process') as { spawnSync: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const script = require('../scripts/maestro-flakiness-run');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const buildScript = require('../scripts/build-e2e-android');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const opsPackageJson = require('../package.json');

const ANDROID_HOME = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk';
const ESC = String.fromCharCode(27);

/** Saida do `maestro test` como o CLI 2.6.x a imprime (com moldura e cor). */
function maestroOutput(
  flows: Array<[string, 'Passed' | 'Failed' | 'Skipped', string]>,
  { summary = true, colored = false }: { summary?: boolean; colored?: boolean } = {},
) {
  const lines = ['==== Suite status ====', ''];
  flows.forEach(([name, status, duration]) => {
    const label = colored ? `${ESC}[32m[${status}]${ESC}[0m` : `[${status}]`;
    lines.push(` ║  ${label} ${name} (${duration})`);
  });
  if (summary) {
    const failed = flows.filter(([, status]) => status === 'Failed').length;
    lines.push('');
    lines.push(
      failed > 0
        ? `${failed}/${flows.length} Flows Failed`
        : `${flows.length}/${flows.length} Flows Passed`,
    );
  }
  return lines.join('\n');
}

const GREEN_SUITE: Array<[string, 'Passed' | 'Failed' | 'Skipped', string]> = [
  ['auth.spec', 'Passed', '1m 2s'],
  ['census', 'Passed', '40s'],
  ['dashboard', 'Passed', '30s'],
];

type AdbCall = { binary: string; args: string[] };
type ExecCall = { command: string; args: string[]; options: { cwd?: string } };
type WriteCall = { file: string; content: string };

function makeHarness({
  devices = 'List of devices attached\nemulator-5556\tdevice\n',
  sdk = '34',
  outputs = [maestroOutput(GREEN_SUITE)],
  exitCodes = [0],
  logcat = 'noise\n01-01 00:00:00.000 I/ActivityManager: Start proc org.fonte.ops\n',
  flowFiles = ['auth.spec.yaml', 'census.yaml', 'dashboard.yaml', 'README.md'],
}: {
  devices?: string;
  sdk?: string;
  outputs?: string[];
  exitCodes?: number[];
  logcat?: string;
  flowFiles?: string[];
} = {}) {
  const adbCalls: AdbCall[] = [];
  const execCalls: ExecCall[] = [];
  const captureCalls: ExecCall[] = [];
  const writes: WriteCall[] = [];
  const dirs: string[] = [];
  const logs: string[] = [];
  let batch = 0;
  let clock = Date.UTC(2026, 7, 17, 12, 0, 0);

  const adb = (binary: string, args: string[]) => {
    adbCalls.push({ binary, args });
    if (args.includes('devices')) return devices;
    if (args.includes('ro.build.version.sdk')) return `${sdk}\n`;
    if (args.includes('-c')) return '';
    if (args.includes('-d')) return logcat;
    throw new Error(`adb inesperado: ${args.join(' ')}`);
  };

  return {
    adb,
    adbCalls,
    execCalls,
    captureCalls,
    writes,
    dirs,
    logs,
    exec: (command: string, args: string[], options: { cwd?: string }) => {
      execCalls.push({ command, args, options });
    },
    capture: (command: string, args: string[], options: { cwd?: string }) => {
      captureCalls.push({ command, args, options });
      const index = Math.min(batch, outputs.length - 1);
      const status = exitCodes[Math.min(batch, exitCodes.length - 1)];
      batch += 1;
      return { status, stdout: outputs[index], stderr: '' };
    },
    listFlows: () => flowFiles,
    mkdir: (dir: string) => dirs.push(dir),
    writeFile: (file: string, content: string) => writes.push({ file, content }),
    now: () => {
      clock += 60_000;
      return new Date(clock);
    },
    log: (message: string) => logs.push(message),
  };
}

function baseRun(harness: ReturnType<typeof makeHarness>, argv: string[] = ['--runs', '1']) {
  return script.run({
    env: { ANDROID_HOME },
    platform: 'win32',
    argv,
    adb: harness.adb,
    exec: harness.exec,
    capture: harness.capture,
    listFlows: harness.listFlows,
    mkdir: harness.mkdir,
    writeFile: harness.writeFile,
    now: harness.now,
    log: harness.log,
  });
}

describe('maestro-flakiness — parser da saida do maestro', () => {
  it('le uma batelada verde (fluxo, status e duracao de cada linha)', () => {
    const parsed = script.parseMaestroOutput({ stdout: maestroOutput(GREEN_SUITE), exitCode: 0 });
    expect(parsed.status).toBe('passed');
    expect(parsed.failed).toEqual([]);
    expect(parsed.flows.map((flow: { name: string }) => flow.name)).toEqual([
      'auth.spec',
      'census',
      'dashboard',
    ]);
    expect(parsed.flows[0].durationMs).toBe(62_000);
    expect(parsed.summary).toMatchObject({ total: 3, passed: 3, failed: 0 });
  });

  it('enxerga a batelada verde mesmo com as cores ANSI do CLI', () => {
    const parsed = script.parseMaestroOutput({
      stdout: maestroOutput(GREEN_SUITE, { colored: true }),
      exitCode: 0,
    });
    expect(parsed.status).toBe('passed');
    expect(parsed.flows).toHaveLength(3);
  });

  it('le a batelada com falha: 11/13 com census e dashboard caindo em 7s', () => {
    const stdout = maestroOutput([
      ['auth.spec', 'Passed', '1m 2s'],
      ['census', 'Failed', '7s'],
      ['dashboard', 'Failed', '7s'],
    ]);
    const parsed = script.parseMaestroOutput({ stdout, exitCode: 1 });
    expect(parsed.status).toBe('failed');
    expect(parsed.failed.map((flow: { name: string }) => flow.name)).toEqual([
      'census',
      'dashboard',
    ]);
    expect(parsed.failed[0].durationMs).toBe(7_000);
    expect(parsed.reason).toBeNull();
  });

  it('trata saida truncada como inconclusiva, nunca como verde', () => {
    const truncated = maestroOutput(GREEN_SUITE, { summary: false });
    const parsed = script.parseMaestroOutput({ stdout: truncated, exitCode: 0 });
    expect(parsed.status).toBe('inconclusive');
    expect(parsed.reason).toMatch(/truncada/);
    expect(parsed.flows).toHaveLength(3);
  });

  it.each([
    ['saida vazia', ''],
    ['crash do driver antes de qualquer fluxo', 'StatusRuntimeException: UNAVAILABLE'],
    ['formato desconhecido', 'tudo certo por aqui'],
  ])('nao chama de verde uma %s', (_case, stdout) => {
    const parsed = script.parseMaestroOutput({ stdout, exitCode: 0 });
    expect(parsed.status).toBe('inconclusive');
    expect(parsed.reason).toMatch(/nenhum resultado de fluxo reconhecido/);
  });

  it('desconfia quando o sumario nao bate com as linhas lidas', () => {
    const stdout = `${maestroOutput(GREEN_SUITE, { summary: false })}\n\n13/13 Flows Passed`;
    const parsed = script.parseMaestroOutput({ stdout, exitCode: 0 });
    expect(parsed.status).toBe('inconclusive');
    expect(parsed.reason).toMatch(/sumario declara 13 fluxo\(s\) e so 3/);
  });

  it('desconfia quando o sumario conta falhas que nao aparecem nas linhas', () => {
    const stdout = `${maestroOutput(GREEN_SUITE, { summary: false })}\n\n2/3 Flows Failed`;
    const parsed = script.parseMaestroOutput({ stdout, exitCode: 1 });
    expect(parsed.status).toBe('inconclusive');
    expect(parsed.reason).toMatch(/reprovado/);
  });

  it('nao chama de verde uma batelada com fluxo pulado', () => {
    const stdout = maestroOutput([
      ['auth.spec', 'Passed', '1m 2s'],
      ['census', 'Skipped', '0s'],
      ['dashboard', 'Passed', '30s'],
    ]);
    const parsed = script.parseMaestroOutput({ stdout, exitCode: 0 });
    expect(parsed.status).toBe('inconclusive');
    expect(parsed.reason).toMatch(/pulado\(s\): census/);
  });

  it('nao chama de verde um exit code nao-zero sem fluxo reprovado', () => {
    const parsed = script.parseMaestroOutput({ stdout: maestroOutput(GREEN_SUITE), exitCode: 1 });
    expect(parsed.status).toBe('inconclusive');
    expect(parsed.reason).toMatch(/status 1 sem reprovar nenhum fluxo/);
  });

  it('nao chama de verde o processo morto (status null do spawn)', () => {
    const parsed = script.parseMaestroOutput({
      stdout: maestroOutput(GREEN_SUITE),
      exitCode: null,
    });
    expect(parsed.status).toBe('inconclusive');
  });

  it('le a saida vinda do stderr tambem', () => {
    const parsed = script.parseMaestroOutput({
      stdout: '',
      stderr: maestroOutput(GREEN_SUITE),
      exitCode: 0,
    });
    expect(parsed.status).toBe('passed');
  });

  it('converte as duracoes que o maestro imprime', () => {
    expect(script.parseDurationToMs('7s')).toBe(7_000);
    expect(script.parseDurationToMs('1m 2s')).toBe(62_000);
    expect(script.parseDurationToMs('1h 1m 1s')).toBe(3_661_000);
    expect(script.parseDurationToMs('8m31s')).toBe(511_000);
  });

  it('devolve null (e nao zero) para duracao que nao reconhece', () => {
    expect(script.parseDurationToMs('')).toBeNull();
    expect(script.parseDurationToMs('varios minutos')).toBeNull();
    expect(script.parseDurationToMs(undefined)).toBeNull();
    expect(script.formatDurationMs(null)).toBe('—');
    expect(script.formatDurationMs(511_000)).toBe('8m31s');
    expect(script.formatDurationMs(7_000)).toBe('7s');
  });

  it('tira moldura e cor antes de tentar casar a linha', () => {
    expect(script.stripDecoration(` ║  ${ESC}[31m[Failed]${ESC}[0m census (7s)`)).toBe(
      '[Failed] census (7s)',
    );
  });
});

describe('maestro-flakiness — agregacao das N execucoes', () => {
  const runs = [
    {
      index: 1,
      order: 'normal',
      status: 'failed',
      reason: null,
      flows: [
        { name: 'auth.spec', status: 'passed', durationMs: 60_000 },
        { name: 'census', status: 'failed', durationMs: 7_000 },
        { name: 'dashboard', status: 'passed', durationMs: 30_000 },
      ],
    },
    {
      index: 2,
      order: 'normal',
      status: 'passed',
      reason: null,
      flows: [
        { name: 'auth.spec', status: 'passed', durationMs: 62_000 },
        { name: 'census', status: 'passed', durationMs: 41_000 },
        { name: 'dashboard', status: 'passed', durationMs: 32_000 },
      ],
    },
    {
      index: 3,
      order: 'reverse',
      status: 'failed',
      reason: null,
      flows: [
        { name: 'dashboard', status: 'passed', durationMs: 31_000 },
        { name: 'census', status: 'failed', durationMs: 7_000 },
        { name: 'auth.spec', status: 'passed', durationMs: 61_000 },
      ],
    },
  ];

  it('conta execucoes, falhas e taxa por fluxo', () => {
    const aggregate = script.aggregateRuns(runs);
    const census = aggregate.flows.find((flow: { name: string }) => flow.name === 'census');
    expect(census).toMatchObject({ executions: 3, failures: 2 });
    expect(census.failureRate).toBeCloseTo(2 / 3);
    const auth = aggregate.flows.find((flow: { name: string }) => flow.name === 'auth.spec');
    expect(auth).toMatchObject({ executions: 3, failures: 0, failureRate: 0 });
  });

  it('ordena a tabela pelo fluxo que mais falha', () => {
    expect(script.aggregateRuns(runs).flows[0].name).toBe('census');
  });

  it('tira a media so dos tempos verdes e guarda o tempo de cada falha', () => {
    const census = script
      .aggregateRuns(runs)
      .flows.find((flow: { name: string }) => flow.name === 'census');
    expect(census.avgDurationMs).toBe(41_000);
    expect(census.failureDurationsMs).toEqual([7_000, 7_000]);
  });

  it('deixa a media nula quando o fluxo nunca passou', () => {
    const aggregate = script.aggregateRuns([
      {
        index: 1,
        order: 'normal',
        status: 'failed',
        flows: [{ name: 'census', status: 'failed', durationMs: 7_000 }],
      },
    ]);
    expect(aggregate.flows[0].avgDurationMs).toBeNull();
  });

  it('conta tambem por POSICAO na ordem — o cruzamento que separa (d) de (b)/(c)', () => {
    const aggregate = script.aggregateRuns(runs);
    expect(aggregate.positions.map((entry: { position: number }) => entry.position)).toEqual([
      1, 2, 3,
    ]);
    // census cai nas duas bateladas, e nas duas ele esta na posicao 2 (inclusive
    // na invertida): a falha segue o fluxo, nao o lugar na fila.
    expect(aggregate.positions[1]).toMatchObject({ executions: 3, failures: 2 });
    expect(aggregate.positions[0]).toMatchObject({ executions: 3, failures: 0 });
    expect(aggregate.positions[1].flows).toEqual(['census']);
    expect(aggregate.positions[0].flows).toEqual(['auth.spec', 'dashboard']);
  });

  it('distingue a falha da primeira posicao quando a ordem inverte', () => {
    const aggregate = script.aggregateRuns([
      {
        index: 1,
        order: 'normal',
        status: 'failed',
        flows: [
          { name: 'census', status: 'failed', durationMs: 7_000 },
          { name: 'dashboard', status: 'passed', durationMs: 30_000 },
        ],
      },
      {
        index: 2,
        order: 'reverse',
        status: 'failed',
        flows: [
          { name: 'dashboard', status: 'failed', durationMs: 7_000 },
          { name: 'census', status: 'passed', durationMs: 40_000 },
        ],
      },
    ]);
    expect(aggregate.positions[0]).toMatchObject({ executions: 2, failures: 2, failureRate: 1 });
    expect(aggregate.positions[1].failures).toBe(0);
    aggregate.flows.forEach((flow: { failures: number }) => expect(flow.failures).toBe(1));
  });

  it('separa bateladas inconclusivas das verdes e das vermelhas', () => {
    const aggregate = script.aggregateRuns([
      ...runs,
      {
        index: 4,
        order: 'normal',
        status: 'inconclusive',
        reason: 'saida truncada',
        flows: [],
      },
    ]);
    expect(aggregate.runs).toBe(4);
    expect(aggregate.runsByStatus).toEqual({ passed: 1, failed: 2, inconclusive: 1 });
    expect(aggregate.inconclusive).toEqual([
      { run: 4, order: 'normal', reason: 'saida truncada' },
    ]);
  });

  it('nao quebra com nenhuma batelada', () => {
    expect(script.aggregateRuns([])).toMatchObject({ runs: 0, flows: [], positions: [] });
  });

  it('imprime a tabela fluxo x execucoes, falhas, tempo medio e tempo da falha', () => {
    const table = script.formatTable(script.aggregateRuns(runs));
    expect(table).toContain('fluxo');
    expect(table).toContain('tempo da falha');
    expect(table).toMatch(/census\s+3\s+2\s+67%\s+41s\s+7s, 7s/);
    expect(table).toContain('posicao na ordem');
    expect(table).toContain('bateladas: 3 (verdes 1, vermelhas 2, inconclusivas 0)');
  });

  it('deixa a batelada inconclusiva visivel na tabela, com o motivo', () => {
    const table = script.formatTable(
      script.aggregateRuns([
        { index: 1, order: 'reverse', status: 'inconclusive', reason: 'saida truncada', flows: [] },
      ]),
    );
    expect(table).toContain('batelada 1 (reverse) inconclusiva: saida truncada');
  });
});

describe('maestro-flakiness — guardas de ambiente (herdadas da story 184)', () => {
  it('usa as MESMAS funcoes do build-e2e-android (mensagens nao podem divergir)', () => {
    expect(script.assertSupportedApiLevel).toBe(buildScript.assertSupportedApiLevel);
    expect(script.resolveAndroidHome).toBe(buildScript.resolveAndroidHome);
    expect(script.resolveSerial).toBe(buildScript.resolveSerial);
    expect(script.MAX_SUPPORTED_API_LEVEL).toBe(34);
  });

  it('sem ANDROID_HOME: erro claro, sem chamar adb e sem rodar batelada', () => {
    const h = makeHarness();
    expect(() =>
      script.run({
        env: {},
        platform: 'win32',
        argv: [],
        adb: h.adb,
        exec: h.exec,
        capture: h.capture,
        listFlows: h.listFlows,
        mkdir: h.mkdir,
        writeFile: h.writeFile,
        now: h.now,
        log: h.log,
      }),
    ).toThrow(/ANDROID_HOME nao definido/);
    expect(h.adbCalls).toHaveLength(0);
    expect(h.captureCalls).toHaveLength(0);
    expect(h.execCalls).toHaveLength(0);
  });

  it('com dois aparelhos e nenhum serial: erro listando os aparelhos', () => {
    const h = makeHarness({
      devices: 'List of devices attached\nemulator-5554\tdevice\nemulator-5556\tdevice\n',
    });
    expect(() => baseRun(h)).toThrow(/emulator-5554, emulator-5556/);
    expect(() => baseRun(h)).toThrow(/Mais de um aparelho conectado/);
    expect(h.captureCalls).toHaveLength(0);
  });

  it('--device desfaz a ambiguidade e fixa o serial em todo o experimento', () => {
    const h = makeHarness({
      devices: 'List of devices attached\nemulator-5554\tdevice\nemulator-5556\tdevice\n',
    });
    const result = baseRun(h, ['--runs', '1', '--device', 'emulator-5556']);
    expect(result.serial).toBe('emulator-5556');
    expect(h.captureCalls[0].args).toContain('emulator-5556');
    h.adbCalls.slice(1).forEach((call) => expect(call.args.slice(0, 2)).toEqual(['-s', 'emulator-5556']));
  });

  it('aborta em API 37 citando o level, sem gastar batelada nenhuma', () => {
    const h = makeHarness({ sdk: '37' });
    expect(() => baseRun(h)).toThrow(/API level 37/);
    expect(() => baseRun(h)).toThrow(/Maestro 2\.6\.x/);
    expect(h.captureCalls).toHaveLength(0);
    expect(h.execCalls).toHaveLength(0);
  });

  it('aborta em API 36 (loop de heartbeat) com a mesma mensagem da story 184', () => {
    const h = makeHarness({ sdk: '36' });
    let message = '';
    try {
      baseRun(h);
    } catch (error) {
      message = (error as Error).message;
    }
    let reference = '';
    try {
      buildScript.assertSupportedApiLevel(36);
    } catch (error) {
      reference = (error as Error).message;
    }
    expect(message).toBe(reference);
    expect(message).toMatch(/Failed to record heartbeat/);
  });

  it('segue em API 34, o nivel provado', () => {
    const h = makeHarness({ sdk: '34' });
    expect(baseRun(h).level).toBe(34);
  });
});

describe('maestro-flakiness — CLI', () => {
  it('roda 10 bateladas por default (decisao 3 da story)', () => {
    expect(script.parseRunsFlag([])).toBe(10);
    expect(script.DEFAULT_RUNS).toBe(10);
  });

  it('aceita --runs N e --runs=N', () => {
    expect(script.parseRunsFlag(['--runs', '3'])).toBe(3);
    expect(script.parseRunsFlag(['--runs=13'])).toBe(13);
    expect(script.parseRunsFlag(['-n', '1'])).toBe(1);
  });

  it('recusa --runs que nao e inteiro positivo', () => {
    expect(() => script.parseRunsFlag(['--runs', '0'])).toThrow(/inteiro >= 1/);
    expect(() => script.parseRunsFlag(['--runs', 'dez'])).toThrow(/inteiro >= 1/);
    expect(() => script.parseRunsFlag(['--runs', '-2'])).toThrow(/inteiro >= 1/);
  });

  it('le --reverse', () => {
    expect(script.parseReverseFlag(['--reverse'])).toBe(true);
    expect(script.parseReverseFlag([])).toBe(false);
  });

  it('lista so os yaml de topo do e2e/, em ordem alfabetica', () => {
    expect(
      script.flowFilesInOrder(['dashboard.yaml', 'auth.spec.yaml', 'README.md', 'census.yml']),
    ).toEqual(['auth.spec.yaml', 'census.yml', 'dashboard.yaml']);
  });

  it('inverte a ordem com --reverse', () => {
    expect(
      script.flowFilesInOrder(['auth.spec.yaml', 'census.yaml', 'dashboard.yaml'], {
        reverse: true,
      }),
    ).toEqual(['dashboard.yaml', 'census.yaml', 'auth.spec.yaml']);
  });

  it('deriva o nome do fluxo do arquivo (o yaml nao declara name:)', () => {
    expect(script.flowNameFromFile('e2e/census.yaml')).toBe('census');
    expect(script.flowNameFromFile('auth.spec.yaml')).toBe('auth.spec');
  });

  it('carimba a sessao e cada batelada num diretorio proprio', () => {
    expect(script.sessionDirName(new Date('2026-08-17T12:34:56.789Z'))).toBe(
      '2026-08-17T12-34-56',
    );
    expect(script.runDirName(1)).toBe('run-01');
    expect(script.runDirName(10)).toBe('run-10');
  });
});

describe('maestro-flakiness — comando do maestro', () => {
  it('na ordem normal roda o diretorio inteiro: o mesmo comando do pnpm test:ops', () => {
    const args = script.maestroArgs({ serial: 'emulator-5556', debugDir: 'out/debug' });
    expect(args).toEqual([
      '--device',
      'emulator-5556',
      '--debug-output',
      'out/debug',
      'test',
      'e2e/',
    ]);
  });

  it('no braco --reverse passa os fluxos explicitamente, na ordem invertida', () => {
    const args = script.maestroArgs({
      serial: 'emulator-5556',
      debugDir: 'out/debug',
      reverse: true,
      flows: ['dashboard.yaml', 'census.yaml', 'auth.spec.yaml'],
    });
    expect(args.slice(-3)).toEqual([
      'e2e/dashboard.yaml',
      'e2e/census.yaml',
      'e2e/auth.spec.yaml',
    ]);
  });

  it('nao passa retry nem timeout: a bancada mede, nao conserta (decisao 2)', () => {
    const args = script.maestroArgs({ serial: 'emulator-5556', debugDir: 'out/debug' }).join(' ');
    expect(args).not.toMatch(/retry/i);
    expect(args).not.toMatch(/continuous/i);
    expect(args).not.toMatch(/timeout/i);
  });
});

describe('maestro-flakiness — logcat', () => {
  it('recorta o processo do app, o driver e os crashes; descarta o resto', () => {
    const raw = [
      '01-01 00:00:01.000 I/ActivityManager: Start proc org.fonte.ops',
      '01-01 00:00:02.000 D/WifiService: scan results',
      '01-01 00:00:03.000 W/maestro: Failed to record heartbeat',
      '01-01 00:00:04.000 E/grpc-default-executor: UNAVAILABLE',
      '01-01 00:00:05.000 E/AndroidRuntime: FATAL EXCEPTION: main',
      '01-01 00:00:06.000 I/chatty: identical 3 lines',
    ].join('\n');
    const filtered = script.filterLogcat(raw).split('\n');
    expect(filtered).toHaveLength(4);
    expect(filtered.join('\n')).toContain('org.fonte.ops');
    expect(filtered.join('\n')).toContain('UNAVAILABLE');
    expect(filtered.join('\n')).not.toContain('WifiService');
  });

  it('devolve string vazia quando nada casa', () => {
    expect(script.filterLogcat('01-01 00:00:02.000 D/WifiService: scan')).toBe('');
    expect(script.filterLogcat()).toBe('');
  });
});

describe('maestro-flakiness — sessao completa', () => {
  it('semeia o banco antes de CADA batelada (decisao 4) e limpa o logcat', () => {
    const h = makeHarness({ outputs: [maestroOutput(GREEN_SUITE)], exitCodes: [0] });
    baseRun(h, ['--runs', '2']);
    expect(h.execCalls).toHaveLength(2);
    h.execCalls.forEach((call) => {
      expect(call.command).toBe('pnpm');
      expect(call.args).toEqual(['test:setup']);
    });
    expect(h.adbCalls.filter((call) => call.args.includes('-c'))).toHaveLength(2);
  });

  it('guarda saida, logcat e resultado de cada batelada no diretorio carimbado', () => {
    const h = makeHarness();
    const result = baseRun(h, ['--runs', '1']);
    expect(result.sessionDir).toContain('.maestro-flakiness');
    const written = h.writes.map((entry) => entry.file);
    expect(written.some((file) => file.includes('run-01') && file.endsWith('maestro-stdout.txt')))
      .toBe(true);
    expect(written.some((file) => file.includes('run-01') && file.endsWith('logcat.txt'))).toBe(
      true,
    );
    expect(written.some((file) => file.includes('run-01') && file.endsWith('result.json'))).toBe(
      true,
    );
    expect(written.some((file) => file.endsWith('summary.json'))).toBe(true);
    expect(written.some((file) => file.endsWith('summary.txt'))).toBe(true);
    const logcatFile = h.writes.find((entry) => entry.file.endsWith('logcat.txt'));
    expect(logcatFile?.content).toContain('org.fonte.ops');
    expect(logcatFile?.content).not.toContain('noise');
  });

  it('manda o maestro escrever o debug dentro da pasta da batelada', () => {
    const h = makeHarness();
    baseRun(h, ['--runs', '1']);
    const debugIndex = h.captureCalls[0].args.indexOf('--debug-output');
    expect(debugIndex).toBeGreaterThan(-1);
    expect(h.captureCalls[0].args[debugIndex + 1]).toContain('run-01');
  });

  it('nao interrompe o experimento quando uma batelada fica vermelha', () => {
    const h = makeHarness({
      outputs: [
        maestroOutput([
          ['auth.spec', 'Passed', '1m 2s'],
          ['census', 'Failed', '7s'],
          ['dashboard', 'Passed', '30s'],
        ]),
        maestroOutput(GREEN_SUITE),
      ],
      exitCodes: [1, 0],
    });
    const result = baseRun(h, ['--runs', '2']);
    expect(result.runs.map((entry: { status: string }) => entry.status)).toEqual([
      'failed',
      'passed',
    ]);
    expect(result.aggregate.flows[0]).toMatchObject({ name: 'census', executions: 2, failures: 1 });
    expect(result.aggregate.runsByStatus).toEqual({ passed: 1, failed: 1, inconclusive: 0 });
  });

  it('registra a batelada ilegivel como inconclusiva, e nao como verde', () => {
    const h = makeHarness({ outputs: ['maestro morreu'], exitCodes: [1] });
    const result = baseRun(h, ['--runs', '1']);
    expect(result.runs[0].status).toBe('inconclusive');
    expect(result.runs[0].reason).toMatch(/nenhum resultado de fluxo/);
    expect(h.logs.join('\n')).toContain('inconclusive');
  });

  it('marca o braco do experimento no resultado e usa a ordem invertida', () => {
    const h = makeHarness();
    const result = baseRun(h, ['--runs', '1', '--reverse']);
    expect(result.order).toBe('reverse');
    expect(result.runs[0].order).toBe('reverse');
    expect(h.captureCalls[0].args.slice(-3)).toEqual([
      'e2e/dashboard.yaml',
      'e2e/census.yaml',
      'e2e/auth.spec.yaml',
    ]);
  });
});

describe('maestro-flakiness — execucao real dos processos', () => {
  beforeEach(() => spawnSync.mockReset());

  it('devolve o stdout do adb quando o comando funciona', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '34\n', stderr: '' });
    expect(script.realAdb('adb', ['shell', 'getprop', 'ro.build.version.sdk'])).toBe('34\n');
  });

  it('erra citando o comando quando o adb nem executa', () => {
    spawnSync.mockReturnValue({ error: new Error('ENOENT') });
    expect(() => script.realAdb('adb', ['devices'])).toThrow(/adb devices.*ENOENT/);
    spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: 'device offline\n' });
    expect(() => script.realAdb('adb', ['devices'])).toThrow(/device offline/);
  });

  it('propaga falha do pnpm test:setup (banco quebrado invalida a batelada)', () => {
    spawnSync.mockReturnValue({ status: 1 });
    expect(() => script.realExec('pnpm', ['test:setup'], {})).toThrow(/status 1/);
    spawnSync.mockReturnValue({ error: new Error('spawn falhou') });
    expect(() => script.realExec('pnpm', ['test:setup'], {})).toThrow('spawn falhou');
    spawnSync.mockReturnValue({ status: 0 });
    expect(script.realExec('pnpm', ['test:setup'], { cwd: 'C:\\code\\fonte' })).toBeUndefined();
  });

  it('captura a saida do maestro sem lancar: falha de batelada e dado, nao erro', () => {
    spawnSync.mockReturnValue({ status: 1, stdout: 'saida', stderr: 'erro' });
    expect(script.realCapture('maestro', ['test', 'e2e/'], {})).toEqual({
      status: 1,
      stdout: 'saida',
      stderr: 'erro',
    });
  });

  it('trata o maestro que nem inicia como batelada sem saida', () => {
    spawnSync.mockReturnValue({ error: new Error('maestro nao encontrado') });
    expect(script.realCapture('maestro', ['test', 'e2e/'], {})).toEqual({
      status: null,
      stdout: '',
      stderr: 'maestro nao encontrado',
    });
  });

  it('le os fluxos reais do e2e/ do ops.fonte', () => {
    const flows = script.flowFilesInOrder(script.realListFlows());
    expect(flows).toContain('census.yaml');
    expect(flows).toContain('dashboard.yaml');
    expect(flows.every((file: string) => /\.ya?ml$/.test(file))).toBe(true);
  });
});

describe('maestro-flakiness — main()', () => {
  it('reporta o erro e sai com status 1 em vez de estourar stack trace', () => {
    const androidHome = process.env.ANDROID_HOME;
    const sdkRoot = process.env.ANDROID_SDK_ROOT;
    const exitCode = process.exitCode;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.ANDROID_HOME;
    delete process.env.ANDROID_SDK_ROOT;
    try {
      script.main();
      expect(process.exitCode).toBe(1);
      expect(errorSpy.mock.calls[0][0]).toMatch(/ANDROID_HOME nao definido/);
      expect(errorSpy.mock.calls[0][0]).toContain(script.LOG_PREFIX);
    } finally {
      errorSpy.mockRestore();
      process.exitCode = exitCode;
      if (androidHome !== undefined) process.env.ANDROID_HOME = androidHome;
      if (sdkRoot !== undefined) process.env.ANDROID_SDK_ROOT = sdkRoot;
    }
  });
});

describe('regressao da decisao 2 — o runner nao muda', () => {
  it('pnpm test:ops continua sendo exatamente `maestro test e2e/`', () => {
    expect(opsPackageJson.scripts['test:maestro']).toBe('maestro test e2e/');
  });

  it('a bancada nao entrou no runner nem em nenhum script de teste', () => {
    Object.entries(opsPackageJson.scripts as Record<string, string>)
      .filter(([name]) => name.startsWith('test:'))
      .forEach(([, command]) => expect(command).not.toContain('maestro-flakiness'));
  });
});
