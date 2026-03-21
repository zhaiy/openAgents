import { DeferredGateProvider, type GateDecision } from '../../engine/gate.js';
import type { GateActionRequestDto, PendingGateDto } from '../dto.js';
import { RunRegistry } from './run-registry.js';

export class GateService {
  constructor(
    private readonly gateProvider: DeferredGateProvider,
    private readonly runRegistry: RunRegistry,
  ) {}

  listPending(runId?: string): PendingGateDto[] {
    return this.gateProvider.listPending(runId);
  }

  submitAction(runId: string, stepId: string, action: GateActionRequestDto): { status: string } {
    const decision = this.mapActionToDecision(action);
    const result = this.gateProvider.submitDecision(runId, stepId, decision);
    if (result.status === 'accepted') {
      const active = this.runRegistry.get(runId);
      active?.eventHandler.emitGateResolved(stepId, decision.action, runId);
    }
    return { status: result.status };
  }

  cancelPending(runId: string): void {
    this.gateProvider.cancelPendingRun(runId);
  }

  private mapActionToDecision(action: GateActionRequestDto): GateDecision {
    switch (action.action) {
      case 'approve':
        return { action: 'continue' };
      case 'reject':
        return { action: 'abort' };
      case 'edit':
        if (!action.editedOutput) {
          throw new Error('editedOutput is required when action=edit');
        }
        return { action: 'edit', editedOutput: action.editedOutput };
      default:
        throw new Error(`Unsupported gate action: ${(action as { action?: string }).action}`);
    }
  }
}
