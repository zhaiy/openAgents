import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { ConfigDraftDto, RuntimeOptions } from '../dto.js';

export class ConfigDraftService {
  private readonly draftsDir: string;
  private cache: Map<string, ConfigDraftDto> = new Map();

  constructor(projectRoot: string) {
    this.draftsDir = path.join(projectRoot, '.drafts');
    this.ensureDirExists();
  }

  /**
   * Create a new draft
   */
  createDraft(params: {
    workflowId: string;
    name: string;
    inputData: Record<string, unknown>;
    runtimeOptions?: RuntimeOptions;
  }): ConfigDraftDto {
    const draftId = randomUUID();
    const now = Date.now();

    const draft: ConfigDraftDto = {
      draftId,
      workflowId: params.workflowId,
      name: params.name,
      inputData: params.inputData,
      runtimeOptions: params.runtimeOptions,
      createdAt: now,
      updatedAt: now,
    };

    this.saveDraftToStorage(draft);
    this.cache.set(draftId, draft);

    return draft;
  }

  /**
   * Get a draft by ID
   */
  getDraft(draftId: string): ConfigDraftDto | null {
    // Check cache first
    if (this.cache.has(draftId)) {
      return this.cache.get(draftId)!;
    }

    // Load from storage
    const draft = this.loadDraftFromStorage(draftId);
    if (draft) {
      this.cache.set(draftId, draft);
    }

    return draft;
  }

  /**
   * Update an existing draft
   */
  updateDraft(
    draftId: string,
    updates: Partial<Omit<ConfigDraftDto, 'draftId' | 'workflowId' | 'createdAt'>>,
  ): ConfigDraftDto | null {
    const draft = this.getDraft(draftId);
    if (!draft) return null;

    const updatedDraft: ConfigDraftDto = {
      ...draft,
      ...updates,
      updatedAt: Date.now(),
    };

    this.saveDraftToStorage(updatedDraft);
    this.cache.set(draftId, updatedDraft);

    return updatedDraft;
  }

  /**
   * Delete a draft
   */
  deleteDraft(draftId: string): boolean {
    const draft = this.getDraft(draftId);
    if (!draft) return false;

    const filePath = this.getDraftFilePath(draft.workflowId, draftId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    this.cache.delete(draftId);

    // Clean up workflow directory if empty
    const workflowDir = path.join(this.draftsDir, draft.workflowId);
    if (fs.existsSync(workflowDir)) {
      const remaining = fs.readdirSync(workflowDir);
      if (remaining.length === 0) {
        fs.rmdirSync(workflowDir);
      }
    }

    return true;
  }

  /**
   * List all drafts for a workflow
   */
  listDraftsByWorkflow(workflowId: string): ConfigDraftDto[] {
    const workflowDir = path.join(this.draftsDir, workflowId);

    if (!fs.existsSync(workflowDir)) {
      return [];
    }

    const files = fs.readdirSync(workflowDir).filter((f) => f.endsWith('.json'));

    const drafts: ConfigDraftDto[] = [];
    for (const file of files) {
      const draftId = file.replace('.json', '');
      const draft = this.getDraft(draftId);
      if (draft) {
        drafts.push(draft);
      }
    }

    return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Duplicate a draft with a new name
   */
  duplicateDraft(draftId: string, newName: string): ConfigDraftDto | null {
    const draft = this.getDraft(draftId);
    if (!draft) return null;

    return this.createDraft({
      workflowId: draft.workflowId,
      name: newName,
      inputData: { ...draft.inputData },
      runtimeOptions: draft.runtimeOptions ? { ...draft.runtimeOptions } : undefined,
    });
  }

  private getDraftFilePath(workflowId: string, draftId: string): string {
    return path.join(this.draftsDir, workflowId, `${draftId}.json`);
  }

  private ensureDirExists(): void {
    if (!fs.existsSync(this.draftsDir)) {
      fs.mkdirSync(this.draftsDir, { recursive: true });
    }
  }

  private saveDraftToStorage(draft: ConfigDraftDto): void {
    const filePath = this.getDraftFilePath(draft.workflowId, draft.draftId);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(draft, null, 2), 'utf8');
  }

  private loadDraftFromStorage(draftId: string): ConfigDraftDto | null {
    // Search all workflow directories for this draft
    if (!fs.existsSync(this.draftsDir)) {
      return null;
    }

    const workflowDirs = fs.readdirSync(this.draftsDir);

    for (const workflowId of workflowDirs) {
      const filePath = path.join(this.draftsDir, workflowId, `${draftId}.json`);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          return JSON.parse(content) as ConfigDraftDto;
        } catch {
          return null;
        }
      }
    }

    return null;
  }
}
