import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OutputWriter } from '../output/writer.js';

describe('OutputWriter', () => {
  let writer: OutputWriter;
  let tempDir: string;

  beforeEach(() => {
    writer = new OutputWriter();
    tempDir = path.join(process.cwd(), 'test-output-writer-temp');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('ensureDir', () => {
    it('creates directory if not exists', () => {
      writer.ensureDir(tempDir);
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    it('does not throw if directory already exists', () => {
      fs.mkdirSync(tempDir, { recursive: true });
      expect(() => writer.ensureDir(tempDir)).not.toThrow();
    });
  });

  describe('writeStepOutput', () => {
    it('writes output with default filename', () => {
      const outputPath = writer.writeStepOutput(tempDir, 'step-1', 'Hello World');
      expect(outputPath).toBe(path.join(tempDir, 'step-1.md'));
      expect(fs.readFileSync(outputPath, 'utf8')).toBe('Hello World');
    });

    it('writes output with custom filename', () => {
      const outputPath = writer.writeStepOutput(tempDir, 'step-1', 'Hello World', 'custom-name.md');
      expect(outputPath).toBe(path.join(tempDir, 'custom-name.md'));
      expect(fs.readFileSync(outputPath, 'utf8')).toBe('Hello World');
    });

    it('supports custom filename with subdirectories', () => {
      const outputPath = writer.writeStepOutput(tempDir, 'step-1', 'Hello World', 'chapters/chapter-1.md');
      expect(outputPath).toBe(path.join(tempDir, 'chapters', 'chapter-1.md'));
      expect(fs.existsSync(path.join(tempDir, 'chapters'))).toBe(true);
      expect(fs.readFileSync(outputPath, 'utf8')).toBe('Hello World');
    });

    it('supports custom filename with unicode characters', () => {
      const outputPath = writer.writeStepOutput(tempDir, 'step-1', '内容', '大纲.md');
      expect(outputPath).toBe(path.join(tempDir, '大纲.md'));
      expect(fs.readFileSync(outputPath, 'utf8')).toBe('内容');
    });
  });

  describe('readStepOutput', () => {
    it('reads written output', () => {
      writer.writeStepOutput(tempDir, 'step-1', 'Test Content');
      const content = writer.readStepOutput(tempDir, 'step-1');
      expect(content).toBe('Test Content');
    });
  });
});