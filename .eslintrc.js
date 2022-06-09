module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  ignorePatterns: ['docs'],
  plugins: ['jsdoc'],
  rules: {
  }
}
