import { z } from "zod";

export const handshakeSchema = z.object({
  fingerprintVisitorId: z.string().min(8).max(512),
  deviceUuid: z.string().uuid(),
  username: z.string().trim().min(1).max(80).optional(),
});

export const createEventSchema = z.object({
  name: z.string().trim().min(1).max(160),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const parsed = new Date(`${value}T00:00:00Z`);

      return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
      );
    }),
  choices: z.array(z.string().trim().min(1).max(80)).min(1).max(10),
  description: z.string().trim().max(1000).optional(),
});

export const eventVoterSchema = z.object({
  eventId: z.string().uuid(),
  votedChoice: z.number().int().min(0).max(9),
});

export const removeEventVoterSchema = z.object({
  eventId: z.string().uuid(),
  votedChoice: z.number().int().min(0).max(9).optional(),
});

export const invoiceDetailSchema = z.object({
  username: z.string().trim().min(1).max(80),
  hours: z.number().min(0).max(24),
  amount: z.number().min(0),
});

export const invoiceBillingSchema = z.object({
  category: z.string().trim().min(1).max(120),
  totalAmount: z.number().min(0),
  details: z.array(invoiceDetailSchema).min(1),
});

export const invoicePayloadSchema = z.object({
  billings: z.array(invoiceBillingSchema).min(1),
});
