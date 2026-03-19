import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { SkillsRegistry, buildSkillsContext } from '../skills/registry.js';
import type { SkillConfig } from '../types/index.js';

describe('SkillsRegistry', () => {
  const testSkillsDir = path.join('/tmp', 'openagents-skills-test');

  beforeEach(() => {
    // Create test fixtures directory
    fs.mkdirSync(testSkillsDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test fixtures
    if (fs.existsSync(testSkillsDir)) {
      fs.rmSync(testSkillsDir, { recursive: true });
    }
  });

  describe('loadAll', () => {
    it('should load no skills when directory does not exist', () => {
      const registry = new SkillsRegistry('/nonexistent');
      registry.loadAll();
      expect(registry.getAll()).toHaveLength(0);
    });

    it('should load no skills when directory is empty', () => {
      const registry = new SkillsRegistry(testSkillsDir);
      registry.loadAll();
      expect(registry.getAll()).toHaveLength(0);
    });

    it('should load a single skill from YAML file', () => {
      const skillYaml = `skill:
  id: test_skill
  name: Test Skill
  description: A test skill
  version: 1.0

instructions: You are a test skill.

output_format: Return JSON with result.
`;
      fs.writeFileSync(path.join(testSkillsDir, 'test_skill.yaml'), skillYaml);

      const registry = new SkillsRegistry(testSkillsDir);
      registry.loadAll();

      const skills = registry.getAll();
      expect(skills).toHaveLength(1);
      expect(skills[0].skill.id).toBe('test_skill');
      expect(skills[0].skill.name).toBe('Test Skill');
      expect(skills[0].skill.description).toBe('A test skill');
      expect(skills[0].skill.version).toBe('1.0');
      expect(skills[0].instructions).toBe('You are a test skill.');
      expect(skills[0].output_format).toBe('Return JSON with result.');
    });

    it('should load multiple skills from YAML files', () => {
      const skill1Yaml = `skill:
  id: skill_one
  name: Skill One
  description: First skill
  version: 1.0

instructions: Skill one instructions.
`;
      const skill2Yaml = `skill:
  id: skill_two
  name: Skill Two
  description: Second skill
  version: 2.0

instructions: Skill two instructions.
`;
      fs.writeFileSync(path.join(testSkillsDir, 'skill_one.yaml'), skill1Yaml);
      fs.writeFileSync(path.join(testSkillsDir, 'skill_two.yaml'), skill2Yaml);

      const registry = new SkillsRegistry(testSkillsDir);
      registry.loadAll();

      const skills = registry.getAll();
      expect(skills).toHaveLength(2);
    });

    it('should skip files without .yaml or .yml extension', () => {
      fs.writeFileSync(path.join(testSkillsDir, 'readme.txt'), 'Not a skill');
      const registry = new SkillsRegistry(testSkillsDir);
      registry.loadAll();
      expect(registry.getAll()).toHaveLength(0);
    });

    it('should handle skill without optional output_format', () => {
      const skillYaml = `skill:
  id: no_output
  name: No Output
  description: Skill without output format
  version: 1.0

instructions: Just instructions.
`;
      fs.writeFileSync(path.join(testSkillsDir, 'no_output.yaml'), skillYaml);

      const registry = new SkillsRegistry(testSkillsDir);
      registry.loadAll();

      const skills = registry.getAll();
      expect(skills).toHaveLength(1);
      expect(skills[0].output_format).toBeUndefined();
    });
  });

  describe('get', () => {
    it('should return undefined for nonexistent skill', () => {
      const registry = new SkillsRegistry(testSkillsDir);
      registry.loadAll();
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should return skill by id', () => {
      const skillYaml = `skill:
  id: my_skill
  name: My Skill
  description: My skill description
  version: 1.0

instructions: My instructions.
`;
      fs.writeFileSync(path.join(testSkillsDir, 'my_skill.yaml'), skillYaml);

      const registry = new SkillsRegistry(testSkillsDir);
      registry.loadAll();

      const skill = registry.get('my_skill');
      expect(skill).toBeDefined();
      expect(skill?.skill.id).toBe('my_skill');
    });
  });

  describe('has', () => {
    it('should return false for nonexistent skill', () => {
      const registry = new SkillsRegistry(testSkillsDir);
      registry.loadAll();
      expect(registry.has('nonexistent')).toBe(false);
    });

    it('should return true for existing skill', () => {
      const skillYaml = `skill:
  id: existing
  name: Existing
  description: Exists
  version: 1.0

instructions: Exists.
`;
      fs.writeFileSync(path.join(testSkillsDir, 'existing.yaml'), skillYaml);

      const registry = new SkillsRegistry(testSkillsDir);
      registry.loadAll();

      expect(registry.has('existing')).toBe(true);
    });
  });
});

describe('buildSkillsContext', () => {
  it('should build skills context from skill configs', () => {
    const skillConfigs: SkillConfig[] = [
      {
        skill: { id: 'skill1', name: 'Skill 1', description: 'First', version: '1.0' },
        instructions: 'Instructions for skill 1',
        output_format: 'JSON format',
      },
      {
        skill: { id: 'skill2', name: 'Skill 2', description: 'Second', version: '1.0' },
        instructions: 'Instructions for skill 2',
      },
    ];

    const context = buildSkillsContext(skillConfigs);

    expect(context.skills).toHaveProperty('skill1');
    expect(context.skills.skill1.instructions).toBe('Instructions for skill 1');
    expect(context.skills.skill1.output_format).toBe('JSON format');
    expect(context.skills).toHaveProperty('skill2');
    expect(context.skills.skill2.instructions).toBe('Instructions for skill 2');
    expect(context.skills.skill2.output_format).toBeUndefined();
  });

  it('should return empty skills object for empty array', () => {
    const context = buildSkillsContext([]);
    expect(context.skills).toEqual({});
  });
});