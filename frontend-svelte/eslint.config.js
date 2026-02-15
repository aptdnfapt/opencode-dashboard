import js from '@eslint/js'
import ts from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'

export default ts.config(
  // Base JS/TS rules
  js.configs.recommended,
  ...ts.configs.recommended,

  // Svelte-specific rules
  ...svelte.configs['flat/recommended'],

  // Global settings
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },

  // TypeScript inside Svelte files
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser
      }
    }
  },

  // Svelte 5 rune modules (*.svelte.ts) — need Svelte parser
  {
    files: ['**/*.svelte.ts'],
    languageOptions: {
      parser: svelte.parser,
      parserOptions: {
        parser: ts.parser
      }
    }
  },

  // Custom rules
  {
    rules: {
      // Prefer type-only imports
      '@typescript-eslint/consistent-type-imports': 'warn',

      // Allow unused vars prefixed with _
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],

      // Allow explicit any sparingly (warn, not error)
      '@typescript-eslint/no-explicit-any': 'warn',

      // No console.log in prod (console.warn/error ok)
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // We sanitize @html with DOMPurify — safe to allow
      'svelte/no-at-html-tags': 'off',

      // SvelteMap/SvelteSet migration is a big refactor — warn only
      'svelte/prefer-svelte-reactivity': 'warn',

      // Each key is good practice but not critical — warn only
      'svelte/require-each-key': 'warn',

      // Navigation resolve() — Svelte 5 pattern, warn for now
      'svelte/no-navigation-without-resolve': 'warn'
    }
  },

  // Ignore build output and generated files
  {
    ignores: [
      'build/',
      '.svelte-kit/',
      'node_modules/',
      'dist/'
    ]
  }
)
