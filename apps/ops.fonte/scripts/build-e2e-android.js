#!/usr/bin/env node
/**
 * Build do APK de release do ops.fonte para a suite Maestro (`pnpm test:ops`).
 *
 * A receita nao pode morar em memoria de sessao: chegar num APK que instala e
 * fala com a API de teste depende de tres detalhes que nao sao obvios e cujos
 * sintomas apontam para o lugar errado (ver CLAUDE.md / skill fonte-frontend):
 *
 *  1. cleartext — release bloqueia HTTP puro; o `app.config.js` libera so quando
 *     `EXPO_PUBLIC_API_URL` e `http://` (o script exporta a URL da API de teste);
 *  2. API level — Maestro 2.6.x nao opera acima do 34 (gRPC UNAVAILABLE / loop de
 *     `Failed to record heartbeat`). O script aborta antes de gastar o build;
 *  3. ABI — o APK precisa da ABI do aparelho conectado (emulador x86_64,
 *     aparelho arm64-v8a). ABI errada = APK que nao instala.
 *
 * As decisoes ficam em funcoes puras (testadas em tests/buildE2eAndroid.test.ts);
 * `main()` so injeta adb/spawn reais.
 */

const { spawnSync } = require('child_process');
const path = require('path');

/** Maior API level em que o Maestro 2.6.x opera (provado em 2026-08-16). */
const MAX_SUPPORTED_API_LEVEL = 34;
const AVD_SYSTEM_IMAGE = 'system-images;android-34;google_apis;x86_64';
const AVD_NAME = 'Maestro_API34';
/** URL da API de teste vista de dentro do emulador (10.0.2.2 = loopback do host). */
const E2E_API_URL = 'http://10.0.2.2:3001/api/v1';
const APK_RELATIVE_PATH = path.posix.join(
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk',
);

const APP_ROOT = path.resolve(__dirname, '..');

/** Passo a passo para criar o AVD suportado — citado em toda mensagem de erro de API level. */
function avdInstructions() {
  return [
    `  sdkmanager "${AVD_SYSTEM_IMAGE}"`,
    `  avdmanager create avd -n ${AVD_NAME} -k "${AVD_SYSTEM_IMAGE}" -d pixel_6`,
  ].join('\n');
}

/** ANDROID_HOME (ou ANDROID_SDK_ROOT) e obrigatorio: sem SDK nao ha adb nem gradle. */
function resolveAndroidHome(env = {}) {
  const home = (env.ANDROID_HOME || env.ANDROID_SDK_ROOT || '').trim();
  if (!home) {
    throw new Error(
      'ANDROID_HOME nao definido. Aponte para o SDK do Android antes de buildar, ex.:\n' +
        '  PowerShell: $env:ANDROID_HOME="C:\\Users\\<user>\\AppData\\Local\\Android\\Sdk"\n' +
        '  bash:       export ANDROID_HOME="$HOME/Android/Sdk"',
    );
  }
  return home;
}

function adbPath(androidHome, platform = process.platform) {
  const binary = platform === 'win32' ? 'adb.exe' : 'adb';
  return path.join(androidHome, 'platform-tools', binary);
}

/** Serials em estado `device` na saida de `adb devices` (ignora offline/unauthorized). */
function parseAdbDevices(stdout = '') {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices'))
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts[1] === 'device')
    .map((parts) => parts[0]);
}

/**
 * Escolhe o aparelho. Com mais de um emulador ligado, `adb shell` falha com
 * "more than one device/emulator" — erro que nao diz o que fazer. Aqui a
 * ambiguidade vira mensagem listando os serials e como fixar um.
 */
