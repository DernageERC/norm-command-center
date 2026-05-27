import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Norm Network',
    short_name: 'Norm',
    description: 'Live social map',
    start_url: '/',
    display: 'standalone',
    background_color: '#040507',
    theme_color: '#040507',
    icons: [
      { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' }
    ]
  };
}
