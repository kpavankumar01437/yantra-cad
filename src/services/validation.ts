import { z } from 'zod';
import { evaluate, parameterValues } from '../model/expressions';
import type { Design } from '../types';

export const PLANES = ['XY', 'XZ', 'YZ'] as const;

const expression = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(48, 'Expression is too long');

export const commandSchemas = {
  newSketch: z.object({ plane: z.enum(PLANES) }),
  extrude: z.object({
    sketchId: z.string().min(1, 'Select a sketch profile'),
    distance: expression,
    operation: z.enum(['new', 'cut']),
    bodyId: z.string().optional().default(''),
  }),
  fillet: z.object({
    bodyId: z.string().min(1, 'Select a body'),
    radius: expression,
  }),
  shell: z.object({
    bodyId: z.string().min(1, 'Select a body'),
    thickness: expression,
  }),
  move: z.object({
    bodyId: z.string().min(1, 'Select a body'),
    x: expression,
    y: expression,
    z: expression,
  }),
} as const;

export type CommandIdFromSchema = keyof typeof commandSchemas;

/** Structural validation (zod): required fields, enums, lengths. */
export function validateStructure(
  id: CommandIdFromSchema,
  inputs: Record<string, string>,
): Record<string, string> {
  const schema = commandSchemas[id];
  const parsed = schema.safeParse(inputs);
  if (parsed.success) return {};

  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? '_form');
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** Semantic validation: expressions must resolve to a usable millimetre value. */
export function validateValues(
  id: CommandIdFromSchema,
  inputs: Record<string, string>,
  design: Design,
): Record<string, string> {
  const { values } = parameterValues(design.parameters);
  const errors: Record<string, string> = {};

  const check = (key: string, minimum: number) => {
    const raw = inputs[key];
    if (raw === undefined) return;
    try {
      const value = evaluate(raw, (name) => {
        if (!(name in values)) throw new Error(`Unknown parameter "${name}"`);
        return values[name];
      });
      if (!Number.isFinite(value)) throw new Error('Not a number');
      if (value <= minimum) throw new Error(`Must be greater than ${minimum} mm`);
      if (value > 2000) throw new Error('Value is unreasonably large');
    } catch (err) {
      errors[key] = (err as Error).message;
    }
  };

  if (id === 'extrude') check('distance', 0);
  if (id === 'fillet') check('radius', 0.01);
  if (id === 'shell') check('thickness', 0.01);
  if (id === 'move') {
    check('x', -2000);
    check('y', -2000);
    check('z', -2000);
  }
  if (id === 'extrude' && inputs.operation === 'cut') {
    if (!inputs.bodyId) errors.bodyId = 'Select the body to cut';
    else if (!design.bodies.some((body) => body.id === inputs.bodyId)) errors.bodyId = 'Body no longer exists';
  }

  return errors;
}
