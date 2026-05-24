import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import 'leaflet/dist/leaflet.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Norm Network',
  description: 'Live proximity networking for real-world builders. Turn your signal on when you want to connect.',
  applicationName: 'Norm Network',
  openGraph: {
    title: 'Norm Network',
    description: 'A live map for real-world connection. Only when you choose.',
    type: 'website'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#050607'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <body>{children}</body>
    </html>
  );
}
