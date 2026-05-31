import { Analytics } from '@vercel/analytics/next';
import { type Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';

import { SplashOverlay } from '@/src/framework/motion';

import { Providers } from './Providers';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

// Ndot55 — Nothing-style dot-matrix display face, used for hero numerals
// (splash screen percent counter, future "screen"-style display moments).
// Single-weight regular OTF; loaded locally so it gets the same Next font
// pipeline (preload, no FOUT, CSS variable) as the Google fonts above.
const ndot = localFont({
  src: '../public/assets/fonts/Ndot55Caps-Regular.otf',
  variable: '--font-ndot',
  display: 'swap',
});

// Space Grotesk — proportional geometric sans used as the splash screen's
// primary typeface for both the percent counter and the welcome copy. Same
// local-font pipeline as Ndot so it preloads with the page and never FOUTs.
const spaceGrotesk = localFont({
  src: '../public/assets/fonts/SpaceGrotesk-Regular.otf',
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PACT',
  description: 'Privacy and Compliance Toolkit',
  icons: {
    icon: [
      {
        url: '/assets/images/pact-favicon.png',
        type: 'image/png',
        sizes: '512x512',
      },
    ],
    apple: [
      {
        url: '/assets/images/pact-apple-icon.png',
        type: 'image/png',
        sizes: '180x180',
      },
    ],
  },
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html
    lang="en"
    className={`${inter.variable} ${jetbrainsMono.variable} ${ndot.variable} ${spaceGrotesk.variable}`}
    suppressHydrationWarning
  >
    <body className="font-sans antialiased" suppressHydrationWarning>
      <Providers>
        {/* Stable id so `<SplashOverlay />` can toggle `inert` on the
            page subtree while the splash is mounted — without it,
            keyboard and screen-reader users can Tab/traverse into the
            visually-hidden destination page underneath. */}
        <div id="page-content">{children}</div>
        {/* Splash sits at the layout level (above the routing layer) so
            the destination route mounts behind it from the start. The
            overlay self-gates on `?intro=1` — set by `app/page.tsx` on
            the logged-out-entry redirect — so it renders nothing on
            direct visits to /login, /dashboard, etc. Lives *inside*
            <Providers> so any context consumers in the splash subtree
            (e.g. `useTheme()` in the dev-only theme toggle) resolve
            against the same provider tree as the rest of the app. */}
        <SplashOverlay />
      </Providers>
      <Analytics />
    </body>
  </html>
);

export default RootLayout;
