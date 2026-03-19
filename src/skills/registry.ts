import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

import type { SkillConfig } from '../types/index.js';

function normalizeVersion(version: unknown): string {
  if (typeof version === 'string') {
    return version;
  }
  if (typeof version === 'number' && Number.isFinite(version)) {
    return Number.isInteger(version) ? version.toFixed(1) : String(version);
  }
  return '1.0.0';
}

export class SkillsRegistry {
  private skills = new Map<string, SkillConfig>();

  constructor(private readonly skillsDir: string) {}

  loadAll(): void {
    if (!fs.existsSync(this.skillsDir)) {
      return;
    }

    const files = fs.readdirSync(this.skillsDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

    for (const file of files) {
      const filePath = path.join(this.skillsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const skill = this.parseSkill(content, filePath);
        if (skill) {
          this.skills.set(skill.skill.id, skill);
        }
      } catch (error) {
        console.warn(`Failed to load skill from ${filePath}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  get(id: string): SkillConfig | undefined {
    return this.skills.get(id);
  }

  getAll(): SkillConfig[] {
    return Array.from(this.skills.values());
  }

  has(id: string): boolean {
    return this.skills.has(id);
  }

  private parseSkill(content: string, filePath: string): SkillConfig | undefined {
    try {
      const parsed = yaml.load(content) as Record<string, unknown>;

      if (!parsed || typeof parsed !== 'object') {
        return undefined;
      }

      const skillData = parsed.skill as Record<string, unknown> | undefined;
      const instructions = parsed.instructions;
      const outputFormat = parsed.output_format;

      if (!skillData || typeof skillData !== 'object') {
        return undefined;
      }

      const skillRecord = skillData as Record<string, unknown>;
      const id = skillRecord.id;
      const name = skillRecord.name;

      if (!id || typeof id !== 'string' || !name || typeof name !== 'string') {
        return undefined;
      }

      return {
        skill: {
          id: id as string,
          name: name as string,
          description: typeof skillRecord.description === 'string' ? (skillRecord.description as string) : '',
          version: normalizeVersion(skillRecord.version),
        },
        instructions: typeof instructions === 'string' ? instructions : '',
        output_format: typeof outputFormat === 'string' ? outputFormat : undefined,
      };
    } catch (error) {
      console.warn(`Failed to parse skill from ${filePath}:`, error instanceof Error ? error.message : error);
      return undefined;
    }
  }
}

export interface SkillsContext {
  skills: Record<string, { instructions: string; output_format?: string }>;
}

export function buildSkillsContext(skillConfigs: SkillConfig[]): SkillsContext {
  const skills: SkillsContext['skills'] = {};
  for (const skill of skillConfigs) {
    skills[skill.skill.id] = {
      instructions: skill.instructions,
      output_format: skill.output_format,
    };
  }
  return { skills };
}
