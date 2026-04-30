export default {
  testEnvironment: "node",
  transform: {},

  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  collectCoverageFrom: [
    "api/**/*.js",
    "server/**/*.js",
    "!**/node_modules/**",
    "!**/tests/**",
  ],
  testTimeout: 10000,
  verbose: true,
};
