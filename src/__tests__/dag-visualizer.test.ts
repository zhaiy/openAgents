import { describe, it, expect } from 'vitest';

import { DAGParser } from '../engine/dag.js';
import { renderDAGAscii } from '../ui/dag-visualizer.js';
import type { StepConfig } from '../types/index.js';

describe('DAG Visualizer', () => {
  describe('renderDAGAscii', () => {
    it('should render single step workflow', () => {
      const steps: StepConfig[] = [
        { id: 'step1', agent: 'agent1', task: 'task1' },
      ];
      const plan = new DAGParser().parse(steps);
      const result = renderDAGAscii(plan, steps);

      expect(result).toContain('Layer 1:');
      expect(result).toContain('step1');
    });

    it('should render sequential steps', () => {
      const steps: StepConfig[] = [
        { id: 'step1', agent: 'agent1', task: 'task1' },
        { id: 'step2', agent: 'agent2', task: 'task2', depends_on: ['step1'] },
        { id: 'step3', agent: 'agent3', task: 'task3', depends_on: ['step2'] },
      ];
      const plan = new DAGParser().parse(steps);
      const result = renderDAGAscii(plan, steps);

      expect(result).toContain('Layer 1:');
      expect(result).toContain('Layer 2:');
      expect(result).toContain('Layer 3:');
      expect(result).toContain('step1');
      expect(result).toContain('step2');
      expect(result).toContain('step3');
    });

    it('should show parallel indicator for parallel steps', () => {
      const steps: StepConfig[] = [
        { id: 'step1', agent: 'agent1', task: 'task1' },
        { id: 'step2', agent: 'agent2', task: 'task2' },
        { id: 'step3', agent: 'agent3', task: 'task3', depends_on: ['step1', 'step2'] },
      ];
      const plan = new DAGParser().parse(steps);
      const result = renderDAGAscii(plan, steps);

      expect(result).toContain('可并行');
    });

    it('should show gate indicators', () => {
      const steps: StepConfig[] = [
        { id: 'step1', agent: 'agent1', task: 'task1', gate: 'approve' },
        { id: 'step2', agent: 'agent2', task: 'task2', gate: 'auto' },
      ];
      const plan = new DAGParser().parse(steps);
      const result = renderDAGAscii(plan, steps);

      expect(result).toContain('✓');
    });

    it('should show legend', () => {
      const steps: StepConfig[] = [
        { id: 'step1', agent: 'agent1', task: 'task1' },
      ];
      const plan = new DAGParser().parse(steps);
      const result = renderDAGAscii(plan, steps);

      expect(result).toContain('Legend');
    });

    it('should handle empty workflow', () => {
      // DAGParser will throw for empty steps, so we test with an empty parallelGroups
      const result = renderDAGAscii(
        { nodes: [], order: [], parallelGroups: [] },
        [],
      );

      expect(result).toBe('(empty workflow)');
    });

    it('should render box characters', () => {
      const steps: StepConfig[] = [
        { id: 'step1', agent: 'agent1', task: 'task1' },
      ];
      const plan = new DAGParser().parse(steps);
      const result = renderDAGAscii(plan, steps);

      expect(result).toContain('┌');
      expect(result).toContain('└');
      expect(result).toContain('│');
      expect(result).toContain('─');
    });

    it('should show arrows between layers', () => {
      const steps: StepConfig[] = [
        { id: 'step1', agent: 'agent1', task: 'task1' },
        { id: 'step2', agent: 'agent2', task: 'task2', depends_on: ['step1'] },
      ];
      const plan = new DAGParser().parse(steps);
      const result = renderDAGAscii(plan, steps);

      expect(result).toContain('▼');
    });
  });
});