import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AURUM - XAUUSD Trading Analysis',
  description: 'Real-time Gold/USD trading analysis with technical indicators and signals',
  icons: {
    icon: '⚜️',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950">
        {children}
      </body>
    </html>
  );
}
