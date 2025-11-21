const createNextPluginPreval = require("next-plugin-preval/config");
const withNextPluginPreval = createNextPluginPreval();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'standalone', // Required for Docker deployment
  // Note: basePath not needed - DigitalOcean ingress handles /playground routing
};

module.exports = withNextPluginPreval(nextConfig);
