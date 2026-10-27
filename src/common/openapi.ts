import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { toJSONSchema, type ZodType } from 'zod/v4'

/**
 * OpenAPI schema for a request body validated by a zod schema, so the docs follow the validator.
 * zod emits JSON Schema 2020-12; the few keywords OpenAPI 3.0 does not know are dropped.
 */
export function zodBodySchema(schema: ZodType): SchemaObject {
  try {
    const json = toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, any>
    return clean(json) as SchemaObject
  } catch {
    return { type: 'object' }
  }
}

function clean(node: any): any {
  if (Array.isArray(node)) return node.map(clean)
  if (!node || typeof node !== 'object') return node
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === '$schema' || key === '$id' || key === 'additionalProperties' && value === false) continue
    if (key === 'const') {
      out.enum = [value]
      continue
    }
    out[key] = clean(value)
  }
  // anyOf [X, {type: null}] (zod .nullable()) becomes X with nullable: true
  if (Array.isArray(out.anyOf)) {
    const rest = out.anyOf.filter((s: any) => s?.type !== 'null')
    if (rest.length !== out.anyOf.length && rest.length === 1) {
      const { anyOf, ...others } = out
      return { ...others, ...rest[0], nullable: true }
    }
  }
  // OpenAPI 3.0 has no type arrays; ["string","null"] becomes nullable string
  if (Array.isArray(out.type)) {
    const types = out.type.filter((t: string) => t !== 'null')
    if (types.length !== out.type.length) out.nullable = true
    out.type = types.length === 1 ? types[0] : undefined
    if (!out.type) delete out.type
  }
  return out
}
