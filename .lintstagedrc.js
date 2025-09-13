module.exports = {
  // JavaScript files - format with Prettier, then lint with ESLint
  '*.js': ['prettier --write', 'eslint --fix'],

  // Configuration files - format with Prettier
  '*.{json,md,yml,yaml}': ['prettier --write'],

  // Package.json - format but preserve exact dependency versions
  'package.json': ['prettier --write'],

  // Markdown files - format with Prettier (respects overrides in .prettierrc.js)
  '*.{md,markdown}': ['prettier --write']
};
