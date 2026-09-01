/**
 * Conditional class name joiner.
 *
 * Deliberately not `clsx` — this is eight lines and one fewer dependency, and
 * the project has no need for the object/array syntax.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
