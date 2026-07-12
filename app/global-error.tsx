'use client';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

// This file replaces the root layout entirely when the root layout itself
// throws (Next.js global-error semantics), so it must render its own
// <html>/<body> and stay self-contained: no Tailwind classes (globals.css
// is not guaranteed to be loaded), no imports from app internals that
// might themselves be the thing that broke. Inline styles only.
const GlobalErrorPage = ({ error, reset }: Props) => (
  <html lang="en">
    <body
      style={{
        margin: 0,
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
          Something went wrong
        </h2>
        {error.digest && (
          <p
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.875rem',
              color: '#71717a',
              margin: 0,
            }}
          >
            {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          type="button"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: '1px solid #d4d4d8',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Try again
        </button>
      </div>
    </body>
  </html>
);

export default GlobalErrorPage;
