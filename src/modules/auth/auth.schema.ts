import { z } from 'zod';

export const registerSchema = z.object({
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dateOfBirth: z.string().date().optional(),
  nationality: z.string().length(2).toUpperCase().optional(),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
  deviceName: z.string().optional(),
});

export const verifyEmailSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  code: z.string().length(6),
});

export const resendVerificationSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  code: z.string().length(6),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const twoFaEnableSchema = z.object({
  token: z.string().length(6),
});

export const twoFaDisableSchema = z.object({
  password: z.string().min(1),
  token: z.string().length(6),
});

export const twoFaVerifySchema = z.object({
  tempToken: z.string().min(1),
  token: z.string().length(6),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
