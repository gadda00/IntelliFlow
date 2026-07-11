/**
 * Real Isolation Forest implementation.
 *
 * The Isolation Forest algorithm isolates anomalies by randomly selecting
 * a feature and randomly selecting a split value between the minimum and
 * maximum values of that feature. The path length from the root to a
 * leaf node is used as an anomaly score — shorter paths indicate anomalies
 * (they're easier to isolate).
 *
 * Reference: Liu, Ting & Zhou (2008) "Isolation Forest"
 * https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/icdm08b.pdf
 */

import { createRng } from './seededRandom';

export interface IsolationTree {
  /** If internal node: the split attribute and value */
  splitAttr?: number;
  splitValue?: number;
  left?: IsolationTree;
  right?: IsolationTree;
  /** If leaf node: the size of the data at this leaf */
  size?: number;
}

/**
 * Build a single isolation tree.
 * Recursively partitions data until max depth or single point.
 */
function buildTree(
  data: number[][],
  depth: number,
  maxDepth: number,
  rng: () => number,
): IsolationTree {
  if (depth >= maxDepth || data.length <= 1) {
    return { size: data.length };
  }

  // Pick a random feature
  const numFeatures = data[0].length;
  const attrIdx = Math.floor(rng() * numFeatures);

  // Get min/max for this feature
  let min = Infinity, max = -Infinity;
  for (const row of data) {
    if (row[attrIdx] < min) min = row[attrIdx];
    if (row[attrIdx] > max) max = row[attrIdx];
  }

  // If all values are the same, can't split
  if (min === max) return { size: data.length };

  // Random split point between min and max
  const splitValue = min + rng() * (max - min);

  // Partition data
  const left: number[][] = [];
  const right: number[][] = [];
  for (const row of data) {
    if (row[attrIdx] < splitValue) left.push(row);
    else right.push(row);
  }

  return {
    splitAttr: attrIdx,
    splitValue,
    left: buildTree(left, depth + 1, maxDepth, rng),
    right: buildTree(right, depth + 1, maxDepth, rng),
  };
}

/**
 * Compute the path length for a single point.
 * This is the number of edges traversed from root to leaf.
 */
function pathLength(point: number[], tree: IsolationTree, depth: number = 0): number {
  if (tree.size !== undefined) {
    // Leaf node — add average path length of unsuccessful search
    return depth + averagePathLength(tree.size);
  }
  if (point[tree.splitAttr!] < tree.splitValue!) {
    return pathLength(point, tree.left!, depth + 1);
  } else {
    return pathLength(point, tree.right!, depth + 1);
  }
}

/**
 * Average path length of unsuccessful search in a BST.
 * c(n) = 2 * H(n-1) - 2*(n-1)/n, where H(i) ≈ ln(i) + 0.5772156649 (Euler's constant)
 */
function averagePathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const H = Math.log(n - 1) + 0.5772156649; // harmonic number approximation
  return 2 * H - 2 * (n - 1) / n;
}

/**
 * Run the Isolation Forest algorithm.
 *
 * @param data Input data as array of number arrays (each row is a point)
 * @param numTrees Number of isolation trees (default 100)
 * @param sampleSize Sub-sampling size per tree (default min(256, data.length))
 * @param seed Random seed for reproducibility
 * @returns Anomaly scores (0-1, higher = more anomalous) and indices sorted by anomaly score
 */
export function isolationForest(
  data: number[][],
  numTrees: number = 100,
  sampleSize: number = Math.min(256, data.length),
  seed: number = 42,
): {
  scores: number[];
  anomalies: { index: number; score: number }[];
  threshold: number;
} {
  if (data.length === 0) return { scores: [], anomalies: [], threshold: 0 };

  const rng = createRng(seed);
  const numFeatures = data[0].length;
  const maxDepth = Math.ceil(Math.log2(sampleSize));

  // Build forest
  const trees: IsolationTree[] = [];
  for (let t = 0; t < numTrees; t++) {
    // Subsample data
    const indices: number[] = [];
    const used = new Set<number>();
    while (indices.length < sampleSize && indices.length < data.length) {
      const idx = Math.floor(rng() * data.length);
      if (!used.has(idx)) {
        used.add(idx);
        indices.push(idx);
      }
    }
    const sample = indices.map(i => data[i]);
    trees.push(buildTree(sample, 0, maxDepth, rng));
  }

  // Compute anomaly scores
  const scores = data.map(point => {
    // Average path length across all trees
    let avgPath = 0;
    for (const tree of trees) {
      avgPath += pathLength(point, tree);
    }
    avgPath /= trees.length;

    // Anomaly score: s = 2^(-E(h) / c(n))
    // where E(h) is average path length, c(n) is normalization factor
    const c = averagePathLength(sampleSize);
    const score = c > 0 ? Math.pow(2, -avgPath / c) : 0.5;
    return Math.max(0, Math.min(1, score));
  });

  // Find anomalies (score > 0.6 typically indicates anomaly)
  const threshold = 0.6;
  const anomalies = scores
    .map((score, index) => ({ index, score }))
    .filter(a => a.score >= threshold)
    .sort((a, b) => b.score - a.score);

  return { scores, anomalies, threshold };
}
