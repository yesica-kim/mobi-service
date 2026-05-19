const packageJson = require('./package.json');

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    APP_VERSION: packageJson.version,
  },
};
module.exports = nextConfig;
