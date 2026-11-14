// The one line every /v1/check console shows for an over-ceiling input, so
// the 413 reads the same everywhere. `message` comes from
// describeInputTooLarge.
export const InputTooLargeNotice = ({
  message,
  testId,
}: {
  message: string;
  testId: string;
}) => (
  <span role="alert" className="text-xs text-destructive" data-testid={testId}>
    {message}
  </span>
);
