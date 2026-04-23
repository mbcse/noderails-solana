import type { Metadata } from 'next';
import { PostHogAnalyticsProvider } from '@/components/posthog-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'NodeRails Payment',
  description: 'Secure crypto payment checkout',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PostHogAnalyticsProvider>
          {children}
        </PostHogAnalyticsProvider>
      </body>
    </html>
  );
}
