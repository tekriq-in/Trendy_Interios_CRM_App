const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Let Metro see files outside the project root (monorepo packages)
config.watchFolders = [workspaceRoot];

// Resolve modules from the workspace root first, then the project root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Map @ti/shared to the actual source so Metro can bundle it
config.resolver.extraNodeModules = {
  '@ti/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
};

module.exports = config;
