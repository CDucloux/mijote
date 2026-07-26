import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      // __APP_VERSION__ est injecté au build par Vite (define), pas un undef réel.
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Autorise les variables/arguments préfixés par _ (rejets volontaires de
      // déstructuration, ex. `const { _ro, ...rest } = obj`).
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
  {
    // Cloud Functions : code CommonJS (require/module/exports) exécuté par Node,
    // pas le navigateur — sinon require/module/Buffer/__dirname sortent en no-undef.
    files: ['functions/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
  {
    // Fichiers de tests : ESM (Vitest) + globals Node. Doit passer après l'override
    // functions/ pour rétablir sourceType: module sur les .test.js de functions/.
    files: ['**/*.test.{js,jsx}'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
])
