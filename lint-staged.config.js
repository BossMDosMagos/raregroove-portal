import { defineConfig } from 'lint-staged';

export default defineConfig({
  '*.{js,jsx,ts,tsx}': (files) => {
    return [
      `eslint --fix ${files.join(' ')}`,
      'vitest related --run',
    ].filter(Boolean);
  },
  '*.{css,scss}': ['stylelint --fix', 'prettier --write'],
  '*.{json,md}': ['prettier --write'],
  '*.sql': ['sql-formatter --write'],
  '*.{png,jpg,jpeg,gif,webp,svg}': ['imagemin-lossy'],
});
