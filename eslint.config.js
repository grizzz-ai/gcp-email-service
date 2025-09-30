module.exports = [
  {
    files: ["**/*.js"],
    ignores: ["node_modules/**", "coverage/**", "dist/**"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: {
        console: true,
        process: true
      }
    },
    linterOptions: {
      reportUnusedDisableDirectives: true
    },
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        jest: true,
        expect: true
      }
    }
  }
];
