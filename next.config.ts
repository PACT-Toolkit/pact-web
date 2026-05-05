import { type NextConfig } from 'next';

import { isMock } from './src/framework/helpers/environment';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.ts',
      },
    },
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/,
      issuer: /\.tsx?$/,
      use: [{ loader: '@svgr/webpack', options: { typescript: true } }],
    });

    return config;
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        {
          key: 'Permissions-Policy',
          value: [
            'accelerometer=()',
            'ambient-light-sensor=()',
            'autoplay=()',
            'battery=()',
            'camera=()',
            'display-capture=()',
            'document-domain=()',
            'encrypted-media=()',
            'fullscreen=()',
            'geolocation=()',
            'gyroscope=()',
            'magnetometer=()',
            'microphone=()',
            'midi=()',
            'payment=()',
            'picture-in-picture=()',
            'publickey-credentials-get=()',
            'screen-wake-lock=()',
            'usb=()',
            'web-share=()',
            'xr-spatial-tracking=()',
          ].join(', '),
        },
        ...(!isMock()
          ? [
              {
                key: 'Strict-Transport-Security',
                value: 'max-age=31536000; includeSubDomains',
              },
            ]
          : []),
      ],
    },
    {
      source: '/mockServiceWorker.js',
      headers: [{ key: 'Cache-Control', value: 'no-store' }],
    },
  ],
};

export default nextConfig;
