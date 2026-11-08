interface BenchmarkSubmitErrorBannerProps {
  message: string;
}

// `whitespace-pre-line` keeps the lines of a multi-line server report.
export const BenchmarkSubmitErrorBanner = ({
  message,
}: BenchmarkSubmitErrorBannerProps) => (
  <p
    role="alert"
    data-testid="benchmark-submit-error"
    className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm break-words whitespace-pre-line text-destructive"
  >
    {message}
  </p>
);
