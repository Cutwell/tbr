import type { ToolArgs } from "@/lib/webmcp/adapter";

/**
 * Argument readers.
 *
 * Tool arguments arrive as loosely-typed JSON produced by a language model, and
 * they do not reliably respect the schema: numbers arrive as strings, enums
 * arrive capitalised, optional fields arrive as empty strings meaning "unset".
 * These readers coerce charitably and return `undefined` rather than throwing,
 * so a tool can produce a guiding error instead of a stack trace.
 */

export function readString(args: ToolArgs, key: string): string | undefined {
  const value = args[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readInt(args: ToolArgs, key: string): number | undefined {
  const value = args[key];
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

/** Reads an integer and clamps it into range, rather than rejecting it. */
export function readClampedInt(
  args: ToolArgs,
  key: string,
  min: number,
  max: number,
  fallback: number,
): number {
  const value = readInt(args, key);
  if (value === undefined) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function readEnum<T extends string>(
  args: ToolArgs,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = readString(args, key)?.toLowerCase();
  return allowed.find((option) => option === value);
}
