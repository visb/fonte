// Testes das decisoes do scripts/build-e2e-android.js (story 184).
// O script nao e importado pelo app: e a receita do APK de e2e. O que se prova
// aqui sao as guardas que hoje custam horas quando faltam — API level do Maestro,
// ABI do aparelho, ANDROID_HOME e ambiguidade de multiplos emuladores.

// O spawnSync e mockado no arquivo inteiro: nenhum teste aqui deve tocar adb,
// npx ou gradle de verdade (os testes de decisao injetam seus proprios fakes).
jest.mock('child_process', () => ({ spawnSync: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { spawnSync } = require('child_process') as { spawnSync: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const script = require('../scripts/build-e2e-android');

const ANDROID_HOME = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk';

type AdbCall = { binary: string; args: string[] };
type ExecCall = { command: string; args: string[]; env: Record<string, string> };

function makeHarness({
  devices = 'List of devices attached\nemulator-5554\tdevice\n',
  sdk = '34',
  abi = 'x86_64',
}: { devices?: string; sdk?: string; abi?: string } = {}) {
  const adbCalls: AdbCall[] = [];
  const execCalls: ExecCall[] = [];
  const logs: string[] = [];

  const adb = (binary: string, args: string[]) => {
    adbCalls.push({ binary, args });
    if (args.includes('devices')) return devices;
    if (args.includes('ro.build.version.sdk')) return `${sdk}\n`;
    if (args.includes('ro.product.cpu.abi')) return `${abi}\n`;
    throw new Error(`adb inesperado: ${args.join(' ')}`);
  };
  const exec = (command: string, args: string[], env: Record<string, string>) => {
    execCalls.push({ command, args, env });
  };

  return { adb, exec, adbCalls, execCalls, log: (msg: string) => logs.push(msg), logs };
}

describe('build-e2e-android — guarda de API level (Maestro 2.6.x)', () => {
  it('segue em API 34, o nivel provado', () => {
    expect(script.assertSupportedApiLevel(34)).toBe(34);
    expect(script.assertSupportedApiLevel(30)).toBe(30);
  });

  it.each([36, 37])('aborta em API %i citando o nivel e o AVD sugerido', (level) => {
    expect(() => script.assertSupportedApiLevel(level)).toThrow(
      new RegExp(`API level ${level}`),
    );
    expect(() => script.assertSupportedApiLevel(level)).toThrow(/Maestro 2\.6\.x/);
    expect(() => script.assertSupportedApiLevel(level)).toThrow(/Maestro_API34/);
    expect(() => script.assertSupportedApiLevel(level)).toThrow(
      /system-images;android-34;google_apis;x86_64/,
    );
  });

  it('le o API level do getprop, ignorando espaco em branco', () => {
    expect(script.parseApiLevel(' 34\n')).toBe(34);
  });

  it('erra quando o getprop nao devolve numero', () => {
    expect(() => script.parseApiLevel('')).toThrow(/API level/);
    expect(() => script.parseApiLevel(undefined)).toThrow(/API level/);
  });

  it('aborta o build inteiro (sem chamar gradle) num aparelho em API 37', () => {
    const h = makeHarness({ sdk: '37' });
    expect(() =>
      script.run({ env: { ANDROID_HOME }, platform: 'win32', adb: h.adb, exec: h.exec, log: h.log }),
    ).toThrow(/API level 37/);
    expect(h.execCalls).toHaveLength(0);
  });
});

describe('build-e2e-android — ANDROID_HOME', () => {
  it('aceita ANDROID_HOME ou ANDROID_SDK_ROOT', () => {
    expect(script.resolveAndroidHome({ ANDROID_HOME })).toBe(ANDROID_HOME);
    expect(script.resolveAndroidHome({ ANDROID_SDK_ROOT: ANDROID_HOME })).toBe(ANDROID_HOME);
  });

  it('erra com mensagem clara quando falta, sem chamar adb nem gradle', () => {
    const h = makeHarness();
    expect(() => script.run({ env: {}, platform: 'win32', adb: h.adb, exec: h.exec, log: h.log }))
      .toThrow(/ANDROID_HOME nao definido/);
    expect(h.adbCalls).toHaveLength(0);
    expect(h.execCalls).toHaveLength(0);
  });

  it('trata ANDROID_HOME vazio como ausente', () => {
    expect(() => script.resolveAndroidHome({ ANDROID_HOME: '   ' })).toThrow(/ANDROID_HOME/);
    expect(() => script.resolveAndroidHome()).toThrow(/ANDROID_HOME/);
  });

  it('resolve o adb dentro do SDK conforme a plataforma', () => {
    expect(script.adbPath(ANDROID_HOME, 'win32')).toContain('platform-tools');
    expect(script.adbPath(ANDROID_HOME, 'win32')).toMatch(/adb\.exe$/);
    expect(script.adbPath('/home/u/Android/Sdk', 'linux')).toMatch(/adb$/);
  });
});

describe('build-e2e-android — escolha do aparelho', () => {
  const twoDevices =
    'List of devices attached\nemulator-5554\tdevice\nemulator-5556\tdevice\n\n';

  it('le os serials em estado device, ignorando offline/unauthorized', () => {
    expect(
      script.parseAdbDevices(
        'List of devices attached\nemulator-5554\tdevice\nemulator-5558\toffline\nABC123\tunauthorized\n',
      ),
    ).toEqual(['emulator-5554']);
  });

  it('usa o aparelho unico quando nao ha ambiguidade', () => {
    expect(
      script.resolveSerial({
        devicesStdout: 'List of devices attached\nemulator-5554\tdevice\n',
      }),
    ).toBe('emulator-5554');
  });

  it('falha listando os serials quando ha mais de um aparelho', () => {
    expect(() => script.resolveSerial({ devicesStdout: twoDevices })).toThrow(
      /emulator-5554, emulator-5556/,
    );
    expect(() => script.resolveSerial({ devicesStdout: twoDevices })).toThrow(/ANDROID_SERIAL/);
  });

  it('respeita ANDROID_SERIAL quando ha mais de um aparelho', () => {
    expect(
      script.resolveSerial({ envSerial: 'emulator-5556', devicesStdout: twoDevices }),
    ).toBe('emulator-5556');
  });

  it('recusa ANDROID_SERIAL que nao esta conectado', () => {
    expect(() =>
      script.resolveSerial({ envSerial: 'emulator-9999', devicesStdout: twoDevices }),
    ).toThrow(/nao esta entre os aparelhos conectados/);
  });

  it('orienta a subir o AVD quando nao ha aparelho nenhum', () => {
    expect(() =>
      script.resolveSerial({ devicesStdout: 'List of devices attached\n\n' }),
    ).toThrow(/Nenhum aparelho\/emulador conectado/);
  });

  it('aceita --device na linha de comando', () => {
    expect(script.parseSerialFlag(['--device', 'emulator-5556'])).toBe('emulator-5556');
    expect(script.parseSerialFlag(['--device=emulator-5554'])).toBe('emulator-5554');
    expect(script.parseSerialFlag(['-s', 'emulator-5554'])).toBe('emulator-5554');
    expect(script.parseSerialFlag([])).toBeUndefined();
    expect(script.parseSerialFlag(['--device'])).toBeUndefined();
  });

  it('a flag --device vence ANDROID_SERIAL e desfaz a ambiguidade no run', () => {
    const h = makeHarness({ devices: twoDevices });
    const result = script.run({
      env: { ANDROID_HOME, ANDROID_SERIAL: 'emulator-5554' },
      platform: 'win32',
      argv: ['--device', 'emulator-5556'],
      adb: h.adb,
      exec: h.exec,
      log: h.log,
    });
    expect(result.serial).toBe('emulator-5556');
    expect(h.adbCalls.slice(1).every((call) => call.args.slice(0, 2).join(' ') === '-s emulator-5556'))
      .toBe(true);
  });

  it('falha com dois emuladores ligados e nenhum serial escolhido', () => {
    const h = makeHarness({ devices: twoDevices });
    expect(() =>
      script.run({ env: { ANDROID_HOME }, platform: 'win32', adb: h.adb, exec: h.exec, log: h.log }),
    ).toThrow(/Mais de um aparelho conectado/);
    expect(h.execCalls).toHaveLength(0);
  });
});

describe('build-e2e-android — ABI', () => {
  it('normaliza a ABI lida do getprop', () => {
    expect(script.resolveAbi('x86_64\n')).toBe('x86_64');
    expect(script.resolveAbi(' arm64-v8a ')).toBe('arm64-v8a');
  });

  it('erra quando o aparelho nao devolve ABI', () => {
    expect(() => script.resolveAbi('')).toThrow(/ABI/);
    expect(() => script.resolveAbi(undefined)).toThrow(/ABI/);
  });

  it('repassa a ABI para -PreactNativeArchitectures', () => {
    expect(script.gradleArgs({ abi: 'x86_64', projectCacheDir: 'C:\\gtmp\\ops' })).toEqual([
      '-p',
      'android',
      'assembleRelease',
      '-PreactNativeArchitectures=x86_64',
      '--project-cache-dir',
      'C:\\gtmp\\ops',
    ]);
  });

  it.each([
    ['x86_64', 'emulador'],
    ['arm64-v8a', 'aparelho fisico'],
  ])('usa a ABI %s lida do %s no comando do gradle', (abi) => {
    const h = makeHarness({ abi });
    const result = script.run({
      env: { ANDROID_HOME },
      platform: 'win32',
      adb: h.adb,
      exec: h.exec,
      log: h.log,
    });
    expect(result.abi).toBe(abi);
    const gradle = h.execCalls[1];
    expect(gradle.args).toContain(`-PreactNativeArchitectures=${abi}`);
  });
});

describe('build-e2e-android — comandos e env do build', () => {
  it('exporta as env vars sem as quais o release quebra', () => {
    expect(script.buildEnv({ PATH: '/usr/bin' })).toEqual({
      PATH: '/usr/bin',
      EXPO_NO_METRO_WORKSPACE_ROOT: '1',
      NODE_ENV: 'production',
      EXPO_PUBLIC_API_URL: 'http://10.0.2.2:3001/api/v1',
      SENTRY_DISABLE_AUTO_UPLOAD: 'true',
    });
  });

  it('a URL exportada e HTTP puro — e o que liga o cleartext no app.config.js', () => {
    expect(script.E2E_API_URL.startsWith('http://')).toBe(true);
    expect(script.buildEnv({}).EXPO_PUBLIC_API_URL).toBe(script.E2E_API_URL);
  });

  it('sobrescreve uma EXPO_PUBLIC_API_URL de producao herdada do shell', () => {
    expect(
      script.buildEnv({ EXPO_PUBLIC_API_URL: 'https://fonte-production.up.railway.app/api/v1' })
        .EXPO_PUBLIC_API_URL,
    ).toBe('http://10.0.2.2:3001/api/v1');
  });

  it('faz prebuild limpo sem reinstalar dependencias', () => {
    expect(script.prebuildArgs()).toEqual([
      'expo',
      'prebuild',
      '-p',
      'android',
      '--clean',
      '--no-install',
    ]);
  });

  it('usa o wrapper do gradle da plataforma', () => {
    expect(script.gradleCommand('win32')).toMatch(/gradlew\.bat$/);
    expect(script.gradleCommand('darwin')).toMatch(/gradlew$/);
  });

  it('mantem o cache do gradle fora do projeto (move-lock no Windows)', () => {
    expect(script.resolveProjectCacheDir({}, 'win32')).toBe('C:\\gtmp\\ops');
    expect(script.resolveProjectCacheDir({}, 'linux')).not.toContain('ops.fonte');
    expect(script.resolveProjectCacheDir({ OPS_GRADLE_CACHE_DIR: 'D:\\cache' }, 'win32')).toBe(
      'D:\\cache',
    );
  });

  it('imprime o caminho do APK e o adb install do aparelho escolhido', () => {
    const h = makeHarness();
    script.run({ env: { ANDROID_HOME }, platform: 'win32', adb: h.adb, exec: h.exec, log: h.log });
    expect(h.logs.join('\n')).toContain(script.APK_RELATIVE_PATH.replace(/\//g, require('path').sep));
    expect(h.logs.join('\n')).toContain('adb -s emulator-5554 install -r');
  });

  it('monta o install hint com o serial', () => {
    expect(script.installHint('emulator-5556')).toBe(
      `adb -s emulator-5556 install -r ${script.APK_RELATIVE_PATH}`,
    );
  });

  it('roda prebuild antes do assembleRelease, ambos com o env do build', () => {
    const h = makeHarness();
    script.run({ env: { ANDROID_HOME }, platform: 'win32', adb: h.adb, exec: h.exec, log: h.log });
    expect(h.execCalls.map((call) => call.command)).toEqual(['npx', script.gradleCommand('win32')]);
    expect(h.execCalls[0].args).toEqual(script.prebuildArgs());
    h.execCalls.forEach((call) => {
      expect(call.env.SENTRY_DISABLE_AUTO_UPLOAD).toBe('true');
      expect(call.env.EXPO_NO_METRO_WORKSPACE_ROOT).toBe('1');
      expect(call.env.NODE_ENV).toBe('production');
    });
  });
});

describe('build-e2e-android — execucao real dos processos', () => {
  beforeEach(() => spawnSync.mockReset());

  it('devolve o stdout do adb quando o comando funciona', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'x86_64\n', stderr: '' });
    expect(script.realAdb('adb', ['shell', 'getprop', 'ro.product.cpu.abi'])).toBe('x86_64\n');
    expect(spawnSync).toHaveBeenCalledWith(
      'adb',
      ['shell', 'getprop', 'ro.product.cpu.abi'],
      { encoding: 'utf8' },
    );
  });

  it('erra citando o comando quando o adb nem executa (SDK sem platform-tools)', () => {
    spawnSync.mockReturnValue({ error: new Error('ENOENT') });
    expect(() => script.realAdb('adb', ['devices'])).toThrow(/adb devices.*ENOENT/);
  });

  it('erra com o stderr quando o adb devolve status nao-zero', () => {
    spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: 'device unauthorized\n' });
    expect(() => script.realAdb('adb', ['devices'])).toThrow(/device unauthorized/);
  });

  it('roda o build no diretorio do app, com o env dado e via shell', () => {
    spawnSync.mockReturnValue({ status: 0 });
    script.realExec('npx', script.prebuildArgs(), { NODE_ENV: 'production' });
    const options = spawnSync.mock.calls[0][2];
    expect(options).toMatchObject({
      env: { NODE_ENV: 'production' },
      stdio: 'inherit',
      shell: true,
    });
    expect(options.cwd).toMatch(/ops\.fonte$/);
  });

  it('propaga falha do gradle', () => {
    spawnSync.mockReturnValue({ status: 1 });
    expect(() => script.realExec('gradlew.bat', ['assembleRelease'], {})).toThrow(/status 1/);
    spawnSync.mockReturnValue({ error: new Error('spawn falhou') });
    expect(() => script.realExec('gradlew.bat', ['assembleRelease'], {})).toThrow('spawn falhou');
  });
});

describe('build-e2e-android — main()', () => {
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
    } finally {
      errorSpy.mockRestore();
      process.exitCode = exitCode;
      if (androidHome !== undefined) process.env.ANDROID_HOME = androidHome;
      if (sdkRoot !== undefined) process.env.ANDROID_SDK_ROOT = sdkRoot;
    }
  });
});
