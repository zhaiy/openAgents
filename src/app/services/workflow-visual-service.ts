import { ConfigLoader } from '../../config/loader.js';
import { DAGParser } from '../../engine/dag.js';
import type {
  InputSchemaField,
  InputSchemaSummary,
  WorkflowVisualEdge,
  WorkflowVisualNode,
  WorkflowVisualSummaryDto,
} from '../dto.js';
import type { WorkflowVisualNodeType } from '../dto.js';
import type { WorkflowConfig, StepConfig, CacheConfig } from '../../types/index.js';

export class WorkflowVisualService {
  constructor(private readonly loader: ConfigLoader) {}

  /**
   * Get visual summary for a specific workflow
   */
  getVisualSummary(workflowId: string): WorkflowVisualSummaryDto | null {
    try {
      const workflow = this.loader.loadWorkflow(workflowId);
      return this.buildVisualSummary(workflowId, workflow);
    } catch {
      return null;
    }
  }

  /**
   * List visual summaries for all workflows
   */
  listVisualSummaries(): WorkflowVisualSummaryDto[] {
    try {
      const workflows = this.loader.loadWorkflows();
      return [...workflows.values()]
        .map((workflow) =>
          this.buildVisualSummary(workflow.workflow.id, workflow),
        )
        .filter((summary): summary is WorkflowVisualSummaryDto => summary !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  /**
   * Build visual summary from workflow config
   */
  private buildVisualSummary(
    workflowId: string,
    workflow: WorkflowConfig,
  ): WorkflowVisualSummaryDto {
    const parser = new DAGParser();
    const executionPlan = parser.parse(workflow.steps);

    // Build node map for dependency lookup
    const nodeMap = new Map<string, StepConfig>(
      workflow.steps.map((step) => [step.id, step]),
    );

    // Build upstream/downstream maps
    const upstreamIds = new Map<string, string[]>();
    const downstreamIds = new Map<string, string[]>();

    for (const step of workflow.steps) {
      upstreamIds.set(step.id, step.depends_on ?? []);
      downstreamIds.set(step.id, []);
    }

    for (const step of workflow.steps) {
      for (const dep of step.depends_on ?? []) {
        const existing = downstreamIds.get(dep) ?? [];
        existing.push(step.id);
        downstreamIds.set(dep, existing);
      }
    }

    // Count gates and evals
    let gateCount = 0;
    let evalCount = 0;

    // Build visual nodes
    const visualNodes: WorkflowVisualNode[] = executionPlan.order.map((nodeId, index) => {
      const step = nodeMap.get(nodeId)!;

      // Determine node type
      let type: WorkflowVisualNodeType = 'agent';
      if (index === 0) type = 'start';
      else if (index === executionPlan.order.length - 1) type = 'end';
      else if (step.gate) type = 'gate';
      else if (workflow.eval?.enabled) type = 'eval';
      else if (step.post_processors?.length) type = 'script';

      if (step.gate) gateCount++;
      if (workflow.eval?.enabled) evalCount++;

      const isCachedCapable = step.cache
        ? (step.cache as CacheConfig).enabled
        : workflow.cache?.enabled ?? false;

      return {
        id: nodeId,
        name: step.agent ?? step.id,
        type,
        agentId: step.agent,
        hasGate: !!step.gate,
        hasEval: !!workflow.eval?.enabled,
        isCachedCapable,
        upstreamIds: upstreamIds.get(nodeId) ?? [],
        downstreamIds: downstreamIds.get(nodeId) ?? [],
        description: step.task?.slice(0, 200) + (step.task && step.task.length > 200 ? '...' : ''),
      };
    });

    // Build visual edges
    const visualEdges: WorkflowVisualEdge[] = [];
    for (const step of workflow.steps) {
      for (const dep of step.depends_on ?? []) {
        const edgeType: WorkflowVisualEdge['type'] =
          step.gate ? 'gate' : 'default';
        visualEdges.push({
          id: `${dep}->${step.id}`,
          source: dep,
          target: step.id,
          type: edgeType,
        });
      }
    }

    // Build input schema summary
    const inputSchemaSummary = this.buildInputSchemaSummary(workflow);

    return {
      workflowId,
      name: workflow.workflow.name,
      description: workflow.workflow.description,
      nodeCount: visualNodes.length,
      edgeCount: visualEdges.length,
      gateCount,
      evalCount,
      visualNodes,
      visualEdges,
      inputSchemaSummary,
    };
  }

  /**
   * Build input schema summary from workflow
   */
  private buildInputSchemaSummary(
    workflow: WorkflowConfig,
  ): InputSchemaSummary | undefined {
    // Try to extract input schema from workflow definition
    // The schema could be embedded or inferred
    const schema = (workflow as unknown as { input_schema?: Record<string, unknown> }).input_schema;
    if (!schema) return undefined;

    const properties = (schema as { properties?: Record<string, unknown> }).properties;
    if (!properties) return undefined;

    const fields: InputSchemaField[] = Object.entries(properties).map(
      ([name, field]) => {
        const fieldSpec = field as {
          type?: string;
          description?: string;
          default?: unknown;
          required?: boolean;
        };
        return {
          name,
          type: fieldSpec.type ?? 'string',
          required: fieldSpec.required ?? false,
          description: fieldSpec.description,
          defaultValue: fieldSpec.default,
        };
      },
    );

    return {
      fields,
      totalFields: fields.length,
      requiredFields: fields.filter((f) => f.required).length,
    };
  }
}
