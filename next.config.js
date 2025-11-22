const createNextPluginPreval = require("next-plugin-preval/config");
const withNextPluginPreval = createNextPluginPreval();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  basePath: process.env.NODE_ENV === 'production' ? '/playground' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/playground' : '',
};

module.exports = withNextPluginPreval(nextConfig);
