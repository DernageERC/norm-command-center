import './globals.css'

export const metadata = {
  title: 'Norm Network',
  description: 'Real-world proximity networking',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
