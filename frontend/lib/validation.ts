import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(120),
    email: z.email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128)
      .regex(/[A-Za-z]/, "Password must contain a letter")
      .regex(/[0-9]/, "Password must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128)
      .regex(/[A-Za-z]/, "Password must contain a letter")
      .regex(/[0-9]/, "Password must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const questionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(2, "Ask a question first")
    .max(4000, "Questions are limited to 4,000 characters"),
});

export const renameConversationSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").max(200),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type QuestionValues = z.infer<typeof questionSchema>;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = [".pdf", ".txt"];

export function validateFiles(files: File[]): { accepted: File[]; errors: string[] } {
  const accepted: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_UPLOAD_TYPES.includes(extension)) {
      errors.push(`${file.name}: only PDF and TXT files are supported`);
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      errors.push(`${file.name}: file exceeds the 10 MB limit`);
      continue;
    }
    if (file.size === 0) {
      errors.push(`${file.name}: file is empty`);
      continue;
    }
    accepted.push(file);
  }

  return { accepted, errors };
}