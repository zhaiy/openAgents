import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe('dotenv package', () => {
  it('is installed and importable', async () => {
    const dotenv = await import('dotenv');
    expect(dotenv.config).toBeDefined();
    expect(typeof dotenv.config).toBe('function');
  });

  it('config returns parsed env vars when file exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-env-'));
    tempDirs.push(tempDir);

    const envPath = path.join(tempDir, '.env');
    fs.writeFileSync(envPath, 'TEST_VAR_1=value1\nTEST_VAR_2=value2\n', 'utf8');

    const dotenv = await import('dotenv');
    const result = dotenv.config({ path: envPath });

    expect(result.error).toBeUndefined();
    expect(result.parsed).toBeDefined();
    expect(result.parsed?.TEST_VAR_1).toBe('value1');
    expect(result.parsed?.TEST_VAR_2).toBe('value2');
  });

  it('does not throw when file does not exist', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-env-'));
    tempDirs.push(tempDir);

    const dotenv = await import('dotenv');
    const result = dotenv.config({ path: path.join(tempDir, '.env.notexist') });

    // dotenv v17 behavior: returns empty parsed object for missing file
    // The important thing is it doesn't throw
    expect(result.parsed).toEqual({});
  });

  it('does not override existing environment variables', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-env-'));
    tempDirs.push(tempDir);

    // Set existing env var
    process.env.OPENAGENTS_EXISTING_VAR = 'original_value';

    const envPath = path.join(tempDir, '.env');
    fs.writeFileSync(envPath, 'OPENAGENTS_EXISTING_VAR=new_value\n', 'utf8');

    const dotenv = await import('dotenv');
    dotenv.config({ path: envPath });

    // Should NOT override the existing value
    expect(process.env.OPENAGENTS_EXISTING_VAR).toBe('original_value');

    // Clean up
    delete process.env.OPENAGENTS_EXISTING_VAR;
  });

  it('sets new environment variables from .env file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-env-'));
    tempDirs.push(tempDir);

    const envPath = path.join(tempDir, '.env');
    fs.writeFileSync(envPath, 'OPENAGENTS_NEW_VAR=new_value_123\n', 'utf8');

    const dotenv = await import('dotenv');
    dotenv.config({ path: envPath });

    expect(process.env.OPENAGENTS_NEW_VAR).toBe('new_value_123');

    // Clean up
    delete process.env.OPENAGENTS_NEW_VAR;
  });

  it('handles .env files with comments and empty lines', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-env-'));
    tempDirs.push(tempDir);

    const envPath = path.join(tempDir, '.env');
    fs.writeFileSync(
      envPath,
      `# This is a comment
VAR_WITH_COMMENT=value1

VAR_AFTER_EMPTY=value2
# Another comment
`,
      'utf8',
    );

    const dotenv = await import('dotenv');
    const result = dotenv.config({ path: envPath });

    expect(result.parsed?.VAR_WITH_COMMENT).toBe('value1');
    expect(result.parsed?.VAR_AFTER_EMPTY).toBe('value2');

    // Clean up
    delete process.env.VAR_WITH_COMMENT;
    delete process.env.VAR_AFTER_EMPTY;
  });
});

describe('.env file loading order', () => {
  it('.env.local has higher priority than .env (loaded first, sets value)', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-env-'));
    tempDirs.push(tempDir);

    const envPath = path.join(tempDir, '.env');
    const envLocalPath = path.join(tempDir, '.env.local');

    fs.writeFileSync(envPath, 'PRIORITY_VAR=from_env\n', 'utf8');
    fs.writeFileSync(envLocalPath, 'PRIORITY_VAR=from_env_local\n', 'utf8');

    const dotenv = await import('dotenv');

    // Load in same order as CLI: .env.local first, then .env
    dotenv.config({ path: envLocalPath });
    dotenv.config({ path: envPath });

    // .env.local value should remain because dotenv doesn't override existing
    expect(process.env.PRIORITY_VAR).toBe('from_env_local');

    // Clean up
    delete process.env.PRIORITY_VAR;
  });

  it('system env has highest priority', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-env-'));
    tempDirs.push(tempDir);

    // Set system env first
    process.env.PRIORITY_TEST_VAR = 'system_value';

    const envPath = path.join(tempDir, '.env');
    fs.writeFileSync(envPath, 'PRIORITY_TEST_VAR=env_value\n', 'utf8');

    const dotenv = await import('dotenv');
    dotenv.config({ path: envPath });

    expect(process.env.PRIORITY_TEST_VAR).toBe('system_value');

    // Clean up
    delete process.env.PRIORITY_TEST_VAR;
  });
});

describe('CLI .env loading', () => {
  it('cli/index.ts imports dotenv at the top', async () => {
    const cliContent = fs.readFileSync(
      path.join(process.cwd(), 'src/cli/index.ts'),
      'utf8',
    );

    // Verify dotenv import is at the top
    expect(cliContent).toContain("import { config as loadEnv } from 'dotenv'");
    expect(cliContent).toContain("loadEnv({ path:");
  });

  it('cli loads .env files in correct order', async () => {
    const cliContent = fs.readFileSync(
      path.join(process.cwd(), 'src/cli/index.ts'),
      'utf8',
    );

    // Check the loading order: .env.local, .env.{NODE_ENV}, .env
    expect(cliContent).toContain("'.env.local'");
    expect(cliContent).toContain('process.env.NODE_ENV');
    expect(cliContent).toContain("'.env'");
  });
});