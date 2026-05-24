import { AuthForgotPasswordForm } from '@/src/app/auth';

const ForgotPasswordPage = () => (
  <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
    <div className="w-full max-w-sm">
      <AuthForgotPasswordForm />
    </div>
  </div>
);

export default ForgotPasswordPage;
