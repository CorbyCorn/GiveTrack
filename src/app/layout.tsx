import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CreditLedger — API Credit Tracker',
  description: 'Track and forecast $40M in OpenAI API credits',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
