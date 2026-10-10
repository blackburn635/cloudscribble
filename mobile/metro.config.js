const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');
const sharedSrc = path.resolve(monorepoRoot, 'packages/shared/src/index.ts');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// mobile/ is outside the npm workspaces: resolve @cloudscribble/shared to its TypeScript
// source so EAS builds never depend on packages/shared/dist being built.
// (Don't set disableHierarchicalLookup — it breaks Metro in this monorepo.)
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@cloudscribble/shared') {
    return { type: 'sourceFile', filePath: sharedSrc };
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: './global.css',
});
