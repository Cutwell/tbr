import type { ToolDescriptor, ToolResponse } from "@/lib/webmcp/adapter";

/**
 * Output formatting and budget enforcement.
 *
 * Chrome's guidance caps a single tool's output at ~1,500 characters, with tool
 * names at 30, tool descriptions at 500 and parameter descriptions at 150.
 * These read as advisory and behave as hard limits.
 *
 * That cap inverts ordinary API design. A REST endpoint is rewarded for
 * returning everything a client might want; a WebMCP tool is punished for it,
 * because every character it spends competes with the agent's own reasoning
 * space. For scale: a raw Open Library response for *two* books is 2,838 bytes.
 *
 * Two consequences, both implemented here.
 */

export const OUTPUT_BUDGET = 1_500;
export const NAME_BUDGET = 30;
export const DESCRIPTION_BUDGET = 500;
export const PARAM_DESCRIPTION_BUDGET = 150;

/**
 * Consequence one: delimited rows, not JSON.
 *
 * JSON repeats every key on every row, which at list sizes is the difference
 * between five books and ten:
 *
 *   JSON  {"id":"a3f1","title":"The Dispossessed",…}   ~95 chars
 *   Pipe  a3f1 | The Dispossessed | Le Guin | tbr | 4   ~48 chars
 */
export function table(columns: string[], rows: Array<Array<string | number | undefined>>): string {
  const header = columns.join(" | ");
  const body = rows
    .map((row) => row.map((cell) => (cell === undefined || cell === "" ? "-" : cell)).join(" | "))
    .join("\n");
  return `${header}\n${body}`;
}

/**
 * Consequence two: never truncate silently, and never mid-row.
 *
 * A half-written final row is worse than a missing one — the agent parses it as
 * real data and becomes confidently wrong. Cut at the last complete line and
 * say what happened.
 */
export function withinBudget(text: string, limit = OUTPUT_BUDGET): string {
  if (text.length <= limit) return text;

  const notice = "\n[output truncated — narrow your query]";
  const room = limit - notice.length;
  const clipped = text.slice(0, room);
  const lastBreak = clipped.lastIndexOf("\n");

  return (lastBreak > 0 ? clipped.slice(0, lastBreak) : clipped.trimEnd()) + notice;
}

/**
 * A successful response.
 *
 * Unlike `err`, this takes no `next` argument. Error recovery has one uniform
 * shape — name the tool to call instead — whereas a successful call's follow-up
 * is specific enough to belong in the sentence itself. Call sites that continue
 * a workflow write the next step inline; see `renderTasteProfile`.
 */
export function ok(text: string, structuredContent?: unknown): ToolResponse {
  return {
    content: [{ type: "text", text: withinBudget(text) }],
    ...(structuredContent === undefined ? {} : { structuredContent }),
  };
}

/**
 * An error that guides rather than dead-ends.
 *
 * Chrome's tool-building guidance is explicit: responses to an invalid call
 * "should act as a guide rather than a dead end", and must never be generic
 * errors, raw API errors, or silent failures. Every call site passes a `next`
 * naming the tool to call instead.
 */
export function err(text: string, next?: string): ToolResponse {
  const message = next ? `${text} ${next}` : text;
  return { content: [{ type: "text", text: withinBudget(message) }], isError: true };
}

interface BudgetViolation {
  tool: string;
  field: string;
  length: number;
  limit: number;
}

/**
 * Audits a toolset against the character budgets.
 *
 * Run at start-up in development. An over-long description does not throw
 * anywhere — it just quietly degrades how well an agent picks tools, which is
 * exactly the kind of bug that survives to a deadline.
 */
export function auditToolDescriptors(tools: ToolDescriptor[]): BudgetViolation[] {
  const violations: BudgetViolation[] = [];

  for (const tool of tools) {
    if (tool.name.length > NAME_BUDGET) {
      violations.push({
        tool: tool.name,
        field: "name",
        length: tool.name.length,
        limit: NAME_BUDGET,
      });
    }

    if (tool.description.length > DESCRIPTION_BUDGET) {
      violations.push({
        tool: tool.name,
        field: "description",
        length: tool.description.length,
        limit: DESCRIPTION_BUDGET,
      });
    }

    for (const [property, schema] of Object.entries(tool.inputSchema.properties)) {
      const description = (schema as { description?: string }).description ?? "";
      if (description.length > PARAM_DESCRIPTION_BUDGET) {
        violations.push({
          tool: tool.name,
          field: `${property}.description`,
          length: description.length,
          limit: PARAM_DESCRIPTION_BUDGET,
        });
      }
    }
  }

  return violations;
}
