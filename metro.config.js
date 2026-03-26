const path = require('path');

// Workaround: disable Metro watch mode on Windows to avoid watcher startup failures.
process.env.CI = '1';
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  projectRoot: __dirname,
  watchFolders: [__dirname],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
  },
  watcher: {
    watchman: false,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