function resolveSerial({ envSerial, devicesStdout } = {}) {
  const devices = parseAdbDevices(devicesStdout);
  const requested = (envSerial || '').trim();

  if (requested) {
    if (devices.length > 0 && !devices.includes(requested)) {
      throw new Error(
        `ANDROID_SERIAL="${requested}" nao esta entre os aparelhos conectados: ` +
          `${devices.join(', ') || '(nenhum)'}.`,
      );
    }
    return requested;
  }

  if (devices.length === 0) {
    throw new Error(
      'Nenhum aparelho/emulador conectado (`adb devices` vazio). Suba o AVD suportado:\n' +
        `${avdInstructions()}\n` +
        `  emulator -avd ${AVD_NAME}`,
    );
  }

  if (devices.length > 1) {
    throw new Error(
      `Mais de um aparelho conectado: ${devices.join(', ')}. ` +
        'Escolha um explicitamente (o adb nao adivinha):\n' +
        '  PowerShell: $env:ANDROID_SERIAL="emulator-5554"\n' +
        '  bash:       ANDROID_SERIAL=emulator-5554 pnpm --filter ops.fonte build:e2e:android\n' +
        '  ou:         pnpm --filter ops.fonte build:e2e:android --device emulator-5554',
    );
  }

  return devices[0];
}

/** `--device <serial>` / `--device=<serial>` na linha de comando (equivale a ANDROID_SERIAL). */
function parseSerialFlag(argv = []) {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--device' || arg === '-s') return (argv[i + 1] || '').trim() || undefined;
    if (arg.startsWith('--device=')) return arg.slice('--device='.length).trim() || undefined;
  }
  return undefined;
}

function parseApiLevel(raw) {
  const level = Number.parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isInteger(level)) {
    throw new Error(
      `Nao foi possivel ler o API level do aparelho (ro.build.version.sdk = "${raw}").`,
    );
  }
  return level;
}

/**
 * O muro que custou horas: Maestro 2.6.x morre em SDK 36 (loop de heartbeat) e
 * SDK 37 (gRPC UNAVAILABLE). Falhar aqui, citando o level, e o coracao da story.
 */
function assertSupportedApiLevel(level) {
  if (level > MAX_SUPPORTED_API_LEVEL) {
    throw new Error(
      `Aparelho em API level ${level}; o Maestro 2.6.x nao opera acima do ` +
        `${MAX_SUPPORTED_API_LEVEL}.\n` +
        'Sintomas de rodar acima disso (nao sao bug do app):\n' +
        '  - SDK 37: "Not able to reach the gRPC server" / StatusRuntimeException: UNAVAILABLE\n' +
        '  - SDK 36: o fluxo nem inicia, loop infinito de "Failed to record heartbeat"\n' +
        `Crie e use um AVD em API ${MAX_SUPPORTED_API_LEVEL}:\n` +
        `${avdInstructions()}\n` +
        `  emulator -avd ${AVD_NAME}`,
    );
  }
  return level;
}

/** ABI vem do aparelho: emulador x86_64, aparelho arm64-v8a. Cravar uma quebra a outra. */
function resolveAbi(raw) {
  const abi = String(raw ?? '').trim();
  if (!abi) {
    throw new Error(
      'Nao foi possivel ler a ABI do aparelho (ro.product.cpu.abi vazio). ' +
        'O aparelho esta autorizado (`adb devices`)?',
    );
  }
  return abi;
}

/**
 * Env do build. `.env` nao e carregado durante o bundle de release do gradle, por
 * isso tudo entra explicitamente aqui.
 */
function buildEnv(env = {}, { apiUrl = E2E_API_URL } = {}) {
  return {
    ...env,
    // Fixa a raiz do Metro no app (nao no workspace), senao o bundle de release
    // nao resolve `expo-router/entry`.
    EXPO_NO_METRO_WORKSPACE_ROOT: '1',
    NODE_ENV: 'production',
    // Tambem e o gatilho do cleartext no app.config.js (URL http:// = libera).
    EXPO_PUBLIC_API_URL: apiUrl,
    // Sem isso o release FALHA em :app:...SentryUpload_* por falta de org/slug.
    SENTRY_DISABLE_AUTO_UPLOAD: 'true',
  };
}

