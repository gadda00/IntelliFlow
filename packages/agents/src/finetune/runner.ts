/**
 * Fine-Tuning Pipeline — Runner
 * =============================
 *
 * Executes a fine-tuning job, tracking its lifecycle through the
 *   pending → preparing → training → evaluating → (deploying) → completed
 * state machine.
 *
 * This implementation is a MOCK: it walks through every stage, emits log
 * entries, decrements a fake loss curve, and reports a fixed evaluation
 * result. No actual model training happens.
 *
 * The intent is that the FineTuneJob / FineTuneConfig surface stays
 * stable while the backend is swapped out — the same Runner interface
 * will eventually dispatch to AReaL, Axolotl, or any other training
 * framework by replacing `runMock` with a real implementation.
 *
 * The runner keeps jobs in an in-memory Map. In production this should
 * be backed by a `FineTuneJob` Prisma model so jobs survive server
 * restarts and can be queried across instances.
 */

import type { FineTuneConfig, FineTuneJob, FineTuneLogEntry } from './types';

export class FineTuneRunner {
  /** All jobs known to this runner, keyed by job ID. */
  private jobs = new Map<string, FineTuneJob>();

  /**
   * Start a fine-tuning job.
   *
   * Creates the job in `pending` status, stores it, kicks off the mock
   * training loop asynchronously (fire-and-forget), and returns the job
   * immediately. Callers should poll `getJob(id)` to observe progress.
   */
  async startJob(config: FineTuneConfig): Promise<FineTuneJob> {
    const job: FineTuneJob = {
      id: `ft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      config,
      status: 'pending',
      createdAt: new Date().toISOString(),
      progress: 0,
      logs: [],
    };

    this.jobs.set(job.id, job);

    // Run async (mock). Errors are caught and recorded on the job.
    this.runMock(job).catch(err => {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
      job.logs.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    });

    return job;
  }

  /** Get a job by ID (or null if unknown). */
  getJob(jobId: string): FineTuneJob | null {
    return this.jobs.get(jobId) ?? null;
  }

  /** List all jobs known to this runner. */
  listJobs(): FineTuneJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Cancel a job.
   *
   * Returns false if the job doesn't exist or is already in a terminal
   * state (completed / failed). The mock loop checks `job.status` at
   * each stage transition and exits early when it sees `cancelled`,
   * so cancellation takes effect at the next stage boundary.
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') return false;
    job.status = 'cancelled';
    job.logs.push({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message: 'Job cancelled by user request',
    });
    return true;
  }

  // ─── Mock training loop ──────────────────────────────────────────────

  /**
   * Mock training loop. Walks through every lifecycle stage, emits logs,
   * and produces a fake result. Checks for cancellation at each stage
   * boundary so `cancelJob` takes effect promptly.
   */
  private async runMock(job: FineTuneJob): Promise<void> {
    const log = (
      level: 'info' | 'warn' | 'error',
      message: string,
      data?: Record<string, unknown>,
    ) => {
      const entry: FineTuneLogEntry = { timestamp: new Date().toISOString(), level, message };
      if (data) entry.data = data;
      job.logs.push(entry);
    };

    // 1. Prepare data
    if (this.isCancelled(job)) return;
    job.status = 'preparing';
    job.startedAt = new Date().toISOString();
    log('info', 'Preparing training data...', { agentId: job.config.agentId });
    await this.sleep(500);
    job.progress = 0.1;

    // 2. Format training data
    if (this.isCancelled(job)) return;
    log('info', `Formatting as ${job.config.method.toUpperCase()}...`);
    await this.sleep(500);
    job.progress = 0.2;

    // 3. Training — one log entry + loss point per epoch.
    if (this.isCancelled(job)) return;
    job.status = 'training';
    for (let epoch = 1; epoch <= job.config.hyperparameters.epochs; epoch++) {
      if (this.isCancelled(job)) return;
      log('info', `Epoch ${epoch}/${job.config.hyperparameters.epochs}`);
      await this.sleep(1000);
      job.progress = 0.2 + (epoch / job.config.hyperparameters.epochs) * 0.5;
      job.currentStep = `Epoch ${epoch}`;

      // Mock loss decreasing across epochs.
      const loss = 2.0 / epoch;
      if (!job.metrics) job.metrics = {};
      if (!job.metrics.trainingLoss) job.metrics.trainingLoss = [];
      job.metrics.trainingLoss.push(loss);
      log('info', `Training loss: ${loss.toFixed(4)}`);
    }

    // 4. Evaluation
    if (this.isCancelled(job)) return;
    job.status = 'evaluating';
    log('info', 'Evaluating on holdout set...');
    await this.sleep(1000);
    job.progress = 0.8;

    if (!job.metrics) job.metrics = {};
    job.metrics.evalLoss = [1.2];
    job.metrics.rewardImprovement = 0.15;
    job.metrics.sampleCount = 200;
    log('info', 'Evaluation complete', { rewardImprovement: 0.15 });

    // 5. Deploy (if autoDeploy)
    if (this.isCancelled(job)) return;
    if (job.config.deploymentConfig.autoDeploy) {
      job.status = 'deploying';
      log(
        'info',
        `Deploying as canary (${job.config.deploymentConfig.canaryPercentage}%)...`,
      );
      await this.sleep(1000);
      job.progress = 0.95;

      job.result = {
        modelPath: `/models/${job.config.outputModelName}`,
        deployedAt: new Date().toISOString(),
        evalResults: {
          accuracy: 0.87,
          reward_correlation: 0.72,
          hallucination_rate: 0.05,
        },
      };
    } else {
      job.result = {
        modelPath: `/models/${job.config.outputModelName}`,
        evalResults: {
          accuracy: 0.87,
          reward_correlation: 0.72,
          hallucination_rate: 0.05,
        },
      };
    }

    // 6. Complete
    if (this.isCancelled(job)) return;
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.progress = 1.0;
    log('info', 'Fine-tuning complete!');
  }

  /**
   * Read whether a job has been cancelled.
   *
   * Wrapped in a method (rather than reading `job.status === 'cancelled'`
   * inline) so TypeScript doesn't narrow the status type based on prior
   * assignments within `runMock` — the status can change to 'cancelled'
   * at any await point via `cancelJob` from another async context.
   */
  private isCancelled(job: FineTuneJob): boolean {
    return job.status === 'cancelled';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
