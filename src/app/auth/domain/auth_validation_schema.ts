import * as yup from 'yup';

export const loginSchema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().required('Password is required'),
});

export type LoginFormData = yup.InferType<typeof loginSchema>;

// pact-auth enforces 8..128 chars server-side (NFC-normalized). Mirror it
// here so we fail fast — the server is still the source of truth.
const passwordRule = yup
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .required('Password is required');

export const registerSchema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  password: passwordRule,
});

export type RegisterFormData = yup.InferType<typeof registerSchema>;

export const forgotPasswordSchema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
});

export type ForgotPasswordFormData = yup.InferType<typeof forgotPasswordSchema>;

export const resetPasswordSchema = yup.object({
  password: passwordRule,
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
});

export type ResetPasswordFormData = yup.InferType<typeof resetPasswordSchema>;
