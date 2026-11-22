import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const config = tseslint.config(
  { ignores: ['node_modules/**', 'src/abi.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { process: 'readonly', fetch: 'readonly', crypto: 'readonly', AbortSignal: 'readonly', Response: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
);

export default config;
