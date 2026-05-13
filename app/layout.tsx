import { Analytics } from '@vercel/analytics/next';
import { type Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

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
    className={`${inter.variable} ${jetbrainsMono.variable}`}
    suppressHydrationWarning
  >
    <body className="font-sans antialiased" suppressHydrationWarning>
      <Providers>{children}</Providers>
      <Analytics />
    </body>
  </html>
);

export default RootLayout;
