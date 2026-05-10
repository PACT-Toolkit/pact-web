import { networkInterfaces } from 'os';

import { type NextConfig } from 'next';

import { isMock } from './src/framework/helpers/environment';

// Dev-only: allow the dev server to accept requests on the host's LAN IP
// (e.g. http://192.168.x.x:3000) in addition to localhost, so a phone on
// the same WiFi can hit the verify-email link in `make dev-lan` flows.
// Next.js requires exact hosts here (no CIDR), so we enumerate every
// non-loopback IPv4 the host currently has and feed them in. Production
// never reads this — `allowedDevOrigins` is ignored when NODE_ENV !==
// 'development'.
const detectLanHosts = (): string[] => {
  const ifaces = networkInterfaces();
  const out = new Set<string>();
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.family !== 'IPv4') continue;
      if (iface.internal) continue;
      out.add(iface.address);
    }
  }

  return [...out];
};

const allowedDevOrigins =
  process.env.NODE_ENV === 'development' ? detectLanHosts() : undefined;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(allowedDevOrigins ? { allowedDevOrigins } : {}),
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
