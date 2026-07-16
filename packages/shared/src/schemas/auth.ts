import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email();
export const passwordSchema = z.string().min(8).max(255);

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100),
  inviteId: z.string().uuid().optional(),
});

export const logInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LogInInput = z.infer<typeof logInSchema>;
