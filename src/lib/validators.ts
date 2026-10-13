import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
});
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export const destinationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/),
  description: z.string().trim().min(1).max(2000),
  city: z.string().trim().min(1),
  region: z.string().trim().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  imageUrl: z.string().url().nullish(),
  avgCost: z.number().int().min(0),
  categoryId: z.string().min(1),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/),
});

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
});
export const expenseUpdateSchema = expenseSchema.partial();

export const favoriteSchema = z.object({ destinationId: z.string().min(1) });
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(1000),
  // Photos: https URL only for now (file upload comes with object storage).
  imageUrl: z.string().url().max(500).refine((u) => u.startsWith("https://"), "Must be https").nullish(),
});
export const shareSchema = z.object({ enabled: z.boolean() });
export const tripRoleSchema = z.enum(["EDITOR", "VIEWER"]);
export const inviteSchema = z.object({ enabled: z.boolean(), role: tripRoleSchema.default("EDITOR") });
export const memberUpdateSchema = z.object({ role: tripRoleSchema });
