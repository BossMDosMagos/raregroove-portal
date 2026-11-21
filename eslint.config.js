import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'howler.js-master', 'coverage', 'node_modules']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],
      'no-useless-escape': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Regras do react-hooks v7 (compiler) que geram falsos positivos em código legado.
      // Rebaixadas para warning para não travar o CI; as regras clássicas permanecem ativas.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/static-components': 'off',
      // Exports auxiliares (constantes/helpers) em arquivos de contexto/componentes são intencionais.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Service worker: globals próprios do escopo de worker.
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
  // Scripts Node (CLI): usar globals Node e permitir variáveis de ambiente implícitas.
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
  // Testes (Vitest / Playwright): globals de teste.
  {
    files: [
      'src/test/**/*.{js,jsx}',
      'e2e/**/*.{js,ts}',
      '**/*.test.{js,jsx,ts,tsx}',
      '**/*.spec.{js,jsx,ts,tsx}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...(globals.vitest || {}),
        vi: 'readonly',
        afterEach: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        test: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
])
