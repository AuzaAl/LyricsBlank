import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LyricsBlank — YouTube Song Listening Practice',
  description:
    'Turn any YouTube music video into an interactive listening exercise with Monkeytype-inspired mechanics and animated glassmorphism.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-[#f03]/35 selection:text-white">
        {children}
      </body>
    </html>
  );
}
