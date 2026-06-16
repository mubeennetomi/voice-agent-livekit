/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A package-lock.json in a parent dir makes Next guess the wrong workspace
  // root — pin it to this project.
  outputFileTracingRoot: __dirname,
};

module.exports = nextConfig;
