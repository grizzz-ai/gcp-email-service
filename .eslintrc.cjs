module.exports = {
  env: {
    node: true,
    es2023: true
  },
  extends: ["eslint:recommended", "prettier"],
  parserOptions: {
    ecmaVersion: 2023
  },
  rules: {
    "no-console": "off"
  }
};
