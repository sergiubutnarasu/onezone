export function parseSkillCommand(cmd: string): { source: string; skillName: string } | null {
  // Accept: `npx skills add <source> --skill <name>` or just `<source> --skill <name>`
  const m = cmd.match(/(?:npx\s+(?:--yes\s+)?skills\s+add\s+)?(\S+)\s+--skill\s+(\S+)/);
  if (!m) return null;
  return { source: m[1], skillName: m[2] };
}
