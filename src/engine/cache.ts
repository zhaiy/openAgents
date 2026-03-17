import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { TokenUsage } from '../types/index.js';

export interface CacheConfig {
  enabled: boolean;
  ttl?: number; // seconds, default 3600
  key?: string; // custom key template (optional)
}

export interface CachedResult {
  output: string;
  tokenUsage?: TokenUsage;
  durationMs?: number;
  createdAt: number;
  ttl: number;
}

export class StepCache {
  private readonly cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Compute cache key from step parameters
   */
  computeKey(stepId: string, agentId: string, prompt: string, model: string): string {
    const content = `${stepId}:${agentId}:${prompt}:${model}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get cached result if exists and not expired
   */
  get(key: string): CachedResult | null {
    const cachePath = this.getCachePath(key);

    if (!fs.existsSync(cachePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(cachePath, 'utf8');
      const cached = JSON.parse(content) as CachedResult;

      // Check TTL
      const now = Date.now();
      const expiresAt = cached.createdAt + (cached.ttl * 1000);

      if (now > expiresAt) {
        // Cache expired, remove it
        this.delete(key);
        return null;
      }

      return cached;
    } catch {
      // Invalid cache file, remove it
      this.delete(key);
      return null;
    }
  }

  /**
   * Store result in cache
   */
  set(key: string, result: Omit<CachedResult, 'createdAt' | 'ttl'>, ttl: number): void {
    const cachePath = this.getCachePath(key);

    const cached: CachedResult = {
      ...result,
      createdAt: Date.now(),
      ttl,
    };

    fs.writeFileSync(cachePath, JSON.stringify(cached, null, 2), 'utf8');
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): void {
    const cachePath = this.getCachePath(key);
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): number {
    if (!fs.existsSync(this.cacheDir)) {
      return 0;
    }

    const files = fs.readdirSync(this.cacheDir);
    let count = 0;

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(this.cacheDir, file);
        try {
          fs.unlinkSync(filePath);
          count += 1;
        } catch {
          // Ignore errors when deleting
        }
      }
    }

    return count;
  }

  /**
   * Get cache statistics
   */
  stats(): { count: number; totalSize: number } {
    if (!fs.existsSync(this.cacheDir)) {
      return { count: 0, totalSize: 0 };
    }

    const files = fs.readdirSync(this.cacheDir).filter(f => f.endsWith('.json'));
    let totalSize = 0;

    for (const file of files) {
      const filePath = path.join(this.cacheDir, file);
      try {
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      } catch {
        // Ignore errors
      }
    }

    return {
      count: files.length,
      totalSize,
    };
  }

  private getCachePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }
}