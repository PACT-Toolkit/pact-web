import { Analytics } from '@vercel/analytics/next';
import { type Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { Providers } from './Providers';

import './globals.css';

// Self-hosted via next/font so the page stays renderable when Google Fonts
// is unreachable. Variables here line up with --font-sans / --font-mono in
// app/globals.css's @theme block.
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
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
    <body className="font-sans antialiased" suppressHydrationWarning>
      <Providers>{children}</Providers>
      <Analytics />
    </body>
  </html>
);

export default RootLayout;
