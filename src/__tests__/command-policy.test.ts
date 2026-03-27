import { describe, expect, it } from 'vitest';

import { tokenizeCommand, validateCommandPolicy } from '../security/command-policy.js';

describe('command policy', () => {
  it('tokenizes commands with quoted arguments', () => {
    expect(tokenizeCommand('node -e "process.stdout.write(\'ok\')"')).toEqual([
      'node',
      '-e',
      "process.stdout.write('ok')",
    ]);
  });

  it('supports escaped spaces', () => {
    expect(tokenizeCommand('python scripts/my\\ file.py')).toEqual([
      'python',
      'scripts/my file.py',
    ]);
  });

  it('rejects unclosed quotes', () => {
    expect(() => tokenizeCommand('node -e "oops')).toThrow('unclosed');
  });

  it('rejects shell executables', () => {
    expect(() => validateCommandPolicy('bash -lc "echo hi"')).toThrow('not allowed');
    expect(() => validateCommandPolicy('/bin/sh -c "echo hi"')).toThrow('not allowed');
  });

  it('returns executable and args for safe commands', () => {
    expect(validateCommandPolicy('node scripts/shrink-context.mjs')).toEqual({
      executable: 'node',
      args: ['scripts/shrink-context.mjs'],
    });
  });
});
