/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: "../tsconfig.json",
    }],
  },
  collectCoverageFrom: [
    "../src/**/*.ts",
    "!../src/**/*.d.ts",
  ],
  coverageDirectory: "./coverage",
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: [],
  testTimeout: 10000,
  verbose: true,
};










