const DISALLOWED_EXECUTABLES = new Set([
  'sh',
  'bash',
  'zsh',
  'fish',
  'dash',
  'cmd',
  'cmd.exe',
  'powershell',
  'powershell.exe',
  'pwsh',
  'pwsh.exe',
]);

function normalizeExecutableName(executable: string): string {
  const segments = executable.replace(/\\/g, '/').split('/');
  return segments[segments.length - 1]!.toLowerCase();
}

export function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index]!;

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (escaped) {
    throw new Error('command cannot end with a trailing escape character');
  }

  if (quote) {
    throw new Error(`command has an unclosed ${quote} quote`);
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

export function validateCommandPolicy(command: string): { executable: string; args: string[] } {
  const tokens = tokenizeCommand(command.trim());
  if (tokens.length === 0) {
    throw new Error('command must not be empty');
  }

  const [executable, ...args] = tokens;
  const normalized = normalizeExecutableName(executable);

  if (DISALLOWED_EXECUTABLES.has(normalized)) {
    throw new Error(
      `shell executable "${normalized}" is not allowed in post-processors; invoke the target program directly`,
    );
  }

  return { executable, args };
}
