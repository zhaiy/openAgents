import { DAGError } from '../errors.js';
import type { DAGNode, ExecutionPlan, StepConfig } from '../types/index.js';

export class DAGParser {
  parse(steps: StepConfig[]): ExecutionPlan {
    if (steps.length === 0) {
      throw new DAGError('Workflow has no steps');
    }

    const nodeMap = new Map<string, DAGNode>();
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const step of steps) {
      if (nodeMap.has(step.id)) {
        throw new DAGError(`Duplicate step id "${step.id}"`);
      }
      nodeMap.set(step.id, { id: step.id, dependencies: step.depends_on ?? [] });
      inDegree.set(step.id, 0);
      adjacency.set(step.id, []);
    }

    for (const step of steps) {
      for (const dependency of step.depends_on ?? []) {
        if (!nodeMap.has(dependency)) {
          throw new DAGError(`Step "${step.id}" depends on unknown step "${dependency}"`);
        }
        adjacency.get(dependency)?.push(step.id);
        inDegree.set(step.id, (inDegree.get(step.id) ?? 0) + 1);
      }
    }

    const order: string[] = [];
    const parallelGroups: string[][] = [];
    let current = [...inDegree.entries()]
      .filter(([, degree]) => degree === 0)
      .map(([stepId]) => stepId)
      .sort();

    while (current.length > 0) {
      parallelGroups.push(current);
      const nextLevel = new Set<string>();

      for (const nodeId of current) {
        order.push(nodeId);
        for (const next of adjacency.get(nodeId) ?? []) {
          const degree = (inDegree.get(next) ?? 0) - 1;
          inDegree.set(next, degree);
          if (degree === 0) {
            nextLevel.add(next);
          }
        }
      }

      current = [...nextLevel].sort();
    }

    if (order.length !== steps.length) {
      const remaining = [...inDegree.entries()]
        .filter(([, degree]) => degree > 0)
        .map(([id]) => id)
        .sort()
        .join(', ');
      throw new DAGError(`Cycle detected in workflow graph. Remaining nodes: ${remaining}`);
    }

    return {
      nodes: [...nodeMap.values()],
      order,
      parallelGroups,
    };
  }
}
