// Strip ANSI escape sequences and simulate \r overwrite so chat output is readable
export const stripAnsi = (str: string): string => {
  // Split on \r to simulate terminal overwrite — take the last segment
  // (spinner lines like "⠙ \r⠹ \r⠸ \r" become empty and get filtered out)
  const segments = str.split("\r");
  const visible = segments[segments.length - 1] ?? str;
  return visible.replace(/\x1B\[[0-9;?]*[A-Za-z]|\x1B[A-Za-z]/g, "").trim();
};
