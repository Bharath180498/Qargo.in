import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'QARGO | Simply Deliver',
  description:
    'QARGO helps businesses and households move goods faster with verified drivers, real-time tracking, and reliable pricing.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-root">{children}</body>
    </html>
  );
}
