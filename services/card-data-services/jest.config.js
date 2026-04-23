export default {
    testEnvironment: 'node',
    transform: {},
    extensionsToTreatAsEsm: ['.js'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    setupFilesAfterEnv: ['./tests/setup.js'],
    collectCoverageFrom: [
        'api/**/*.js',
        'server/**/*.js',
        '!**/node_modules/**',
        '!**/tests/**'
    ],
    testTimeout: 10000,
    verbose: true
};