function prebuildArgs() {
  return ['expo', 'prebuild', '-p', 'android', '--clean', '--no-install'];
}

function gradleCommand(platform = process.platform) {
  return platform === 'win32'
    ? path.join('android', 'gradlew.bat')
    : path.join('.', 'android', 'gradlew');
}

/** Cache do gradle fora do projeto: no Windows, `.gradle` no projeto da erro de move-lock. */
function resolveProjectCacheDir(env = {}, platform = process.platform) {
  const custom = (env.OPS_GRADLE_CACHE_DIR || '').trim();
  if (custom) return custom;
  return platform === 'win32' ? 'C:\\gtmp\\ops' : path.join('/tmp', 'ops-fonte-gradle');
}

function gradleArgs({ abi, projectCacheDir }) {
  return [
    '-p',
    'android',
    'assembleRelease',
    `-PreactNativeArchitectures=${abi}`,
    '--project-cache-dir',
    projectCacheDir,
  ];
}

function installHint(serial, apkPath = APK_RELATIVE_PATH) {
  return `adb -s ${serial} install -r ${apkPath}`;
}

/**
 * Orquestra o build. `adb` e `exec` sao injetados para o teste poder provar,
 * entre outras coisas, que sem ANDROID_HOME o gradle nunca e chamado.
 */
function run({
  env = {},
  platform = process.platform,
  argv = [],
  adb,
  exec,
  log = console.log,
} = {}) {
  const androidHome = resolveAndroidHome(env);
  const adbBinary = adbPath(androidHome, platform);

  const serial = resolveSerial({
    envSerial: parseSerialFlag(argv) || env.ANDROID_SERIAL,
    devicesStdout: adb(adbBinary, ['devices']),
  });

  const level = assertSupportedApiLevel(
    parseApiLevel(adb(adbBinary, ['-s', serial, 'shell', 'getprop', 'ro.build.version.sdk'])),
  );
  const abi = resolveAbi(
    adb(adbBinary, ['-s', serial, 'shell', 'getprop', 'ro.product.cpu.abi']),
  );

  log(`[build:e2e:android] aparelho ${serial} — API ${level}, ABI ${abi}`);

  const childEnv = buildEnv(env);
  exec('npx', prebuildArgs(), childEnv);
  exec(gradleCommand(platform), gradleArgs({
    abi,
    projectCacheDir: resolveProjectCacheDir(env, platform),
  }), childEnv);

  log(`[build:e2e:android] APK: ${path.join(APP_ROOT, APK_RELATIVE_PATH)}`);
  log(`[build:e2e:android] instale com: ${installHint(serial)}`);

  return { serial, level, abi };
}

function realAdb(binary, args) {
  const result = spawnSync(binary, args, { encoding: 'utf8' });
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

function realExec(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: APP_ROOT,
    env,
    stdio: 'inherit',
    shell: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`"${command} ${args.join(' ')}" falhou com status ${result.status}.`);
  }
}

function main() {
  try {
    run({
      env: process.env,
      platform: process.platform,
      argv: process.argv.slice(2),
      adb: realAdb,
      exec: realExec,
    });
  } catch (error) {
    console.error(`\n[build:e2e:android] ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  MAX_SUPPORTED_API_LEVEL,
  AVD_NAME,
  AVD_SYSTEM_IMAGE,
  E2E_API_URL,
  APK_RELATIVE_PATH,
  avdInstructions,
  resolveAndroidHome,
  adbPath,
  parseAdbDevices,
  resolveSerial,
  parseSerialFlag,
  parseApiLevel,
  assertSupportedApiLevel,
  resolveAbi,
  buildEnv,
  prebuildArgs,
  gradleCommand,
  resolveProjectCacheDir,
  gradleArgs,
  installHint,
  run,
  realAdb,
  realExec,
  main,
};

if (require.main === module) main();
