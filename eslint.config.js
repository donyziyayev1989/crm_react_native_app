// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // UI matni o'zbek tilida va apostroflar (so'm, Farg'ona) juda ko'p
      'react/no-unescaped-entities': 'off',
    },
  },
]);
