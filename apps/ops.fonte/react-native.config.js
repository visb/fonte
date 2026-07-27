/**
 * Autolinking do RN gera `expo.core.ExpoModulesPackage` (classe inexistente) para
 * expo-modules-core neste monorepo, quebrando o build Android. Fixa o import correto.
 */
module.exports = {
  dependencies: {
    'expo-modules-core': {
      platforms: {
        android: {
          packageImportPath: 'import expo.modules.ExpoModulesPackage;',
        },
      },
    },
  },
};
