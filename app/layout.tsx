import { type Metadata } from 'next';

import { Providers } from './Providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'PACT',
  description: 'Privacy and Compliance Toolkit',
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <body suppressHydrationWarning>
      <MSWProvider />
      <SWRProvider>{children}</SWRProvider>
    </body>
  </html>
);

export default RootLayout;
