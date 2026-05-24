import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import './product.css';

export const metadata: Metadata = {
  title: 'Norm Network',
  description: 'Live proximity networking for real-world builders.',
  applicationName: 'Norm Network',
  openGraph: {
    title: 'Norm Network',
    description: 'A live map for real-world connection.',
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
