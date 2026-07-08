/**
 * TrajectoryStore — persistence layer for trajectories.
 *
 * Uses Prisma to store trajectories in PostgreSQL. Each trajectory is stored
 * as a single JSONB column for the full step data, with indexed columns for
 * common query patterns (agentId, userId, status, startedAt, reward).
 *
 * The store supports:
 *   - save(trajectory) — persist a complete trajectory
 *   - addReward(trajectoryId, reward) — append a reward (post-completion)
 *   - query(query) — filter trajectories
 *   - get(id) — fetch a single trajectory with all steps
 *   - delete(id) — remove (for GDPR right-to-be-forgotten)
 *   - getStats(agentId) — aggregate metrics for an agent
 */

import type {
  Trajectory,
  TrajectoryId,
  TrajectoryQuery,
  TrajectoryQueryResult,
  TrajectorySummary,
  RewardSignal,
} from './types';

// ============================================================================
// Store Interface
// ============================================================================

/**
 * Abstract store interface — can be backed by Prisma (Postgres), MongoDB,
 * a file system, or an in-memory map for testing.
 */
export interface TrajectoryStore {
  save(trajectory: Trajectory): Promise<void>;
  get(id: TrajectoryId): Promise<Trajectory | null>;
  addReward(id: TrajectoryId, reward: RewardSignal): Promise<void>;
  query(query: TrajectoryQuery): Promise<TrajectoryQueryResult>;
  delete(id: TrajectoryId): Promise<void>;
  getAgentStats(agentId: string): Promise<AgentTrajectoryStats>;
  getRecentRewards(agentId: string, limit?: number): Promise<Array<{ trajectoryId: TrajectoryId; reward: RewardSignal }>>;
}

// ============================================================================
// Stats Types
// ============================================================================

export interface AgentTrajectoryStats {
  agentId: string;
  totalTrajectories: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageDurationMs: number;
  averageReward: number;
  totalTokens: number;
  totalCost: number;
  uniqueDataframeCount: number;
  rewardDistribution: {
    positive: number;  // > 0
    neutral: number;   // == 0
    negative: number;  // < 0
  };
  recentTrend: {
    date: string;
    successRate: number;
    averageReward: number;
    count: number;
  }[];
}

// ============================================================================
// In-Memory Store (for testing and dev)
// ============================================================================

export class InMemoryTrajectoryStore implements TrajectoryStore {
  private trajectories = new Map<TrajectoryId, Trajectory>();

  async save(trajectory: Trajectory): Promise<void> {
    this.trajectories.set(trajectory.id, structuredClone(trajectory));
  }

  async get(id: TrajectoryId): Promise<Trajectory | null> {
    const t = this.trajectories.get(id);
    return t ? structuredClone(t) : null;
  }

  async addReward(id: TrajectoryId, reward: RewardSignal): Promise<void> {
    const t = this.trajectories.get(id);
    if (t) t.rewards.push(reward);
  }

  async query(query: TrajectoryQuery): Promise<TrajectoryQueryResult> {
    let results = Array.from(this.trajectories.values());

    if (query.agentId) results = results.filter(t => t.agentId === query.agentId);
    if (query.userId) results = results.filter(t => t.userId === query.userId);
    if (query.workspaceId) results = results.filter(t => t.workspaceId === query.workspaceId);
    if (query.status) results = results.filter(t => t.status === query.status);
    if (query.startDate) results = results.filter(t => t.startedAt >= query.startDate!);
    if (query.endDate) results = results.filter(t => t.startedAt <= query.endDate!);

    if (query.tags?.length) {
      results = results.filter(t =>
        query.tags!.some(tag => t.metadata.tags?.includes(tag)),
      );
    }

    // Compute summaries
    let summaries: TrajectorySummary[] = results.map(t => ({
      id: t.id,
      analysisId: t.analysisId,
      agentId: t.agentId,
      agentVersion: t.agentVersion,
      status: t.status,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      totalDurationMs: t.metrics.totalDurationMs,
      rewardCount: t.rewards.length,
      averageReward: this.averageReward(t),
      stepCount: t.metrics.stepCount,
      tags: t.metadata.tags,
    }));

    // Filter by reward range
    if (query.minReward !== undefined) {
      summaries = summaries.filter(s => s.averageReward >= query.minReward!);
    }
    if (query.maxReward !== undefined) {
      summaries = summaries.filter(s => s.averageReward <= query.maxReward!);
    }

    // Sort
    const orderBy = query.orderBy ?? 'startedAt';
    const dir = query.orderDirection ?? 'desc';
    summaries.sort((a, b) => {
      let cmp = 0;
      if (orderBy === 'startedAt') cmp = a.startedAt.localeCompare(b.startedAt);
      else if (orderBy === 'completedAt') cmp = (a.completedAt ?? '').localeCompare(b.completedAt ?? '');
      else if (orderBy === 'reward') cmp = a.averageReward - b.averageReward;
      else if (orderBy === 'duration') cmp = a.totalDurationMs - b.totalDurationMs;
      return dir === 'asc' ? cmp : -cmp;
    });

    const total = summaries.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    summaries = summaries.slice(offset, offset + limit);

    return { trajectories: summaries, total, limit, offset };
  }

