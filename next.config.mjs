import createNextIntlPlugin from 'next-intl/plugin';
import createMDX from '@next/mdx'

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
    proxyTimeout: 120000,
  },
  compiler: {
    styledComponents: true,
  },
  webpack: (cfg, options) => {
    cfg.module.rules.push({
    });
    return cfg;
  },
  /* proxy requests to flask server */
  rewrites: async () => {
    return [
      {
        source: "/api/:path*",
        destination:
          process.env.IS_DOCKER === "true"
            ? "http://icv-backend:5222/api/:path*"
            : "http://localhost:5222/api/:path*",
      },
      {
        source: "/api-docs",
        destination:
          process.env.IS_DOCKER === "true"
            ? "http://icv-backend:5222/apidocs"
            : "http://localhost:5222/apidocs",
      },
      {
        source: "/api-docs/:path*",
        destination:
          process.env.IS_DOCKER === "true"
            ? "http://icv-backend:5222/apidocs/:path*"
            : "http://localhost:5222/apidocs/:path*",
      },
    ];
  },
  turbopack: {
    rules: {
      // Add your custom turbopack rules here
    },
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: ['remark-gfm'],
    //rehypePlugins: ['rehype-katex'],
  },
});


export default withNextIntl(withMDX(nextConfig));