import { AuthResetPasswordForm } from '@/src/app/auth';

type SearchParams = { token?: string | string[] };

const ResetPasswordPage = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) => {
  const { token } = await searchParams;
  const t = Array.isArray(token) ? token[0] : token;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <AuthResetPasswordForm token={t ?? ''} />
      </div>
    </div>
  );
};

export default ResetPasswordPage;