  async delete(id: TrajectoryId): Promise<void> {
    this.trajectories.delete(id);
  }

  async getAgentStats(agentId: string): Promise<AgentTrajectoryStats> {
    const agentTrajectories = Array.from(this.trajectories.values()).filter(
      t => t.agentId === agentId,
    );

    const total = agentTrajectories.length;
    const success = agentTrajectories.filter(t => t.status === 'success').length;
    const failure = agentTrajectories.filter(t => t.status === 'failed').length;
    const durations = agentTrajectories.map(t => t.metrics.totalDurationMs);
    const rewards = agentTrajectories.map(t => this.averageReward(t));
    const tokens = agentTrajectories.reduce((acc, t) => acc + t.metrics.totalTokens, 0);
    const cost = agentTrajectories.reduce((acc, t) => acc + t.metrics.estimatedCost, 0);
    const dataframes = new Set(agentTrajectories.map(t => t.metadata.dataframeHash));

    const positive = rewards.filter(r => r > 0).length;
    const negative = rewards.filter(r => r < 0).length;
    const neutral = rewards.filter(r => r === 0).length;

    // Recent trend (last 7 days, grouped by day)
    const trend: AgentTrajectoryStats['recentTrend'] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const dayTrajectories = agentTrajectories.filter(t => t.startedAt.slice(0, 10) === dateStr);
      const daySuccess = dayTrajectories.filter(t => t.status === 'success').length;
      const dayRewards = dayTrajectories.map(t => this.averageReward(t));
      trend.push({
        date: dateStr,
        successRate: dayTrajectories.length > 0 ? daySuccess / dayTrajectories.length : 0,
        averageReward: dayRewards.length > 0 ? dayRewards.reduce((a, b) => a + b, 0) / dayRewards.length : 0,
        count: dayTrajectories.length,
      });
    }

    return {
      agentId,
      totalTrajectories: total,
      successCount: success,
      failureCount: failure,
      successRate: total > 0 ? success / total : 0,
      averageDurationMs: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      averageReward: rewards.length > 0 ? rewards.reduce((a, b) => a + b, 0) / rewards.length : 0,
      totalTokens: tokens,
      totalCost: cost,
      uniqueDataframeCount: dataframes.size,
      rewardDistribution: { positive, neutral, negative },
      recentTrend: trend,
    };
  }

  async getRecentRewards(agentId: string, limit = 100): Promise<Array<{ trajectoryId: TrajectoryId; reward: RewardSignal }>> {
    const agentTrajectories = Array.from(this.trajectories.values()).filter(
      t => t.agentId === agentId,
    );
    const rewards: Array<{ trajectoryId: TrajectoryId; reward: RewardSignal }> = [];
    for (const t of agentTrajectories) {
      for (const r of t.rewards) {
        rewards.push({ trajectoryId: t.id, reward: r });
      }
    }
    rewards.sort((a, b) => b.reward.timestamp.localeCompare(a.reward.timestamp));
    return rewards.slice(0, limit);
  }

  private averageReward(t: Trajectory): number {
    if (t.rewards.length === 0) return 0;
    return t.rewards.reduce((acc, r) => acc + r.value, 0) / t.rewards.length;
  }
}

// ============================================================================
// Prisma Store (for production)
// ============================================================================

/**
 * Prisma-backed trajectory store.
 *
 * Requires a Trajectory model in the Prisma schema:
 *
 *   model Trajectory {
 *     id            String   @id
 *     analysisId    String
 *     userId        String
 *     workspaceId   String?
 *     agentId       String
 *     agentVersion  String
 *     status        String
 *     startedAt     DateTime
 *     completedAt   DateTime?
 *     data          Json     // full Trajectory object as JSONB
 *     averageReward Float    @default(0)
 *     dataframeHash String
 *     tags          String[]
 *     @@index([agentId])
 *     @@index([userId])
 *     @@index([status])
 *     @@index([startedAt])
 *     @@index([dataframeHash])
 *   }
 *
 * Usage:
 *   const store = new PrismaTrajectoryStore(db);
 *   await store.save(trajectory);
 */
export class PrismaTrajectoryStore implements TrajectoryStore {
  constructor(private db: any) {}

