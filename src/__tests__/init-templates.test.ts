import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { t } from '../i18n/index.js';

describe('init command templates', () => {
  const templatesRoot = path.resolve(import.meta.dirname, '../../templates');

  describe('template discovery', () => {
    it('should have templates directory', () => {
      expect(fs.existsSync(templatesRoot)).toBe(true);
    });

    it('should have default template', () => {
      const defaultTemplatePath = path.join(templatesRoot, 'default');
      expect(fs.existsSync(defaultTemplatePath)).toBe(true);
    });

    it('should have template.json in each template', () => {
      const entries = fs.readdirSync(templatesRoot, { withFileTypes: true });
      const templateDirs = entries.filter((e) => e.isDirectory());

      for (const dir of templateDirs) {
        const metaPath = path.join(templatesRoot, dir.name, 'template.json');
        expect(fs.existsSync(metaPath)).toBe(true);
      }
    });

    it('should have required fields in template.json', () => {
      const entries = fs.readdirSync(templatesRoot, { withFileTypes: true });
      const templateDirs = entries.filter((e) => e.isDirectory());

      const requiredFields = ['id', 'name', 'name_en', 'description', 'description_en'];

      for (const dir of templateDirs) {
        const metaPath = path.join(templatesRoot, dir.name, 'template.json');
        const content = fs.readFileSync(metaPath, 'utf-8');
        const meta = JSON.parse(content);

        for (const field of requiredFields) {
          expect(meta).toHaveProperty(field);
        }
      }
    });

    it('should have openagents.yaml in each template', () => {
      const entries = fs.readdirSync(templatesRoot, { withFileTypes: true });
      const templateDirs = entries.filter((e) => e.isDirectory());

      for (const dir of templateDirs) {
        const configPath = path.join(templatesRoot, dir.name, 'openagents.yaml');
        expect(fs.existsSync(configPath)).toBe(true);
      }
    });

    it('should have agents directory in each template', () => {
      const entries = fs.readdirSync(templatesRoot, { withFileTypes: true });
      const templateDirs = entries.filter((e) => e.isDirectory());

      for (const dir of templateDirs) {
        const agentsPath = path.join(templatesRoot, dir.name, 'agents');
        expect(fs.existsSync(agentsPath)).toBe(true);
        expect(fs.statSync(agentsPath).isDirectory()).toBe(true);
      }
    });

    it('should have workflows directory in each template', () => {
      const entries = fs.readdirSync(templatesRoot, { withFileTypes: true });
      const templateDirs = entries.filter((e) => e.isDirectory());

      for (const dir of templateDirs) {
        const workflowsPath = path.join(templatesRoot, dir.name, 'workflows');
        expect(fs.existsSync(workflowsPath)).toBe(true);
        expect(fs.statSync(workflowsPath).isDirectory()).toBe(true);
      }
    });
  });

  describe('template metadata', () => {
    it('should have valid template IDs', () => {
      const entries = fs.readdirSync(templatesRoot, { withFileTypes: true });
      const templateDirs = entries.filter((e) => e.isDirectory());

      const idRegex = /^[a-z][a-z0-9_-]*$/;

      for (const dir of templateDirs) {
        const metaPath = path.join(templatesRoot, dir.name, 'template.json');
        const content = fs.readFileSync(metaPath, 'utf-8');
        const meta = JSON.parse(content);

        expect(meta.id).toMatch(idRegex);
        expect(meta.id).toBe(dir.name);
      }
    });
  });

  describe('i18n for init', () => {
    it('should have init template translations in English', () => {
      const locale = 'en';
      expect(t(locale, 'initTemplateOption')).toBeDefined();
      expect(t(locale, 'initListTemplatesOption')).toBeDefined();
      expect(t(locale, 'initAvailableTemplates')).toBeDefined();
      expect(t(locale, 'initTemplateNotFound')).toBeDefined();
      expect(t(locale, 'initCompletedWithTemplate')).toBeDefined();
    });

    it('should have init template translations in Chinese', () => {
      const locale = 'zh';
      expect(t(locale, 'initTemplateOption')).toBeDefined();
      expect(t(locale, 'initListTemplatesOption')).toBeDefined();
      expect(t(locale, 'initAvailableTemplates')).toBeDefined();
      expect(t(locale, 'initTemplateNotFound')).toBeDefined();
      expect(t(locale, 'initCompletedWithTemplate')).toBeDefined();
    });
  });

  describe('built-in templates', () => {
    it('should have default template', () => {
      const defaultPath = path.join(templatesRoot, 'default');
      expect(fs.existsSync(defaultPath)).toBe(true);

      const metaPath = path.join(defaultPath, 'template.json');
      const content = fs.readFileSync(metaPath, 'utf-8');
      const meta = JSON.parse(content);

      expect(meta.id).toBe('default');
    });

    it('should have chatbot template', () => {
      const chatbotPath = path.join(templatesRoot, 'chatbot');
      expect(fs.existsSync(chatbotPath)).toBe(true);

      const metaPath = path.join(chatbotPath, 'template.json');
      const content = fs.readFileSync(metaPath, 'utf-8');
      const meta = JSON.parse(content);

      expect(meta.id).toBe('chatbot');
    });

    it('should have web-scraper template', () => {
      const scraperPath = path.join(templatesRoot, 'web-scraper');
      expect(fs.existsSync(scraperPath)).toBe(true);

      const metaPath = path.join(scraperPath, 'template.json');
      const content = fs.readFileSync(metaPath, 'utf-8');
      const meta = JSON.parse(content);

      expect(meta.id).toBe('web-scraper');
    });
  });
});