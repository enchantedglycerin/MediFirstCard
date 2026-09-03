// Metro config for the monorepo.
// - watches the workspace root so @mfc/shared TypeScript source is transformed;
// - resolves NodeNext-style ".js" import specifiers to their ".ts"/".tsx" sources
//   (the shared package uses ".js" specifiers so it also works under the API's
//   NodeNext TypeScript build).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (/^\.{1,2}\//.test(moduleName) && moduleName.endsWith(".js")) {
    try {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    } catch {
      // fall through to the default resolver below
    }
  }
  const resolver = defaultResolveRequest ?? context.resolveRequest;
  return resolver(context, moduleName, platform);
};

module.exports = config;
