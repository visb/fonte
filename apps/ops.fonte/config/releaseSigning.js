// Assinatura de release do APK do ops.fonte (story 213).
//
// Sem chave estável, cada build sai assinado com a chave debug da máquina e o
// Android recusa atualizar por cima — obriga a desinstalar, o que apaga o SQLite
// e a FILA OFFLINE do app (invariante offline-first). A keystore de release fica
// fora do git (secret do GitHub Actions + backup do responsável) e chega ao build
// só por variável de ambiente.
//
// `android/` é CNG (regenerado a cada prebuild): a assinatura entra por este
// config plugin, que reescreve o app/build.gradle gerado. Os SEGREDOS nunca
// passam pela config do Expo (que é embutida no app): o gradle os lê do ambiente
// na hora do build via System.getenv.

const SIGNING_ENV = ['OPS_KEYSTORE_PATH', 'OPS_KEYSTORE_PASSWORD', 'OPS_KEY_ALIAS', 'OPS_KEY_PASSWORD'];
const MARKER = '// @fonte release-signing (story 213)';

/**
 * true  = as quatro variáveis presentes → assina com a keystore de release;
 * false = nenhuma presente → mantém o debug-signing (build local de smoke).
 * Conjunto PARCIAL lança: no CI um secret faltando não pode virar, em silêncio,
 * um APK debug que ninguém consegue instalar por cima.
 */
function releaseSigningEnabled(env = {}) {
  const present = SIGNING_ENV.filter((name) => Boolean((env[name] || '').trim()));
  if (present.length === 0) return false;
  if (present.length < SIGNING_ENV.length) {
    const missing = SIGNING_ENV.filter((name) => !present.includes(name));
    throw new Error(
      `Assinatura de release incompleta: faltam ${missing.join(', ')}. ` +
        'Defina as quatro variáveis OPS_KEYSTORE_* / OPS_KEY_* ou nenhuma (debug-signing).',
    );
  }
  return true;
}

const RELEASE_SIGNING_CONFIG = `        release {
            ${MARKER}
            storeFile file(System.getenv("OPS_KEYSTORE_PATH"))
            storePassword System.getenv("OPS_KEYSTORE_PASSWORD")
            keyAlias System.getenv("OPS_KEY_ALIAS")
            keyPassword System.getenv("OPS_KEY_PASSWORD")
        }
`;

/**
 * Transforma o app/build.gradle gerado pelo prebuild: adiciona
 * `signingConfigs.release` e aponta o buildType release para ele. Idempotente.
 * Se o template do Expo mudar e os pontos de ancoragem sumirem, LANÇA — melhor
 * quebrar o prebuild do que publicar um APK debug achando que é release.
 */
function applyReleaseSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;

  const signingAnchor = /signingConfigs\s*\{\r?\n/;
  if (!signingAnchor.test(gradle)) {
    throw new Error('app/build.gradle sem bloco signingConfigs: template do Expo mudou?');
  }
  const withConfig = gradle.replace(signingAnchor, (match) => `${match}${RELEASE_SIGNING_CONFIG}`);

  const releaseBuildType = /(buildTypes\s*\{[\s\S]*?\brelease\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!releaseBuildType.test(withConfig)) {
    throw new Error('buildTypes.release sem signingConfig debug: template do Expo mudou?');
  }
  return withConfig.replace(releaseBuildType, '$1signingConfig signingConfigs.release');
}

/** Mod do app/build.gradle (só groovy — é o que o template do Expo 52 gera). */
function releaseSigningMod(config) {
  if (config.modResults.language !== 'groovy') {
    throw new Error(`app/build.gradle em ${config.modResults.language}; esperado groovy.`);
  }
  config.modResults.contents = applyReleaseSigning(config.modResults.contents);
  return config;
}

function withReleaseSigning(config) {
  // require tardio: o Jest e o app.config.js não precisam carregar o pacote de
  // config plugins só para decidir SE o plugin entra.
  const { withAppBuildGradle } = require('expo/config-plugins');
  return withAppBuildGradle(config, releaseSigningMod);
}

module.exports = {
  SIGNING_ENV,
  MARKER,
  releaseSigningEnabled,
  applyReleaseSigning,
  releaseSigningMod,
  withReleaseSigning,
};
