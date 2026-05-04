import { type Metadata } from 'next';

import { MSWProvider } from '@/src/framework/msw/msw_provider';
import { SWRProvider } from '@/src/framework/swr/swr_provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'PACT',
  description: 'Privacy and Compliance Toolkit',
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <body>
      <MSWProvider />
      <SWRProvider>{children}</SWRProvider>
    </body>
  </html>
);

export default RootLayout;
