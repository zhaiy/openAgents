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

describe('renderTemplate with inputs', () => {
  it('replaces simple inputs variable', () => {
    const out = renderTemplate('Name: {{inputs.name}}, Chapter: {{inputs.chapter}}', {
      input: '',
      inputs: { name: '新笔仙', chapter: 4 },
      workflowId: 'wf1',
      runId: 'run1',
      runDir: '/tmp/none',
      steps: {},
    });
    expect(out).toBe('Name: 新笔仙, Chapter: 4');
  });

  it('replaces nested inputs variable', () => {
    const out = renderTemplate('Author: {{inputs.meta.author}}, Version: {{inputs.meta.version}}', {
      input: '',
      inputs: { meta: { author: 'John', version: '1.0' } },
      workflowId: 'wf1',
      runId: 'run1',
      runDir: '/tmp/none',
      steps: {},
    });
    expect(out).toBe('Author: John, Version: 1.0');
  });

  it('converts number to string', () => {
    const out = renderTemplate('Chapter {{inputs.chapter}}', {
      input: '',
      inputs: { chapter: 5 },
      workflowId: 'wf1',
      runId: 'run1',
      runDir: '/tmp/none',
      steps: {},
    });
    expect(out).toBe('Chapter 5');
  });

  it('converts boolean to string', () => {
    const out = renderTemplate('Enabled: {{inputs.enabled}}', {
      input: '',
      inputs: { enabled: true },
      workflowId: 'wf1',
      runId: 'run1',
      runDir: '/tmp/none',
      steps: {},
    });
    expect(out).toBe('Enabled: true');
  });

  it('throws for missing inputs key', () => {
    expect(() =>
      renderTemplate('{{inputs.nonexistent}}', {
        input: '',
        inputs: { name: 'test' },
        workflowId: 'wf1',
        runId: 'run1',
        runDir: '/tmp/none',
        steps: {},
      }),
    ).toThrow('not found in inputs');
  });

  it('throws for missing nested inputs key', () => {
    expect(() =>
      renderTemplate('{{inputs.meta.nonexistent}}', {
        input: '',
        inputs: { meta: { author: 'John' } },
        workflowId: 'wf1',
        runId: 'run1',
        runDir: '/tmp/none',
        steps: {},
      }),
    ).toThrow('not found in inputs');
  });

  it('throws when inputs is not provided', () => {
    expect(() =>
      renderTemplate('{{inputs.name}}', {
        input: '',
        workflowId: 'wf1',
        runId: 'run1',
        runDir: '/tmp/none',
        steps: {},
      }),
    ).toThrow();
  });

  it('remains backward compatible when inputs not provided', () => {
    const out = renderTemplate('input={{input}}, wf={{workflow.id}}', {
      input: 'test-input',
      workflowId: 'wf1',
      runId: 'run1',
      runDir: '/tmp/none',
      steps: {},
    });
    expect(out).toBe('input=test-input, wf=wf1');
  });

  it('handles inputs with null value', () => {
    const out = renderTemplate('Value: {{inputs.value}}', {
      input: '',
      inputs: { value: null },
      workflowId: 'wf1',
      runId: 'run1',
      runDir: '/tmp/none',
      steps: {},
    });
    expect(out).toBe('Value: null');
  });

  it('handles deeply nested inputs', () => {
    const out = renderTemplate('{{inputs.level1.level2.level3}}', {
      input: '',
      inputs: { level1: { level2: { level3: 'deep-value' } } },
      workflowId: 'wf1',
      runId: 'run1',
      runDir: '/tmp/none',
      steps: {},
    });
    expect(out).toBe('deep-value');
  });
});
