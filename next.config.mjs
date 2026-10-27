import createNextIntlPlugin from 'next-intl/plugin';
import { createMDX } from 'fumadocs-mdx/next';

const withNextIntl = createNextIntlPlugin();



/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: "standalone",
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  experimental: {
    // Increase the default 10MB middleware/proxy limit
    proxyClientMaxBodySize: '2500mb',
    // Idle-socket timeout for proxied /api requests (http-proxy proxyTimeout).
    proxyTimeout: 600000,
  },
  compiler: {
    styledComponents: true,
  },
  webpack: (cfg, options) => {
    cfg.module.rules.push({
      test: /\.glsl$/,
      type: 'asset/source',
    });
    return cfg;
  },
  /* proxy requests to flask server */
  rewrites: async () => {
    const backendUrl =
      process.env.IS_DOCKER === "true"
        ? "http://icv-backend:5222"
        : "http://localhost:5222";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/api-docs",
        destination: `${backendUrl}/apidocs/`,
      },
      {
        source: "/api-docs/:path*",
        destination: `${backendUrl}/apidocs/:path*`,
      },
      {
        source: "/apidocs",
        destination: `${backendUrl}/apidocs/`,
      },
      {
        source: "/apidocs/:path*",
        destination: `${backendUrl}/apidocs/:path*`,
      },
      {
        source: "/flasgger_static/:path*",
        destination: `${backendUrl}/flasgger_static/:path*`,
      },
      {
        source: "/apispec_1.json",
        destination: `${backendUrl}/apispec_1.json`,
      },
    ];
  },
  turbopack: {
    rules: {
      '*.glsl': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
    },
  },
};

const withMDX = createMDX();


export default withNextIntl(withMDX(nextConfig));
