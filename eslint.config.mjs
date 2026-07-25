import eslint from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const webFiles = ['apps/web/**/*.{js,jsx,mjs,ts,tsx,mts,cts}'];
const nextWebConfigs = nextVitals
  .filter((config) => config.ignores === undefined && config.name !== 'next/typescript')
  .map((config) => {
    const scopedConfig = {
      ...config,
      files: config.files?.map((pattern) => `apps/web/${pattern}`) ?? webFiles,
    };

    // eslint-config-next 16.2.11 still bundles a parser release whose peer range
    // stops at ESLint 9. The workspace parser supports ESLint 10 and TSX, while
    // the compatible Next/Hooks/a11y plugins and rules remain active below.
    delete scopedConfig.languageOptions;

    // eslint-plugin-react 7.37.5 still calls context APIs removed in ESLint 10.
    // Keep the compatible Next, Hooks, import and jsx-a11y rules from the same
    // official preset until the React plugin publishes ESLint 10 support.
    if (scopedConfig.plugins !== undefined) {
      scopedConfig.plugins = { ...scopedConfig.plugins };
      delete scopedConfig.plugins.react;
    }
    if (scopedConfig.rules !== undefined) {
      scopedConfig.rules = Object.fromEntries(
        Object.entries(scopedConfig.rules).filter(([rule]) => !rule.startsWith('react/')),
      );
    }

    return scopedConfig;
  });

export default tseslint.config(
  {
    ignores: [
      '**/.next/**',
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/next-env.d.ts',
      'design-platform/**',
      'docs/**',
      'apps/api/src/generated/prisma/**',
      'packages/shared-types/src/generated/**',
    ],
  },
  {
    languageOptions: {
      globals: globals.node,
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextWebConfigs,
  {
    files: webFiles,
    languageOptions: {
      globals: globals.browser,
    },
    settings: {
      next: {
        rootDir: 'apps/web/',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
        },
      ],
      eqeqeq: ['error', 'always'],
    },
  },
);
