/** Text passed to speechSynthesis only. Stored replies stay unchanged. */
export function spokenForm(reply: string): string {
  return reply
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[*_#>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
