import * as z from 'zod/v4'

export const TravellerInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  relation: z.enum(['self', 'partner', 'child', 'grandparent', 'other']).nullable().optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  notes: z.string().trim().max(300).nullable().optional()
})

export const toTravellerData = (input: z.infer<typeof TravellerInputSchema>) => ({
  name: input.name,
  relation: input.relation ?? null,
  birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00Z`) : null,
  notes: input.notes || null
})
