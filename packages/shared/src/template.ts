/**
 * Template variable renderer for campaign emails.
 *
 * Variables are written as {VariableName} in the subject and body, and
 * resolved at send time from the enrolled lead. Unknown variables fall back
 * to a configurable default (empty string by default) so a missing field
 * never ships "{ContactName}" as the literal text — it just renders blank.
 *
 * Phase 2 ships the canonical four:
 *   {CompanyName}     -> lead.companyName
 *   {ContactName}     -> lead.contactName
 *   {Industry}        -> lead.industry
 *   {Personalization} -> lead.personalization
 *
 * Extending: add a new key to the LeadTemplateContext + RESOLVERS map.
 */

export interface LeadTemplateContext {
  companyName?: string | null;
  contactName?: string | null;
  industry?: string | null;
  personalization?: string | null;
  // Reserved for later expansion (city, role, firstName, etc.) — declared
  // here so the type system flags template references that won't resolve.
  city?: string | null;
  country?: string | null;
  role?: string | null;
}

/** Order matters only as documentation — keys are case-insensitive at parse time. */
export const TEMPLATE_VARIABLES = [
  "CompanyName",
  "ContactName",
  "Industry",
  "Personalization",
  "City",
  "Country",
  "Role",
] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

const RESOLVERS: Record<TemplateVariable, (ctx: LeadTemplateContext) => string | null | undefined> = {
  CompanyName:     (c) => c.companyName,
  ContactName:     (c) => c.contactName,
  Industry:        (c) => c.industry,
  Personalization: (c) => c.personalization,
  City:            (c) => c.city,
  Country:         (c) => c.country,
  Role:            (c) => c.role,
};

// Matches {Name} where Name is alphanumeric. Greedy match inside braces is
// fine because Name itself can't contain braces.
const VARIABLE_PATTERN = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

export interface RenderOptions {
  /** Replacement when a variable resolves to null/undefined/empty. Default "". */
  fallback?: string;
  /** Replacement when a variable name isn't recognized. Default: keep "{Name}" raw. */
  onUnknown?: "blank" | "keep";
}

/**
 * Render a template string against a lead context.
 *
 *   render("Hi {ContactName}, saw {CompanyName} is hiring", lead)
 *   -> "Hi Jane, saw Acme Co is hiring"
 *
 * Missing-but-known variables render as the fallback ("" by default), so
 * `{ContactName}` resolves cleanly even for leads without a contact name.
 * Unknown variable names ("{Foo}") are kept literal by default so typos
 * surface in operator preview rather than silently disappearing.
 */
export function renderTemplate(
  template: string,
  ctx: LeadTemplateContext,
  opts: RenderOptions = {},
): string {
  const fallback = opts.fallback ?? "";
  const onUnknown = opts.onUnknown ?? "keep";

  return template.replace(VARIABLE_PATTERN, (match, name: string) => {
    // Find resolver case-insensitively, but preserve a stable canonical form.
    const canonical = TEMPLATE_VARIABLES.find(
      (v) => v.toLowerCase() === name.toLowerCase(),
    );
    if (!canonical) {
      return onUnknown === "blank" ? "" : match;
    }
    const value = RESOLVERS[canonical](ctx);
    if (value == null || value === "") return fallback;
    return value;
  });
}

/**
 * Extract all variable names referenced by a template (unique, case-canonical
 * where recognised). Useful for the campaign builder to preview which fields
 * the operator depends on so they can spot leads with missing data.
 */
export function extractVariables(template: string): string[] {
  const seen = new Set<string>();
  for (const m of template.matchAll(VARIABLE_PATTERN)) {
    const raw = m[1]!;
    const canonical = TEMPLATE_VARIABLES.find(
      (v) => v.toLowerCase() === raw.toLowerCase(),
    );
    seen.add(canonical ?? raw);
  }
  return Array.from(seen);
}
