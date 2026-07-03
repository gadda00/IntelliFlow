/**
 * ESLint Configuration for Busara
 * ================================
 * 
 * This configuration provides a consistent linting experience across all Busara projects.
 * It includes TypeScript, React, Next.js, and Prettier support.
 */

module.exports = {
  // Base configuration for TypeScript projects
  base: {
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:@typescript-eslint/recommended-requiring-type-checking',
      'plugin:import/recommended',
      'plugin:import/typescript',
      'prettier',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      project: true,
      ecmaFeatures: {
        jsx: true,
      },
    },
    plugins: [
      '@typescript-eslint',
      'import',
      'simple-import-sort',
      'unused-imports',
    ],
    settings: {
      'import/resolver': {
        typescript: true,
        node: true,
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'off', // Handled by unused-imports
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      
      // Import rules
      'import/no-unresolved': 'error',
      'import/named': 'error',
      'import/namespace': 'error',
      'import/default': 'error',
      'import/export': 'error',
      'import/no-named-as-default': 'error',
      'import/no-named-as-default-member': 'error',
      'import/no-duplicates': 'error',
      'import/no-cycle': 'error',
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': 'error',
      'import/dynamic-import-chunkname': 'error',
      
      // Simple import sort
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      
      // Unused imports
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      
      // General rules
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-destructuring': 'error',
      'prefer-template': 'error',
      'prefer-arrow-callback': 'error',
      'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
      'arrow-body-style': ['error', 'as-needed'],
      'no-nested-ternary': 'error',
      'no-unneeded-ternary': 'error',
      'no-mixed-operators': 'error',
      'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
      'no-param-reassign': 'error',
      'no-return-assign': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'error',
      'no-unused-expressions': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'no-void': ['error', { allowAsStatement: true }],
      'require-await': 'error',
      'spaced-comment': ['error', 'always', { markers: ['/'] }],
      
      // Complexity
      complexity: ['error', 10],
      'max-depth': ['error', 4],
      'max-lines': ['error', 300],
      'max-lines-per-function': ['error', 50],
      'max-params': ['error', 4],
      
      // Naming
      'id-length': ['error', { min: 2, max: 30, exceptions: ['_', 'e', 'i', 'j', 'k'] }],
      'id-match': ['error', '^[a-z][a-zA-Z0-9]*$', { properties: true, classFields: true }],
      'camelcase': ['error', { allow: ['^UNSAFE_', '^unstable_'] }],
      'new-cap': ['error', { newIsCap: true, capIsNew: false }],
      'no-underscore-dangle': ['error', { allow: ['__typename'] }],
    },
    overrides: [
      {
        files: ['*.ts', '*.tsx'],
        rules: {
          'no-undef': 'off',
        },
      },
      {
        files: ['*.js', '*.jsx'],
        rules: {
          '@typescript-eslint/explicit-function-return-type': 'off',
          '@typescript-eslint/explicit-module-boundary-types': 'off',
        },
      },
      {
        files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
        rules: {
          'no-console': 'off',
          'max-lines': 'off',
          'max-lines-per-function': 'off',
          'max-params': 'off',
        },
      },
      {
        files: ['**/*.d.ts'],
        rules: {
          'import/no-duplicates': 'off',
          'simple-import-sort/imports': 'off',
          'unused-imports/no-unused-imports': 'off',
        },
      },
    ],
  },
  
  // Configuration for Next.js projects
  next: {
    extends: ['eslint-config-busara/base', 'next/core-web-vitals'],
    rules: {
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-img-element': 'error',
      '@next/next/no-duplicate-head': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
  
  // Configuration for React projects
  react: {
    extends: ['eslint-config-busara/base'],
    plugins: ['react', 'react-hooks', 'jsx-a11y'],
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/self-closing-comp': 'error',
      'react/void-dom-elements-no-children': 'error',
      'react/no-danger': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-find-dom-node': 'error',
      'react/no-is-mounted': 'error',
      'react/no-render-return-value': 'error',
      'react/no-string-refs': 'error',
      'react/no-unescaped-entities': 'error',
      'react/no-unknown-property': 'error',
      'react/require-render-return': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/heading-has-content': 'error',
      'jsx-a11y/iframe-has-title': 'error',
      'jsx-a11y/img-redundant-alt': 'error',
      'jsx-a11y/no-access-key': 'error',
      'jsx-a11y/no-distracting-elements': 'error',
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/scope': 'error',
    },
  },
  
  // Configuration for Node.js projects
  node: {
    extends: ['eslint-config-busara/base'],
    env: {
      node: true,
    },
    rules: {
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
};
