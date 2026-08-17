// Config dinamica do Expo (substitui app.json — o Expo nao pode ver os dois).
//
// Unico ponto dinamico: `usesCleartextTraffic`. O Android bloqueia HTTP puro no
// build de release, e `usesCleartextTraffic="true"` existe apenas no manifest de
// debug gerado pelo CNG. Logo, um APK de release apontado para a API de teste
// (`http://10.0.2.2:3001`) nunca consegue emitir a requisicao — e a tela de login
// mostra "WhatsApp/e-mail ou senha incorretos", mentindo sobre a causa.
//
// A liberacao e condicionada a URL que o proprio app recebe: so quando o destino
// e HTTP puro (dev/e2e). Producao usa https, entao o APK de producao continua com
// cleartext BLOQUEADO. Default sem env (string vazia) = bloqueado, o seguro.
//
// O env e lido por indirecao (`env.EXPO_PUBLIC_API_URL`, nao
// `process.env.EXPO_PUBLIC_API_URL`) de proposito: o babel-preset-expo substitui
// acessos literais a `process.env.EXPO_PUBLIC_*` pelo valor do `.env` em tempo de
// transform, o que congelaria esta decisao no valor de producao quando o arquivo
// e carregado pelo Jest. O Expo CLI avalia este arquivo em Node puro, sem babel,
// entao a leitura em runtime continua valendo no build.
const env = process.env;
const apiUrl = env.EXPO_PUBLIC_API_URL ?? '';
const allowCleartext = apiUrl.startsWith('http://');

module.exports = {
  expo: {
    name: 'OPS Fonte',
    slug: 'ops-fonte',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'ops-fonte',
    userInterfaceStyle: 'light',
    backgroundColor: '#272950',
    icon: './assets/icon.png',
    // NativeWind 4.x nao aplica `className` sob a New Architecture — o app
    // renderiza sem estilo nenhum. NAO ligar.
    newArchEnabled: false,
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#272950',
      },
      package: 'org.fonte.ops',
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-font',
      '@sentry/react-native',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 240,
          resizeMode: 'contain',
          backgroundColor: '#272950',
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            // expo-modules-core 2.2.3 exige Compose Compiler 1.5.15 / Kotlin 1.9.25
            // (RN 0.76 traz 1.9.24 por default).
            kotlinVersion: '1.9.25',
            usesCleartextTraffic: allowCleartext,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
  },
};
