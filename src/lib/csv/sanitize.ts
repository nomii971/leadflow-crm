// CSV / spreadsheet safety helpers.

/** Strip control chars, trim, cap length. Applied to every incoming cell. */
export function sanitizeCell(v: unknown, max = 2000): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "string" ? v : String(v);
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (s.length > max) s = s.slice(0, max);
  return s;
}

/**
 * Prevents CSV/formula injection when a file is opened in Excel/Sheets:
 * cells starting with = + - @ tab or CR are prefixed with a single quote.
 */
export function escapeFormula(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/^[=@\t\r]/.test(s)) return `'${s}`;
  // Leading + or - is only dangerous when it is not a plain number / phone number.
  if (/^[+-]/.test(s) && !/^[+-][\d\s().\-/]*$/.test(s)) return `'${s}`;
  return s;
}

export function isAllowedImportFile(name: string, type: string) {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (!["csv", "txt", "xlsx", "xls"].includes(ext)) return false;
  // browsers report many MIME types for CSV; reject obvious executables only
  return !/(javascript|x-msdownload|x-sh|html)/i.test(type);
}
