import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { StepCache } from '../engine/cache.js';
import type { TokenUsage } from '../types/index.js';

describe('StepCache', () => {
  let tempDir: string;
  let cache: StepCache;

  beforeEach(() => {
    tempDir = path.join(process.cwd(), '.test-cache', `cache-${Date.now()}`);
    cache = new StepCache(tempDir);
  });

  afterEach(() => {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('computeKey', () => {
    it('should generate consistent keys for same inputs', () => {
      const key1 = cache.computeKey('step1', 'agent1', 'prompt1', 'model1');
      const key2 = cache.computeKey('step1', 'agent1', 'prompt1', 'model1');
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = cache.computeKey('step1', 'agent1', 'prompt1', 'model1');
      const key2 = cache.computeKey('step2', 'agent1', 'prompt1', 'model1');
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different prompts', () => {
      const key1 = cache.computeKey('step1', 'agent1', 'prompt1', 'model1');
      const key2 = cache.computeKey('step1', 'agent1', 'prompt2', 'model1');
      expect(key1).not.toBe(key2);
    });

    it('should return a 64-character hex string', () => {
      const key = cache.computeKey('step1', 'agent1', 'prompt1', 'model1');
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('set and get', () => {
    it('should store and retrieve cached result', () => {
      const key = cache.computeKey('step1', 'agent1', 'prompt', 'model');
      const result = {
        output: 'test output',
        tokenUsage: { totalTokens: 100 } as TokenUsage,
        durationMs: 500,
      };

      cache.set(key, result, 3600);
      const cached = cache.get(key);

      expect(cached).not.toBeNull();
      expect(cached?.output).toBe('test output');
      expect(cached?.tokenUsage?.totalTokens).toBe(100);
      expect(cached?.durationMs).toBe(500);
      expect(cached?.ttl).toBe(3600);
      expect(cached?.createdAt).toBeGreaterThan(0);
    });

    it('should return null for non-existent key', () => {
      const cached = cache.get('nonexistent-key');
      expect(cached).toBeNull();
    });

    it('should return null for expired cache', async () => {
      const key = cache.computeKey('step1', 'agent1', 'prompt', 'model');
      const result = { output: 'test output' };

      // Set with 0 TTL (expires immediately)
      cache.set(key, result, 0);

      // Wait a bit for the cache to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      const cached = cache.get(key);
      expect(cached).toBeNull();
    });
  });

  describe('delete', () => {
    it('should remove cached entry', () => {
      const key = cache.computeKey('step1', 'agent1', 'prompt', 'model');
      cache.set(key, { output: 'test' }, 3600);

      expect(cache.get(key)).not.toBeNull();

      cache.delete(key);

      expect(cache.get(key)).toBeNull();
    });

    it('should not throw when deleting non-existent key', () => {
      expect(() => cache.delete('nonexistent-key')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all cached entries', () => {
      const key1 = cache.computeKey('step1', 'agent1', 'prompt1', 'model');
      const key2 = cache.computeKey('step2', 'agent1', 'prompt2', 'model');

      cache.set(key1, { output: 'test1' }, 3600);
      cache.set(key2, { output: 'test2' }, 3600);

      const count = cache.clear();

      expect(count).toBe(2);
      expect(cache.get(key1)).toBeNull();
      expect(cache.get(key2)).toBeNull();
    });

    it('should return 0 when cache directory is empty', () => {
      cache.clear();
      const count = cache.clear();
      expect(count).toBe(0);
    });
  });

  describe('stats', () => {
    it('should return correct stats', () => {
      const key = cache.computeKey('step1', 'agent1', 'prompt', 'model');
      cache.set(key, { output: 'test output content here' }, 3600);

      const stats = cache.stats();

      expect(stats.count).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should return zero stats for empty cache', () => {
      cache.clear();
      const stats = cache.stats();
      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('cache directory creation', () => {
    it('should create cache directory if it does not exist', () => {
      const newCacheDir = path.join(tempDir, 'nested', 'cache');
      new StepCache(newCacheDir); // Creates directory on instantiation

      expect(fs.existsSync(newCacheDir)).toBe(true);

      // Cleanup
      fs.rmSync(path.join(tempDir, 'nested'), { recursive: true, force: true });
    });
  });
});