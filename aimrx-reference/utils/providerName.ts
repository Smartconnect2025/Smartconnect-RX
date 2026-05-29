type NamedProvider = {
  prefix?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export const DEFAULT_PROVIDER_PREFIX = "Dr.";

export function formatProviderName(
  p: NamedProvider | null | undefined,
  fallback = "Provider",
): string {
  if (!p) return fallback;
  const prefix = (p.prefix && p.prefix.trim()) || DEFAULT_PROVIDER_PREFIX;
  const first = (p.first_name ?? "").trim();
  const last = (p.last_name ?? "").trim();
  const name = `${first} ${last}`.replace(/\s+/g, " ").trim();
  return name ? `${prefix} ${name}` : fallback;
}

export function formatProviderNameFromParts(
  prefix: string | null | undefined,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback = "Provider",
): string {
  return formatProviderName(
    { prefix, first_name: firstName, last_name: lastName },
    fallback,
  );
}
