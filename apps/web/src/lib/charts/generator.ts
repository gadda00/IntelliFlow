// Server-side chart image generation using the native canvas module directly.
// Draws charts manually on a canvas — no external chart library dependencies.
// This approach is more reliable in serverless/Next.js environments.

import 'server-only';
import { createCanvas, registerFont } from 'canvas';

export interface ChartConfig {
  type: 'bar' | 'line' | 'scatter' | 'histogram';
  data: any;
  title: string;
  color?: string;
  options?: any;
}

const WIDTH = 800;
const HEIGHT = 400;
const PADDING = { top: 50, right: 30, bottom: 60, left: 60 };
const BG_COLOR = '#0f172a';
const TEXT_COLOR = '#e2e8f0';
const GRID_COLOR = '#1e293b';
const AXIS_COLOR = '#334155';

/**
 * Generate a chart PNG as a base64 data URL.
 */
export async function generateChartImage(config: ChartConfig): Promise<string> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Title
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(config.title, WIDTH / 2, 25);

  const chartArea = {
    x: PADDING.left,
    y: PADDING.top,
    width: WIDTH - PADDING.left - PADDING.right,
    height: HEIGHT - PADDING.top - PADDING.bottom,
  };

  switch (config.type) {
    case 'bar':
      drawBarChart(ctx, config, chartArea);
      break;
    case 'line':
      drawLineChart(ctx, config, chartArea);
      break;
    case 'histogram':
      drawHistogram(ctx, config, chartArea);
      break;
    case 'scatter':
      drawScatter(ctx, config, chartArea);
      break;
  }

  const buffer = canvas.toBuffer('image/png');
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

function drawBarChart(ctx: any, config: ChartConfig, area: any) {
  const data = config.data;
  const color = config.color || '#10b981';
  const horizontal = config.options?.horizontal;

  const maxVal = Math.max(...data.map((d: any) => d.value));
  const barCount = data.length;

  ctx.fillStyle = AXIS_COLOR;
  ctx.font = '10px sans-serif';

  if (horizontal) {
    const barHeight = area.height / barCount * 0.7;
    const gap = area.height / barCount * 0.3;

    data.forEach((d: any, i: number) => {
      const y = area.y + i * (barHeight + gap);
      const barWidth = (d.value / maxVal) * area.width;

      // Bar
      ctx.fillStyle = color;
      ctx.fillRect(area.x, y, barWidth, barHeight);

      // Label
      ctx.fillStyle = TEXT_COLOR;
      ctx.textAlign = 'right';
      ctx.fillText(d.label.length > 20 ? d.label.slice(0, 18) + '…' : d.label, area.x - 5, y + barHeight / 2 + 3);

      // Value
      ctx.textAlign = 'left';
      ctx.fillText(d.value.toString(), area.x + barWidth + 5, y + barHeight / 2 + 3);
    });
  } else {
    const barWidth = area.width / barCount * 0.7;
    const gap = area.width / barCount * 0.3;

    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = area.y + (area.height / 4) * i;
      ctx.strokeStyle = GRID_COLOR;
      ctx.beginPath();
      ctx.moveTo(area.x, y);
      ctx.lineTo(area.x + area.width, y);
      ctx.stroke();

      const val = Math.round(maxVal * (1 - i / 4));
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'right';
      ctx.fillText(val.toString(), area.x - 5, y + 3);
    }

    data.forEach((d: any, i: number) => {
      const x = area.x + i * (barWidth + gap) + gap / 2;
      const barHeight = (d.value / maxVal) * area.height;
      const y = area.y + area.height - barHeight;

      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, barHeight);

      ctx.fillStyle = TEXT_COLOR;
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(x + barWidth / 2, area.y + area.height + 15);
      ctx.rotate(-0.3);
      ctx.fillText(d.label.length > 12 ? d.label.slice(0, 10) + '…' : d.label, 0, 0);
      ctx.restore();
    });
  }
}

