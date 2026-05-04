import { type Metadata } from 'next';

import { MSWProvider } from '@/src/framework/msw/msw_provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'PACT',
  description: 'Privacy and Compliance Toolkit',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MSWProvider />
        {children}
      </body>
    </html>
  );
}
