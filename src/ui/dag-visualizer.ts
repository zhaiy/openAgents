import type { ExecutionPlan, StepConfig } from '../types/index.js';

/**
 * Calculate the display width needed for a step ID box
 */
function calculateBoxWidth(stepId: string): number {
  // Box format: ┌─ ... ─┐ with padding
  // Minimum width for short names: 4 (corners) + 2 (padding) = 6
  return Math.max(stepId.length + 4, 6);
}

/**
 * Create a text box for a step
 */
function createStepBox(stepId: string, width: number): string[] {
  const paddedStep = stepId.padEnd(width - 4);
  const topLine = '┌' + '─'.repeat(width - 2) + '┐';
  const midLine = '│ ' + paddedStep + ' │';
  const bottomLine = '└' + '─'.repeat(width - 2) + '┘';
  return [topLine, midLine, bottomLine];
}

/**
 * Create parallel indicator text
 */
function createParallelGroupIndicator(layerIndex: number): string {
  return `Layer ${layerIndex}:`;
}

/**
 * Render DAG as ASCII art
 */
export function renderDAGAscii(plan: ExecutionPlan, steps: StepConfig[]): string {
  const lines: string[] = [];
  const stepMap = new Map(steps.map(s => [s.id, s]));
  const { parallelGroups } = plan;

  if (parallelGroups.length === 0) {
    return '(empty workflow)';
  }

  for (let layerIdx = 0; layerIdx < parallelGroups.length; layerIdx++) {
    const group = parallelGroups[layerIdx];
    const isLastLayer = layerIdx === parallelGroups.length - 1;
    const isParallel = group.length > 1;

    // Layer header
    lines.push(createParallelGroupIndicator(layerIdx + 1));

    // Calculate box dimensions for this layer
    const boxWidths = group.map(stepId => calculateBoxWidth(stepId));
    const boxHeight = 3; // top, middle, bottom lines

    // Create boxes for each step in the group
    const boxes: string[][] = group.map((stepId, idx) => createStepBox(stepId, boxWidths[idx]));

    // Combine boxes horizontally with spacing
    const spacing = '  ';
    for (let row = 0; row < boxHeight; row++) {
      const rowParts = boxes.map((box, idx) => {
        const step = stepMap.get(group[idx]);
        // Add visual indicator for gates
        if (row === 1 && step?.gate === 'approve') {
          const gateIndicator = ' ✓';
          const paddedStep = group[idx] + gateIndicator;
          return '│ ' + paddedStep.padEnd(boxWidths[idx] - 4) + ' │';
        }
        return box[row];
      });
      lines.push('  ' + rowParts.join(spacing));
    }

    // Add parallel indicator
    if (isParallel) {
      lines.push('  ' + chalkGray('← 可并行'));
    }

    // Add arrows between layers
    if (!isLastLayer) {
      lines.push(createArrowLine());
    }

    lines.push(''); // Empty line between layers
  }

  // Add legend
  lines.push(chalkGray('---'));
  lines.push(chalkGray('Legend: ✓ = approve gate'));

  return lines.join('\n');
}

/**
 * Create arrow line connecting layers
 */
function createArrowLine(): string {
  // Simple vertical arrow
  return '          ' + '▼';
}

/**
 * Simple gray text helper (no external dependencies for this file)
 */
function chalkGray(text: string): string {
  return `\x1b[90m${text}\x1b[0m`;
}

/**
 * Print DAG visualization to console
 */
export function printDAG(plan: ExecutionPlan, steps: StepConfig[]): void {
  console.log(renderDAGAscii(plan, steps));
}