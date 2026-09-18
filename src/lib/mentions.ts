const MENTION_PATTERN = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9._-]+)/g;

export function extractMentions(text: string): string[] {
  const matches = text.match(MENTION_PATTERN) ?? [];
  const emails = matches
    .map((m) => m.slice(1))
    .filter((value) => value.includes("@") || value.includes("."));
  return [...new Set(emails)];
}

export function renderMentionText(text: string): string {
  return text.replace(MENTION_PATTERN, '<span class="text-violet-300 font-medium">@$1</span>');
}
