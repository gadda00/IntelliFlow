/**
 * Shared fine-tune singletons — single module-level instances used by:
 *   - /api/v2/finetune        (POST starts a job, GET lists jobs)
 *   - /api/v2/finetune/[id]   (GET status, DELETE cancel)
 *
 * In development these are in-memory (resets on server restart). In
 * production the scheduler/runner should be backed by a Prisma
 * `FineTuneJob` table so jobs survive restarts and are queryable
 * across instances.
 */

import { FineTuneScheduler, FineTuneRunner, DataProxy } from '@busara/agents';
import { trajectoryStore as store } from '@/lib/trajectory/store';

const dataProxy = new DataProxy(store);
export const fineTuneScheduler = new FineTuneScheduler(store, dataProxy);
export const fineTuneRunner = new FineTuneRunner();
