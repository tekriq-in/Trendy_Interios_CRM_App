/**
 * Escapes text so it can be used as a literal inside a RegExp. Needed whenever
 * user-supplied text is turned into a pattern: otherwise `(a+)+$` can hang the
 * server (ReDoS) and `.*` matches everyone (see also VULN-001 in the docs).
 */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