function drawLineChart(ctx: any, config: ChartConfig, area: any) {
  const data = config.data;
  const color = config.color || '#0ea5e9';

  const values = data.map((d: any) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  // Grid
  for (let i = 0; i <= 4; i++) {
    const y = area.y + (area.height / 4) * i;
    ctx.strokeStyle = GRID_COLOR;
    ctx.beginPath();
    ctx.moveTo(area.x, y);
    ctx.lineTo(area.x + area.width, y);
    ctx.stroke();

    const val = (maxVal - (range * i / 4)).toFixed(1);
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.fillText(val, area.x - 5, y + 3);
  }

  // Line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((d: any, i: number) => {
    const x = area.x + (i / (data.length - 1)) * area.width;
    const y = area.y + area.height - ((d.value - minVal) / range) * area.height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Fill area under line
  ctx.lineTo(area.x + area.width, area.y + area.height);
  ctx.lineTo(area.x, area.y + area.height);
  ctx.closePath();
  ctx.fillStyle = color + '20';
  ctx.fill();

  // Points
  ctx.fillStyle = color;
  data.forEach((d: any, i: number) => {
    const x = area.x + (i / (data.length - 1)) * area.width;
    const y = area.y + area.height - ((d.value - minVal) / range) * area.height;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // X labels (every Nth)
  const labelStep = Math.max(1, Math.floor(data.length / 8));
  ctx.fillStyle = '#64748b';
  ctx.font = '9px sans-serif';
  data.forEach((d: any, i: number) => {
    if (i % labelStep === 0) {
      const x = area.x + (i / (data.length - 1)) * area.width;
      ctx.textAlign = 'center';
      const label = String(d.label).slice(0, 10);
      ctx.fillText(label, x, area.y + area.height + 15);
    }
  });
}

function drawHistogram(ctx: any, config: ChartConfig, area: any) {
  const values = config.data.values || config.data;
  const color = config.color || '#10b981';
  const bins = computeBins(values);

  const maxCount = Math.max(...bins.map(b => b.count));

  // Grid
  for (let i = 0; i <= 4; i++) {
    const y = area.y + (area.height / 4) * i;
    ctx.strokeStyle = GRID_COLOR;
    ctx.beginPath();
    ctx.moveTo(area.x, y);
    ctx.lineTo(area.x + area.width, y);
    ctx.stroke();

    const val = Math.round(maxCount * (1 - i / 4));
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.fillText(val.toString(), area.x - 5, y + 3);
  }

  const barWidth = area.width / bins.length * 0.9;
  bins.forEach((bin, i) => {
    const x = area.x + i * (area.width / bins.length) + (area.width / bins.length) * 0.05;
    const barHeight = (bin.count / maxCount) * area.height;
    const y = area.y + area.height - barHeight;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, barHeight);
  });
}

function drawScatter(ctx: any, config: ChartConfig, area: any) {
  const points = config.data.points || config.data;
  const color = config.color || '#8b5cf6';

  const xValues = points.map((p: any) => p.x);
  const yValues = points.map((p: any) => p.y);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  // Grid
  for (let i = 0; i <= 4; i++) {
    const y = area.y + (area.height / 4) * i;
    ctx.strokeStyle = GRID_COLOR;
    ctx.beginPath();
    ctx.moveTo(area.x, y);
    ctx.lineTo(area.x + area.width, y);
    ctx.stroke();

    const x = area.x + (area.width / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x, area.y);
    ctx.lineTo(x, area.y + area.height);
    ctx.stroke();
  }

  // Points
  ctx.fillStyle = color + '80';
  points.forEach((p: any) => {
    const x = area.x + ((p.x - xMin) / xRange) * area.width;
    const y = area.y + area.height - ((p.y - yMin) / yRange) * area.height;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function computeBins(values: number[]): { label: string; count: number }[] {
  if (!values.length) return [];
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const range = mx - mn;
  if (range === 0) return [{ label: mn.toFixed(2), count: values.length }];
  const binCount = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(values.length))));
  const binWidth = range / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    label: `${(mn + i * binWidth).toFixed(1)}`,
    count: 0,
  }));
  for (const v of values) {
    let idx = Math.floor((v - mn) / binWidth);
    if (idx >= binCount) idx = binCount - 1;
    bins[idx].count++;
  }
  return bins;
}

// ─── Convenience wrappers for specific chart types ────────────────────────

export async function generateHistogramChart(values: number[], title: string, color: string = '#10b981'): Promise<string> {
  return generateChartImage({ type: 'histogram', data: { values }, title, color });
}

export async function generateLineChart(data: { label: string; value: number }[], title: string, color: string = '#0ea5e9'): Promise<string> {
  return generateChartImage({ type: 'line', data, title, color });
}

export async function generateForecastChart(
  historical: { label: string; value: number }[],
  forecast: { label: string; value: number; lower?: number; upper?: number }[],
  title: string,
): Promise<string> {
  // Combine into a single line chart with confidence band
  const allData = [
    ...historical.map(h => ({ label: h.label, value: h.value })),
    ...forecast.map(f => ({ label: f.label, value: f.value })),
  ];
  return generateChartImage({ type: 'line', data: allData, title, color: '#10b981' });
}

export async function generateCorrelationHeatmap(
  matrix: { row: string; col: string; value: number }[],
  _variables: string[],
  title: string,
): Promise<string> {
  // Render as horizontal bar chart of correlations
  const data = matrix.filter(m => m.row !== m.col).slice(0, 10).map(m => ({
    label: `${m.row} ↔ ${m.col}`,
    value: Number(m.value.toFixed(3)),
  }));
  return generateChartImage({ type: 'bar', data, title, color: '#8b5cf6', options: { horizontal: true } });
}

export async function generateScatterChart(
  points: { x: number; y: number }[],
  _xLabel: string,
  _yLabel: string,
  title: string,
  color: string = '#8b5cf6',
): Promise<string> {
  return generateChartImage({ type: 'scatter', data: { points }, title, color });
}

export async function generateBarChart(
  data: { label: string; value: number }[],
  title: string,
  color: string = '#f59e0b',
  horizontal: boolean = false,
): Promise<string> {
  return generateChartImage({ type: 'bar', data, title, color, options: { horizontal } });
}