  async save(trajectory: Trajectory): Promise<void> {
    const averageReward =
      trajectory.rewards.length > 0
        ? trajectory.rewards.reduce((acc, r) => acc + r.value, 0) / trajectory.rewards.length
        : 0;

    await this.db.trajectory.upsert({
      where: { id: trajectory.id },
      create: {
        id: trajectory.id,
        analysisId: trajectory.analysisId,
        userId: trajectory.userId,
        workspaceId: trajectory.workspaceId,
        agentId: trajectory.agentId,
        agentVersion: trajectory.agentVersion,
        status: trajectory.status,
        startedAt: new Date(trajectory.startedAt),
        completedAt: trajectory.completedAt ? new Date(trajectory.completedAt) : null,
        data: trajectory as any,
        averageReward,
        dataframeHash: trajectory.metadata.dataframeHash,
        tags: trajectory.metadata.tags ?? [],
      },
      update: {
        status: trajectory.status,
        completedAt: trajectory.completedAt ? new Date(trajectory.completedAt) : null,
        data: trajectory as any,
        averageReward,
        tags: trajectory.metadata.tags ?? [],
      },
    });
  }

  async get(id: TrajectoryId): Promise<Trajectory | null> {
    const row = await this.db.trajectory.findUnique({ where: { id } });
    return row ? (row.data as Trajectory) : null;
  }

  async addReward(id: TrajectoryId, reward: RewardSignal): Promise<void> {
    const trajectory = await this.get(id);
    if (!trajectory) return;
    trajectory.rewards.push(reward);
    await this.save(trajectory);
  }

  async query(query: TrajectoryQuery): Promise<TrajectoryQueryResult> {
    const where: any = {};
    if (query.agentId) where.agentId = query.agentId;
    if (query.userId) where.userId = query.userId;
    if (query.workspaceId) where.workspaceId = query.workspaceId;
    if (query.status) where.status = query.status;
    if (query.startDate) where.startedAt = { gte: new Date(query.startDate) };
    if (query.endDate) where.startedAt = { ...where.startedAt, lte: new Date(query.endDate) };
    if (query.tags?.length) where.tags = { hasSome: query.tags };
    if (query.minReward !== undefined) where.averageReward = { gte: query.minReward };
    if (query.maxReward !== undefined) where.averageReward = { ...where.averageReward, lte: query.maxReward };

    const orderByField = query.orderBy ?? 'startedAt';
    const orderByDir = query.orderDirection ?? 'desc';

    const [rows, total] = await Promise.all([
      this.db.trajectory.findMany({
        where,
        orderBy: { [orderByField]: orderByDir },
        skip: query.offset ?? 0,
        take: query.limit ?? 50,
      }),
      this.db.trajectory.count({ where }),
    ]);

    const summaries: TrajectorySummary[] = rows.map((row: any) => {
      const t = row.data as Trajectory;
      return {
        id: t.id,
        analysisId: t.analysisId,
        agentId: t.agentId,
        agentVersion: t.agentVersion,
        status: t.status as any,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        totalDurationMs: t.metrics.totalDurationMs,
        rewardCount: t.rewards.length,
        averageReward: row.averageReward,
        stepCount: t.metrics.stepCount,
        tags: t.metadata.tags,
      };
    });

    return {
      trajectories: summaries,
      total,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    };
  }

  async delete(id: TrajectoryId): Promise<void> {
    await this.db.trajectory.delete({ where: { id } });
  }

  async getAgentStats(agentId: string): Promise<AgentTrajectoryStats> {
    const trajectories = await this.db.trajectory.findMany({
      where: { agentId },
      select: { data: true, startedAt: true, status: true },
    });

    const fullTrajectories: Trajectory[] = trajectories.map((r: any) => r.data);
    // Delegate to in-memory computation
    const memStore = new InMemoryTrajectoryStore();
    for (const t of fullTrajectories) {
      await memStore.save(t);
    }
    return memStore.getAgentStats(agentId);
  }

  async getRecentRewards(agentId: string, limit = 100): Promise<Array<{ trajectoryId: TrajectoryId; reward: RewardSignal }>> {
    const trajectories = await this.db.trajectory.findMany({
      where: { agentId },
      select: { data: true },
    });

    const rewards: Array<{ trajectoryId: TrajectoryId; reward: RewardSignal }> = [];
    for (const row of trajectories) {
      const t = row.data as Trajectory;
      for (const r of t.rewards) {
        rewards.push({ trajectoryId: t.id, reward: r });
      }
    }
    rewards.sort((a, b) => b.reward.timestamp.localeCompare(a.reward.timestamp));
    return rewards.slice(0, limit);
  }
}
