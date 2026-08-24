import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `dist` : build web. `android` : coquille native Capacitor (projet Gradle +
  // bundle web généré par `cap sync` dans assets/public/) : ce n'est pas du code
  // source de l'app, eslint n'a rien à y faire.
  globalIgnores(['dist', 'android']),
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
      // Règles react-hooks EXPÉRIMENTALES (compiler-aware) : utiles comme indices
      // mais trop agressives pour BLOQUER la CI → warn. `error` reste réservé aux
      // vrais problèmes (rules-of-hooks, no-undef, no-unused-vars…).
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      // Concerne le Fast Refresh (HMR) en dev, pas la correction du code.
      'react-refresh/only-export-components': 'warn',
    },
  },
  // TypeScript (migration progressive de src/lib) : parser dédié + preset
  // recommandé. Le `no-unused-vars` du cœur est remplacé par sa version TS
  // (sinon faux positifs sur les types), en gardant le motif `^_`.
  ...tseslint.configs.recommended.map(c => ({ ...c, files: ['**/*.{ts,tsx}'] })),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Cloud Functions : code CommonJS (require/module/exports) exécuté par Node,
    // pas le navigateur, sinon require/module/Buffer/__dirname sortent en no-undef.
    files: ['functions/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
  {
    // Fonctions serverless Vercel (api/) : code Node ESM (process, fetch...), pas
    // le navigateur. Le Fast Refresh ne s'y applique pas.
    files: ['api/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node, fetch: 'readonly' },
    },
    rules: { 'react-refresh/only-export-components': 'off' },
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
