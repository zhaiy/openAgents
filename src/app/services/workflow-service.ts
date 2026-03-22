import { ConfigLoader } from '../../config/loader.js';
import type { WorkflowDetailDto, WorkflowSummaryDto } from '../dto.js';
import { mapWorkflowDetail } from '../dto.js';

export class WorkflowService {
  constructor(private readonly loader: ConfigLoader) {}

  listWorkflows(): WorkflowSummaryDto[] {
    try {
      return [...this.loader.loadWorkflows().values()]
        .map((workflow) => ({
          id: workflow.workflow.id,
          name: workflow.workflow.name,
          description: workflow.workflow.description,
          stepCount: workflow.steps.length,
          hasGate: workflow.steps.some((step) => (step.gate ?? 'auto') === 'approve'),
          hasEval: !!workflow.eval?.enabled,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
    } catch {
      return [];
    }
  }

  getWorkflow(workflowId: string): WorkflowDetailDto | null {
    try {
      const workflow = this.loader.loadWorkflow(workflowId);
      return mapWorkflowDetail(workflow);
    } catch {
      return null;
    }
  }
}
