// Versionamento e assinatura de release do ops.fonte (story 213).
//
// app.config.js é avaliado no require; cada caso recarrega o módulo com o env
// desejado (mesma técnica do tests/appConfig.test.ts).

// Escopo de módulo: os specs de tests/ declaram helpers homônimos (loadConfig,
// ExpoConfig) e, como scripts globais, colidiriam no tsc.
export {};

/* eslint-disable @typescript-eslint/no-var-requires */
const { versionCode } = require('../config/version');
const {
  SIGNING_ENV,
  MARKER,
  releaseSigningEnabled,
  applyReleaseSigning,
  releaseSigningMod,
  withReleaseSigning,
} = require('../config/releaseSigning');

const FULL_ENV = {
  OPS_KEYSTORE_PATH: '/tmp/ops-release.keystore',
  OPS_KEYSTORE_PASSWORD: 'x',
  OPS_KEY_ALIAS: 'ops',
  OPS_KEY_PASSWORD: 'y',
};

// Recorte fiel do app/build.gradle gerado pelo prebuild do Expo 52.
const GRADLE = `android {
    defaultConfig {
        applicationId 'org.fonte.ops'
        versionCode 10000
        versionName "1.0.0"
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            signingConfig signingConfigs.debug
            minifyEnabled enableProguardInReleaseBuilds
        }
    }
}
`;

type ExpoConfig = {
  expo: {
    version: string;
    android: { versionCode: number };
    plugins: unknown[];
  };
};

function loadConfig(env: Record<string, string | undefined>): ExpoConfig['expo'] {
  const previous: Record<string, string | undefined> = {};
  for (const name of SIGNING_ENV as string[]) {
    previous[name] = process.env[name];
    if (env[name] === undefined) delete process.env[name];
    else process.env[name] = env[name];
  }
  try {
    jest.resetModules();
    return (require('../app.config') as ExpoConfig).expo;
  } finally {
    for (const name of SIGNING_ENV as string[]) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

describe('versionCode', () => {
  it('deriva major*10000 + minor*100 + patch', () => {
    expect(versionCode('1.2.3')).toBe(10203);
    expect(versionCode('1.0.0')).toBe(10000);
    expect(versionCode('0.0.1')).toBe(1);
    expect(versionCode('2.0.0-rc.1')).toBe(20000);
  });

  it('é crescente entre versões consecutivas', () => {
    expect(versionCode('1.99.99')).toBeLessThan(versionCode('2.0.0'));
    expect(versionCode('1.9.0')).toBeLessThan(versionCode('1.10.0'));
  });

  it('lança com minor ou patch >= 100', () => {
    expect(() => versionCode('1.100.0')).toThrow(/< 100/);
    expect(() => versionCode('1.0.100')).toThrow(/< 100/);
  });

  it('lança com versão fora do semver', () => {
    expect(() => versionCode('1.0')).toThrow(/Versão inválida/);
    expect(() => versionCode(undefined)).toThrow(/Versão inválida/);
  });
});

describe('releaseSigningEnabled', () => {
  it('sem nenhuma variável: debug-signing', () => {
    expect(releaseSigningEnabled({})).toBe(false);
    expect(releaseSigningEnabled()).toBe(false);
  });

  it('com as quatro variáveis: assina com a keystore de release', () => {
    expect(releaseSigningEnabled(FULL_ENV)).toBe(true);
  });

  it('conjunto parcial lança apontando o que falta', () => {
    expect(() =>
      releaseSigningEnabled({ OPS_KEYSTORE_PATH: '/tmp/k', OPS_KEY_ALIAS: '   ' }),
    ).toThrow(/OPS_KEYSTORE_PASSWORD, OPS_KEY_ALIAS, OPS_KEY_PASSWORD/);
  });
});

describe('applyReleaseSigning', () => {
  it('adiciona signingConfigs.release lendo do ambiente e aponta o buildType release', () => {
    const out = applyReleaseSigning(GRADLE);
    expect(out).toContain(MARKER);
    expect(out).toContain('storeFile file(System.getenv("OPS_KEYSTORE_PATH"))');
    expect(out).toContain('keyPassword System.getenv("OPS_KEY_PASSWORD")');
    const releaseBuildType = out.slice(out.indexOf('buildTypes'));
    expect(releaseBuildType).toMatch(/release \{[\s\S]*signingConfig signingConfigs\.release/);
    // O debug continua com a chave debug.
    expect(releaseBuildType).toMatch(/debug \{\s*signingConfig signingConfigs\.debug/);
  });

  it('nunca grava segredo literal no gradle', () => {
    const out = applyReleaseSigning(GRADLE);
    expect(out).not.toContain('/tmp/ops-release.keystore');
  });

  it('é idempotente', () => {
    const once = applyReleaseSigning(GRADLE);
    expect(applyReleaseSigning(once)).toBe(once);
  });

  it('aceita CRLF', () => {
    expect(applyReleaseSigning(GRADLE.replace(/\n/g, '\r\n'))).toContain(MARKER);
  });

  it('lança se o template perdeu o bloco signingConfigs', () => {
    expect(() => applyReleaseSigning('android {\n}\n')).toThrow(/signingConfigs/);
  });

  it('lança se o buildType release não usa a chave debug', () => {
    const gradle = GRADLE.replace(
      /(release \{\n\s*\/\/ Caution[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
      '$1',
    );
    expect(() => applyReleaseSigning(gradle)).toThrow(/buildTypes\.release/);
  });
});

describe('releaseSigningMod / withReleaseSigning', () => {
  it('o mod reescreve o build.gradle groovy', () => {
    const config = { modResults: { language: 'groovy', contents: GRADLE } };
    expect(releaseSigningMod(config).modResults.contents).toContain(MARKER);
  });

  it('o mod recusa build.gradle em kotlin', () => {
    const config = { modResults: { language: 'kt', contents: '' } };
    expect(() => releaseSigningMod(config)).toThrow(/esperado groovy/);
  });

  it('o plugin registra o mod do app/build.gradle', () => {
    const config = withReleaseSigning({ name: 'OPS Fonte', slug: 'ops-fonte' });
    expect(typeof config.mods?.android?.appBuildGradle).toBe('function');
  });
});

describe('app.config.js — versão e assinatura', () => {
  it('lê a versão do package.json e deriva o versionCode', () => {
    const { version } = require('../package.json');
    const expo = loadConfig({});
    expect(expo.version).toBe(version);
    expect(expo.android.versionCode).toBe(versionCode(version));
  });

  it('sem env de keystore não aplica a assinatura de release', () => {
    const expo = loadConfig({});
    expect(expo.plugins).not.toContain(withReleaseSigning);
    expect(expo.plugins.some((plugin) => typeof plugin === 'function')).toBe(false);
  });

  it('com env de keystore aplica a assinatura de release', () => {
    const expo = loadConfig(FULL_ENV);
    const plugin = expo.plugins.find((entry) => typeof entry === 'function') as
      | ((config: Record<string, unknown>) => { mods?: { android?: Record<string, unknown> } })
      | undefined;
    expect(plugin).toBeDefined();
    expect(plugin!.name).toBe('withReleaseSigning');
  });

  it('env parcial quebra a config (não vira APK debug em silêncio)', () => {
    expect(() => loadConfig({ OPS_KEYSTORE_PATH: '/tmp/k' })).toThrow(/incompleta/);
  });
});
