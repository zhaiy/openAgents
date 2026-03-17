import boxen from 'boxen';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';

import { getDefaultLocale, t, type Locale } from '../i18n/index.js';
import type { ExecutionPlan, RunState, StepStatus, TokenUsage } from '../types/index.js';

interface StepDetail {
  duration?: number;
  outputPreview?: string;
  error?: string;
  tokenUsage?: TokenUsage;
}

export class ProgressUI {
  constructor(private readonly locale: Locale = getDefaultLocale()) {}

  private spinnerByStep = new Map<string, Ora>();
  private stepIndexById = new Map<string, number>();
  private totalSteps = 0;

  private localizeStatus(status: StepStatus | RunState['status']): string {
    switch (status) {
      case 'running':
        return t(this.locale, 'statusRunning');
      case 'completed':
        return t(this.locale, 'statusCompleted');
      case 'failed':
        return t(this.locale, 'statusFailed');
      case 'interrupted':
        return t(this.locale, 'statusInterrupted');
      case 'pending':
        return t(this.locale, 'statusPending');
      case 'skipped':
        return t(this.locale, 'statusSkipped');
      default:
        return String(status);
    }
  }

  start(plan: ExecutionPlan, state: RunState, workflowName: string): void {
    this.totalSteps = plan.order.length;
    this.stepIndexById.clear();
    plan.order.forEach((id, index) => this.stepIndexById.set(id, index + 1));
    console.log(chalk.cyan(`\n=== ${workflowName} ===`));
    console.log(chalk.gray(`${t(this.locale, 'runId', { runId: state.runId })}\n`));
  }

  updateStep(stepId: string, status: StepStatus, detail?: StepDetail): void {
    const index = this.stepIndexById.get(stepId) ?? 0;
    const prefix = `[${index}/${this.totalSteps}] ${stepId}`;

    if (status === 'running') {
      const existing = this.spinnerByStep.get(stepId);
      if (existing) {
        existing.stop();
      }
      const spinner = ora(t(this.locale, 'progressStepRunning', { prefix })).start();
      this.spinnerByStep.set(stepId, spinner);
      return;
    }

    const spinner = this.spinnerByStep.get(stepId);
    if (spinner) {
      spinner.stop();
      this.spinnerByStep.delete(stepId);
    }

    if (status === 'completed') {
      const duration = detail?.duration ? ` (${Math.round(detail.duration / 1000)}s)` : '';
      const tokens = detail?.tokenUsage?.totalTokens ?? 0;
      const tokenStr = tokens > 0 ? `, ${tokens.toLocaleString()} tokens` : '';
      console.log(chalk.green(`✅ ${t(this.locale, 'progressStepCompleted', { prefix })}${duration}${tokenStr}`));
      if (detail?.outputPreview) {
        console.log(
          boxen(detail.outputPreview, {
            title: t(this.locale, 'progressOutputPreviewTitle'),
            padding: 1,
            borderStyle: 'round',
          }),
        );
      }
      return;
    }

    if (status === 'failed') {
      console.log(
        chalk.red(
          t(this.locale, 'progressStepFailed', {
            prefix,
            error: detail?.error ?? t(this.locale, 'unknownError'),
          }),
        ),
      );
      return;
    }

    if (status === 'interrupted') {
      console.log(chalk.yellow(t(this.locale, 'progressStepInterrupted', { prefix })));
      return;
    }
  }

  showGatePrompt(stepId: string, output: string, previewLines: number): void {
    const preview = output.split('\n').slice(0, previewLines).join('\n');
    console.log(chalk.yellow(`\n${t(this.locale, 'progressGateWaiting', { stepId })}`));
    console.log(
      boxen(preview, { title: t(this.locale, 'progressGatePreviewTitle'), padding: 1, borderStyle: 'round' }),
    );
  }

  announceRetry(stepId: string, attempt: number, maxAttempts: number, reason: string): void {
    const index = this.stepIndexById.get(stepId) ?? 0;
    const prefix = `[${index}/${this.totalSteps}] ${stepId}`;
    console.log(
      chalk.yellow(
        t(this.locale, 'progressStepRetry', {
          prefix,
          attempt: String(attempt),
          maxAttempts: String(maxAttempts),
          reason,
        }),
      ),
    );
  }

  complete(state: RunState): void {
    // Calculate totals
    let totalTokens = 0;
    let totalDurationMs = 0;
    const stepSummaries: string[] = [];

    for (const [stepId, step] of Object.entries(state.steps)) {
      const index = this.stepIndexById.get(stepId) ?? 0;
      const prefix = `[${index}/${this.totalSteps}]`;
      const statusIcon = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⚠️';
      const duration = step.durationMs ? `${Math.round(step.durationMs / 1000)}s` : '-';
      const tokens = step.tokenUsage?.totalTokens ?? 0;
      totalTokens += tokens;
      totalDurationMs += step.durationMs ?? 0;
      const tokenStr = tokens > 0 ? `, ${tokens.toLocaleString()} tokens` : '';
      stepSummaries.push(`  ${statusIcon} ${prefix} ${stepId} (${duration}${tokenStr})`);
    }

    // Print step summaries
    if (stepSummaries.length > 0) {
      console.log('\n' + stepSummaries.join('\n'));
    }

    // Print totals
    const totalDurationSec = Math.round(totalDurationMs / 1000);
    const totalDurationStr =
      totalDurationSec >= 60
        ? `${Math.floor(totalDurationSec / 60)}m ${totalDurationSec % 60}s`
        : `${totalDurationSec}s`;
    console.log(
      chalk.cyan(`\n📊 ${t(this.locale, 'progressSummaryTotal', { duration: totalDurationStr, tokens: totalTokens.toLocaleString() })}`),
    );

    console.log(
      chalk.green(
        `\n${t(this.locale, 'progressWorkflowFinished', {
          status: this.localizeStatus(state.status),
        })}`,
      ),
    );
  }

  stop(): void {
    for (const spinner of this.spinnerByStep.values()) {
      spinner.stop();
    }
    this.spinnerByStep.clear();
  }
}
