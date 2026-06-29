/**
 * narrative.ts — single source of truth for parsing the analyst brief.
 *
 * Both BriefView (UI) and ExportBar (PDF) must import from here.
 * This guarantees the reference list, numbering, and evidence snippets
 * are identical in the UI and the exported PDF.
 */
import type { ExtractedField } from "@/types/api";

export interface ParsedReference {
  num: number;
  url: string;
  /** Best-matched evidence snippet from the fields DB for this URL */
  snippet: string | null;
  /** ISO date string of access, or null */
  accessDate: string | null;
}

export interface ParsedNarrative {
  /** Ordered map of url → citation number, in appearance order */
  urlMap: Map<string, number>;
  /** Sorted array of reference objects ready to render */
  references: ParsedReference[];
}

const CITATION_REGEX = /\(source:\s*(https?:\/\/[^\s)]+)\)/g;

/**
 * Parse the raw narrative text and build the reference list.
 *
 * @param narrativeText - Raw narrative string containing (source: URL) annotations
 * @param fields        - Extracted fields from the DB (used to look up snippets)
 */
export function parseNarrative(
  narrativeText: string,
  fields: ExtractedField[]
): ParsedNarrative {
  const urlMap = new Map<string, number>();
  let counter = 1;

  // First pass — collect unique URLs in order of appearance
  const regex = new RegExp(CITATION_REGEX.source, "g");
  let m: RegExpExecArray | null;
  while ((m = regex.exec(narrativeText)) !== null) {
    if (!urlMap.has(m[1])) urlMap.set(m[1], counter++);
  }

  // Build reference list with matched snippets
  const references: ParsedReference[] = Array.from(urlMap.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([url, num]) => {
      // Collect ALL fields that cite this URL and have a non-empty snippet
      const matched = fields.filter(
        (f) => f.source_url === url && f.claimed_snippet != null && f.claimed_snippet.length > 0
      );

      // Pick the snippet that best represents the citation context:
      // 1) Find the text immediately around any (source: url) citation in the narrative
      // 2) Look for a field whose snippet is a substring of that surrounding context
      // 3) Fall back to the first matched field's snippet
      let bestSnippet: string | null = null;

      if (matched.length > 0) {
        // Find surrounding narrative context for this URL
        const surroundingRegex = new RegExp(
          `(.{0,300})\\(source:\\s*${escapeRegex(url)}\\)`,
          "g"
        );
        const contexts: string[] = [];
        let ctx: RegExpExecArray | null;
        while ((ctx = surroundingRegex.exec(narrativeText)) !== null) {
          contexts.push(ctx[1].toLowerCase());
        }

        // Try to find a snippet that appears in one of the surrounding contexts
        let found = false;
        for (const ctx of contexts) {
          for (const f of matched) {
            if (f.claimed_snippet && ctx.includes(f.claimed_snippet.toLowerCase().slice(0, 40))) {
              bestSnippet = f.claimed_snippet;
              found = true;
              break;
            }
          }
          if (found) break;
        }

        // Fallback: just use the first matched snippet
        if (!bestSnippet) {
          bestSnippet = matched[0].claimed_snippet ?? null;
        }
      }

      // Access date from the first field with this URL that has a date
      const dateField = fields.find(
        (f) => f.source_url === url && f.access_date != null
      );

      // Format: "29 June 2026, 05:14"
      let formattedDate: string | null = null;
      if (dateField?.access_date) {
        const d = new Date(dateField.access_date);
        formattedDate =
          d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) +
          ", " +
          d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
      }

      return {
        num,
        url,
        snippet: bestSnippet,
        accessDate: formattedDate,
      };
    });

  return { urlMap, references };
}

/**
 * Split narrative text into segments, replacing (source: URL) with
 * the citation number so callers can render inline [N] badges.
 */
export interface NarrativeSegment {
  type: "text" | "citation";
  text: string;
  /** Only set when type === "citation" */
  url?: string;
  /** Only set when type === "citation" */
  num?: number;
}

export function splitNarrativeSegments(
  narrativeText: string,
  urlMap: Map<string, number>
): NarrativeSegment[] {
  const segments: NarrativeSegment[] = [];
  const re = new RegExp(CITATION_REGEX.source, "g");
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(narrativeText)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: "text", text: narrativeText.slice(lastIndex, m.index) });
    }
    const url = m[1];
    segments.push({ type: "citation", text: `[${urlMap.get(url) ?? "?"}]`, url, num: urlMap.get(url) });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < narrativeText.length) {
    segments.push({ type: "text", text: narrativeText.slice(lastIndex) });
  }
  return segments;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
