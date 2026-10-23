import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
});
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

const dateStr = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date");
export const tripSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    startDate: dateStr,
    endDate: dateStr,
    budget: z.number().int().min(0).default(0),
  })
  .refine((t) => Date.parse(t.endDate) >= Date.parse(t.startDate), { message: "endDate must be >= startDate", path: ["endDate"] });

export const tripUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  budget: z.number().int().min(0).optional(),
});

export const itemSchema = z.object({
  destinationId: z.string().min(1),
  day: z.number().int().min(1),
  note: z.string().max(500).nullish(),
});

export const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string(), day: z.number().int().min(1), position: z.number().int().min(0) })).max(500),
});

export const EXPENSE_CATEGORIES = ["transport", "food", "lodging", "tickets", "other"] as const;
export const expenseSchema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.enum(EXPENSE_CATEGORIES),
  planned: z.number().int().min(0).default(0),
  actual: z.number().int().min(0).default(0),
  paidById: z.string().min(1).nullish(), // trip participant who paid
  splitAmong: z.array(z.string().min(1)).max(50).optional(), // participants sharing it; empty = everyone
  shareAmounts: z.record(z.string().min(1), z.number().int().min(0)).optional(), // exact VND per person (must add up to `actual`); {} = back to equal split
});
export const expenseUpdateSchema = expenseSchema.partial();

export const tripRoleSchema = z.enum(["EDITOR", "VIEWER"]);
export const inviteSchema = z.object({ enabled: z.boolean(), role: tripRoleSchema.default("EDITOR") });
export const memberUpdateSchema = z.object({ role: tripRoleSchema });
export const voteSchema = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) }); // 0 removes my vote
export const commentSchema = z.object({ body: z.string().trim().min(1).max(500) });
