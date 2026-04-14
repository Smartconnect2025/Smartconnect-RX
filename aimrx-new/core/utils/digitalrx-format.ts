export function formatPhoneForDigitalRx(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "").slice(-10);
}

export function formatDobForDigitalRx(dob: string | null | undefined): string {
  if (!dob) return "";
  const trimmed = dob.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return trimmed;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
