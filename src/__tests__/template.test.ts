import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { renderTemplate } from '../engine/template.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe('renderTemplate', () => {
  it('replaces input/workflow/run variables', () => {
    const out = renderTemplate('input={{input}}, wf={{workflow.id}}, run={{run.id}}', {
      input: 'hello',
      workflowId: 'wf1',
      runId: 'run1',
      runDir: '/tmp/none',
      steps: {},
    });
    expect(out).toBe('input=hello, wf=wf1, run=run1');
  });

  it('replaces step output variable', () => {
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-template-'));
    tempDirs.push(runDir);
    fs.writeFileSync(path.join(runDir, 'outline.md'), 'outline-content', 'utf8');

    const out = renderTemplate('outline: {{steps.outline.output}}', {
      input: '',
      workflowId: 'wf1',
      runId: 'run1',
      runDir,
      steps: { outline: { outputFile: 'outline.md' } },
    });
    expect(out).toBe('outline: outline-content');
  });

  it('throws for missing step output', () => {
    expect(() =>
      renderTemplate('{{steps.outline.output}}', {
        input: '',
        workflowId: 'wf1',
        runId: 'run1',
        runDir: '/tmp/none',
        steps: {},
      }),
    ).toThrow();
  });

  it('throws for unknown variable', () => {
    expect(() =>
      renderTemplate('{{unknown}}', {
        input: '',
        workflowId: 'wf1',
        runId: 'run1',
        runDir: '/tmp/none',
        steps: {},
      }),
    ).toThrow();
  });

  it('throws when output file escapes runDir', () => {
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-template-'));
    tempDirs.push(runDir);

    expect(() =>
      renderTemplate('{{steps.outline.output}}', {
        input: '',
        workflowId: 'wf1',
        runId: 'run1',
        runDir,
        steps: { outline: { outputFile: '../outside.md' } },
      }),
    ).toThrow('outside run directory');
  });
});
