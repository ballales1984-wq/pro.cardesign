/** Jest config for geometry tests */
module.exports = {
  testMatch: ['**/tests/geometry/**/*.test.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleFileExtensions: ['js', 'mjs', 'json'],
  testEnvironment: 'node',
};
