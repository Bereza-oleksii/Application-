// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The offline databases are shipped as plain assets.
config.resolver.assetExts.push('db');

module.exports = config;
