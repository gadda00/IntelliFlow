/**
 * Fine-Tuning Pipeline — Public API
 * =================================
 *
 * Closes the AReaL self-evolution loop (arXiv:2607.01120) by converting
 * filtered trajectory datasets into actual model fine-tuning jobs.
 *
 *   - TrainingDataFormatter: trajectories → SFT / DPO / RLHF samples
 *   - FineTuneScheduler:     decides WHEN an agent is ready to fine-tune
 *   - FineTuneRunner:        executes (mock) training jobs
 *
 * The Runner is a mock today; the FineTuneJob / FineTuneConfig surface
 * is designed to plug into a real training framework (AReaL, Axolotl, …)
 * with no API changes to callers.
 */

export * from './types';
export { TrainingDataFormatter } from './formatter';
export { FineTuneScheduler } from './scheduler';
export { FineTuneRunner } from './runner';
