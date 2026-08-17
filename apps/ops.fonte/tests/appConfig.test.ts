// Testes do app.config.js (story 184). O arquivo substituiu o app.json para
// poder condicionar `usesCleartextTraffic` a URL da API — e um modulo Node comum,
// avaliado no require, entao cada caso recarrega o modulo com o env desejado.
//
// Dois riscos justificam o spec:
//  1. o default tem que ser o SEGURO (sem env / https => cleartext BLOQUEADO);
//  2. a migracao de app.json nao pode ter perdido campo — `newArchEnabled: false`
//     em especial, cujo desaparecimento deixa o NativeWind sem aplicar `className`.

type ExpoPlugin = string | [string, Record<string, any>];
type ExpoConfig = {
  expo: {
    newArchEnabled: boolean;
    android: { package: string };
    plugins: ExpoPlugin[];
  };
};

function loadConfig(apiUrl?: string): ExpoConfig['expo'] {
  const previous = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = apiUrl;

  let config: ExpoConfig;
  try {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    config = require('../app.config') as ExpoConfig;
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = previous;
  }
  return config.expo;
}

function buildProperties(expo: ExpoConfig['expo']): Record<string, any> {
  const entry = expo.plugins.find(
    (plugin): plugin is [string, Record<string, any>] =>
      Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
  );
  if (!entry) throw new Error('plugin expo-build-properties ausente no app.config.js');
  return entry[1];
}

describe('app.config.js — cleartext condicional', () => {
  it('libera cleartext quando a API e HTTP puro (dev/e2e)', () => {
    const expo = loadConfig('http://10.0.2.2:3001/api/v1');
    expect(buildProperties(expo).android.usesCleartextTraffic).toBe(true);
  });

  it('mantem cleartext bloqueado quando a API e HTTPS (producao)', () => {
    const expo = loadConfig('https://fonte-production.up.railway.app/api/v1');
    expect(buildProperties(expo).android.usesCleartextTraffic).toBe(false);
  });

  it('mantem cleartext bloqueado sem EXPO_PUBLIC_API_URL (default seguro)', () => {
    const expo = loadConfig(undefined);
    expect(buildProperties(expo).android.usesCleartextTraffic).toBe(false);
  });

  it('mantem cleartext bloqueado com EXPO_PUBLIC_API_URL vazia', () => {
    const expo = loadConfig('');
    expect(buildProperties(expo).android.usesCleartextTraffic).toBe(false);
  });
});

describe('app.config.js — campos migrados do app.json', () => {
  it('mantem a New Architecture desligada (NativeWind depende disso)', () => {
    expect(loadConfig('https://api.example.com').newArchEnabled).toBe(false);
  });

  it('mantem o applicationId do Android', () => {
    expect(loadConfig('https://api.example.com').android.package).toBe('org.fonte.ops');
  });

  it('mantem o kotlinVersion exigido pelo expo-modules-core', () => {
    const expo = loadConfig('https://api.example.com');
    expect(buildProperties(expo).android.kotlinVersion).toBe('1.9.25');
  });

  it('mantem os demais plugins do app', () => {
    const names = loadConfig('https://api.example.com').plugins.map((plugin) =>
      Array.isArray(plugin) ? plugin[0] : plugin,
    );
    expect(names).toEqual([
      'expo-router',
      'expo-font',
      '@sentry/react-native',
      'expo-splash-screen',
      'expo-build-properties',
    ]);
  });
});
