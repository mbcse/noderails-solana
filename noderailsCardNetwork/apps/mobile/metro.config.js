// @ts-check
/** Metro PostCSS picks up postcss.config.* from apps/mobile (Tailwind utilities on web iframe routes). */

const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  isCSSEnabled: true,
});

module.exports = config;
