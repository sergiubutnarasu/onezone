// Wrap a string in single quotes for safe shell interpolation.
// Single-quoted strings are treated literally in POSIX sh — no variable
// expansion, no command substitution.  The only special case is an
// embedded single-quote, which must be closed, escaped, then reopened.
export const shellQuote = (arg: string): string =>
  `'${arg.replace(/'/g, "'\\''")}'`;

// Strip ANSI escape sequences and simulate \r overwrite so chat output is readable
export const stripAnsi = (str: string): string => {
  // Split on \r to simulate terminal overwrite — take the last segment
  // (spinner lines like "⠙ \r⠹ \r⠸ \r" become empty and get filtered out)
  const segments = str.split("\r");
  const visible = segments[segments.length - 1] ?? str;
  return visible.replace(/\x1B\[[0-9;?]*[A-Za-z]|\x1B[A-Za-z]/g, "").trim();
};
