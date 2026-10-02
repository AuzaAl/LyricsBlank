import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LyricsBlank — YouTube Song Listening Practice',
  description:
    'Turn any YouTube music video into an interactive listening exercise with Monkeytype-inspired mechanics and animated glassmorphism.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Warm up the YouTube media hosts before the iframe asks for them. */}
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        {/*
          Low-end device hint. Sets data-perf="low" before paint so the CSS can
          swap the expensive 100px-blur rotating wash for a cheaper treatment.
          Layout/colours are unchanged — only GPU cost drops.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var cores=navigator.hardwareConcurrency||8;var ram=navigator.deviceMemory||8;document.documentElement.dataset.perf=(cores<=4||ram<=4)?'low':'high';}catch(e){document.documentElement.dataset.perf='high';}})();",
          }}
        />
      </head>
      <body className="antialiased selection:bg-[#f03]/35 selection:text-white">
        {children}
      </body>
    </html>
  );
}
