// Versão do ops.fonte (story 213). Fonte ÚNICA: o `version` do package.json do
// app — que é também a versão da plataforma inteira (tag git vX.Y.Z).
//
// O Android só aceita instalar por cima um APK com versionCode MAIOR que o
// instalado. Derivar o código da versão (em vez de manter um contador à mão)
// garante isso sem passo extra no release:
//
//   versionCode = major * 10000 + minor * 100 + patch      1.2.3 → 10203
//
// O esquema só é monotônico se minor e patch ficarem abaixo de 100 — 1.100.0
// colidiria com 2.0.0. Por isso essa faixa LANÇA em vez de gerar código errado.

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/;

function versionCode(version) {
  const match = SEMVER.exec(String(version ?? '').trim());
  if (!match) {
    throw new Error(`Versão inválida para o versionCode: "${version}" (esperado X.Y.Z)`);
  }
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  if (minor >= 100 || patch >= 100) {
    throw new Error(
      `Versão ${version}: minor e patch precisam ser < 100 para o versionCode ` +
        '(major*10000 + minor*100 + patch) continuar crescente. Suba a major.',
    );
  }
  return major * 10000 + minor * 100 + patch;
}

module.exports = { versionCode };
