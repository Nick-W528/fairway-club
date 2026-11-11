// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'supabase/functions/*'],
  },
  {
    rules: {
      // React Native renders text literally; HTML entity escaping doesn't apply.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
