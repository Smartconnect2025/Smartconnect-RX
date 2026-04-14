export function formatPhoneForDigitalRx(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  if (digits.length === 10) {
    return digits;
  }
  return "";
}

export function formatDobForDigitalRx(dob: string | null | undefined): string {
  if (!dob) return "";
  const match = dob.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return "";
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return "";
}
