import { NextRequest, NextResponse } from 'next/server';
import {
  generateHistogramChart, generateLineChart, generateForecastChart,
  generateCorrelationHeatmap, generateScatterChart, generateBarChart,
} from '@/lib/charts/generator';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      analysisId, executiveSummary, keyFindings, recommendations,
      methodology, fullReport, metadata,
      // Raw data for chart generation
      charts,
    } = body;

    if (!executiveSummary && !fullReport) {
      return NextResponse.json({ error: 'executiveSummary or fullReport is required' }, { status: 400 });
    }

    // Generate real chart images server-side
    const chartImages: { title: string; dataUrl: string; description: string }[] = [];

    if (charts && Array.isArray(charts)) {
      for (const chart of charts.slice(0, 6)) {
        try {
          let dataUrl: string;
          switch (chart.type) {
            case 'histogram':
              dataUrl = await generateHistogramChart(chart.values, chart.title, chart.color);
              break;
            case 'line':
              dataUrl = await generateLineChart(chart.data, chart.title, chart.color);
              break;
            case 'forecast':
              dataUrl = await generateForecastChart(chart.historical, chart.forecast, chart.title);
              break;
            case 'correlation':
              dataUrl = await generateCorrelationHeatmap(chart.matrix, chart.variables, chart.title);
              break;
            case 'scatter':
              dataUrl = await generateScatterChart(chart.points, chart.xLabel, chart.yLabel, chart.title, chart.color);
              break;
            case 'bar':
              dataUrl = await generateBarChart(chart.data, chart.title, chart.color, chart.horizontal);
              break;
            default:
              continue;
          }
          chartImages.push({ title: chart.title, dataUrl, description: chart.description || '' });
        } catch (err) {
          console.error(`[PDF Export] Chart generation failed for ${chart.title}:`, err);
        }
      }
    }

    const html = generateReportHTML({
      analysisId,
      executiveSummary,
      keyFindings: keyFindings || [],
      recommendations: recommendations || [],
      methodology,
      fullReport,
      metadata: metadata || {},
      chartImages,
    });

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="busara-report-${analysisId ?? Date.now()}.html"`,
      },
    });
  } catch (err: any) {
    console.error('[PDF Export] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function generateReportHTML(opts: {
  analysisId: string;
  executiveSummary: string;
  keyFindings: any[];
  recommendations: any[];
  methodology?: string;
  fullReport?: string;
  metadata: any;
  chartImages: { title: string; dataUrl: string; description: string }[];
}): string {
  const { analysisId, executiveSummary, keyFindings, recommendations, methodology, fullReport, metadata, chartImages } = opts;

  const chartsHTML = chartImages.length > 0
    ? `<div class="section">
        <h2>📊 Visualizations</h2>
        ${chartImages.map(c => `
          <div class="chart-container">
            <h3>${escapeHtml(c.title)}</h3>
            <img src="${c.dataUrl}" alt="${escapeHtml(c.title)}" class="chart-img" />
            ${c.description ? `<p class="chart-desc">${escapeHtml(c.description)}</p>` : ''}
          </div>
        `).join('')}
      </div>`
    : '';

  const findingsHTML = keyFindings.length > 0
    ? `<div class="section">
        <h2>🔍 Key Findings</h2>
        ${keyFindings.map((f: any, i: number) => `
          <div class="finding ${f.impact === 'high' ? 'high-impact' : f.impact === 'medium' ? 'medium-impact' : 'low-impact'}">
            <div class="finding-header">
              <span class="finding-number">${i + 1}</span>
              <span class="finding-title">${escapeHtml(f.title)}</span>
              ${f.impact ? `<span class="impact-badge impact-${f.impact}">${f.impact.toUpperCase()}</span>` : ''}
            </div>
            <p>${escapeHtml(f.description)}</p>
            ${f.confidence ? `<div class="confidence">Confidence: ${(f.confidence * 100).toFixed(0)}%</div>` : ''}
          </div>
        `).join('')}
      </div>`
    : '';

  const recommendationsHTML = recommendations.length > 0
    ? `<div class="section">
        <h2>💡 Recommendations</h2>
        ${recommendations.map((r: any, i: number) => `
          <div class="recommendation priority-${r.priority || 'medium'}">
            <div class="rec-header">
              <span class="rec-number">${i + 1}</span>
              <span class="rec-title">${escapeHtml(r.title)}</span>
              ${r.priority ? `<span class="priority-badge priority-${r.priority}">${r.priority.toUpperCase()}</span>` : ''}
            </div>
            <p>${escapeHtml(r.description)}</p>
            ${r.expectedImpact ? `<div class="expected-impact">Expected impact: ${escapeHtml(r.expectedImpact)}</div>` : ''}
          </div>
        `).join('')}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Busara Analysis Report — ${analysisId || 'Report'}</title>
  <style>
    @page { size: A4; margin: 1.5cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background: #fff;
    }
    .cover {
      background: linear-gradient(135deg, #0a0f0d 0%, #0f1a17 100%);
      color: #e8f0ed;
      padding: 3rem 2rem;
      margin-bottom: 2rem;
      border-radius: 12px;
      page-break-after: always;
    }
    .cover h1 { font-size: 2.2rem; margin-bottom: 0.5rem; }
    .cover .tagline { color: #10b981; font-size: 1.1rem; margin-bottom: 2rem; }
    .cover .meta { color: #64748b; font-size: 0.85rem; line-height: 1.8; }
    .cover .meta strong { color: #94a3b8; }
    .cover .ai-badge {
      display: inline-block;
      background: linear-gradient(135deg, #10b981, #a855f7);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-top: 1rem;
    }
    .section {
      margin-bottom: 2rem;
      page-break-inside: avoid;
    }
    .section h2 {
      color: #0f1a17;
      font-size: 1.3rem;
      border-bottom: 2px solid #10b981;
      padding-bottom: 0.5rem;
      margin-bottom: 1rem;
    }
    .finding, .recommendation {
      padding: 1rem;
      margin-bottom: 0.75rem;
      border-left: 3px solid #10b981;
      background: #f8fdfb;
      border-radius: 0 6px 6px 0;
      page-break-inside: avoid;
    }
    .finding.high-impact, .recommendation.priority-high {
      border-left-color: #ef4444;
      background: #fef8f8;
    }
    .finding.medium-impact, .recommendation.priority-medium {
      border-left-color: #f59e0b;
      background: #fefcf5;
    }
    .finding-header, .rec-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .finding-number, .rec-number {
      background: #10b981;
      color: white;
      width: 22px; height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: bold;
    }
    .finding-title, .rec-title { font-weight: 600; flex: 1; }
    .impact-badge, .priority-badge {
      font-size: 0.65rem;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      color: white;
      font-weight: 600;
    }
    .impact-high, .priority-high { background: #ef4444; }
    .impact-medium, .priority-medium { background: #f59e0b; }
    .impact-low, .priority-low { background: #64748b; }
    .confidence, .expected-impact {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 0.25rem;
    }
    .chart-container {
      margin-bottom: 1.5rem;
      page-break-inside: avoid;
      text-align: center;
    }
    .chart-container h3 {
      font-size: 1rem;
      color: #334155;
      margin-bottom: 0.5rem;
    }
    .chart-img {
      max-width: 100%;
      height: auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .chart-desc {
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 0.5rem;
    }
    .footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      color: #64748b;
      font-size: 0.8rem;
    }
    .footer strong { color: #10b981; }
    @media print {
      .cover { page-break-after: always; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <h1>Busara Analysis Report</h1>
    <div class="tagline">Twenty-three agents. One wisdom.</div>
    <div class="meta">
      ${analysisId ? `<div><strong>Analysis ID:</strong> <code>${escapeHtml(analysisId)}</code></div>` : ''}
      <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
      ${metadata.rowCount ? `<div><strong>Dataset:</strong> ${metadata.rowCount.toLocaleString()} rows × ${metadata.columnCount || '?'} columns</div>` : ''}
      ${metadata.qualityScore ? `<div><strong>Quality Score:</strong> ${metadata.qualityScore}/100</div>` : ''}
      ${metadata.domain ? `<div><strong>Domain:</strong> ${escapeHtml(metadata.domain)}</div>` : ''}
      ${metadata.aiPowered ? '<div class="ai-badge">AI-Powered by GLM-4.6</div>' : ''}
    </div>
  </div>

  ${executiveSummary ? `<div class="section"><h2>📋 Executive Summary</h2><p>${escapeHtml(executiveSummary).replace(/\n/g, '<br>')}</p></div>` : ''}

  ${chartsHTML}

  ${findingsHTML}

  ${recommendationsHTML}

  ${methodology ? `<div class="section"><h2>🔬 Methodology</h2><p>${escapeHtml(methodology).replace(/\n/g, '<br>')}</p></div>` : ''}

  <div class="footer">
    <div><strong>Busara</strong> — 23-Agent Data Intelligence Platform</div>
    <div>Built in Nairobi. Wisdom for the world.</div>
    <div>Generated: ${new Date().toISOString()}</div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
