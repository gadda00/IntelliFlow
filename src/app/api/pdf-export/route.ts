import { NextRequest, NextResponse } from 'next/server';

// Simple HTML-to-PDF endpoint that returns a printable HTML document
// (relies on the browser's "Save as PDF" feature for actual PDF generation,
// avoiding heavy server-side PDF libraries).

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { analysisId, executiveSummary, keyFindings, recommendations, methodology, fullReport, metadata } = body;

    if (!executiveSummary && !fullReport) {
      return NextResponse.json({ error: 'executiveSummary or fullReport is required' }, { status: 400 });
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Busara Analysis Report — ${analysisId ?? 'Report'}</title>
  <style>
    @page { size: A4; margin: 2cm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    .cover {
      text-align: center;
      padding: 4rem 0 3rem;
      border-bottom: 2px solid #10b981;
      margin-bottom: 3rem;
    }
    .cover h1 { font-size: 2.5rem; margin: 0 0 0.5rem; color: #0a0f0d; }
    .cover .subtitle { color: #666; font-size: 1.1rem; }
    .cover .meta { margin-top: 2rem; color: #888; font-size: 0.9rem; }
    h2 {
      color: #0a0f0d;
      border-bottom: 1px solid #ddd;
      padding-bottom: 0.5rem;
      margin-top: 2.5rem;
    }
    h3 { color: #334; margin-top: 1.5rem; }
    .finding, .rec {
      padding: 1rem;
      margin: 1rem 0;
      border-left: 3px solid #10b981;
      background: #f8fdfb;
      border-radius: 0 4px 4px 0;
    }
    .rec.priority-high { border-left-color: #ef4444; background: #fef8f8; }
    .rec.priority-medium { border-left-color: #f59e0b; background: #fefcf5; }
    .priority-badge {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: white;
      margin-left: 0.5rem;
    }
    .priority-high .priority-badge { background: #ef4444; }
    .priority-medium .priority-badge { background: #f59e0b; }
    .priority-low .priority-badge { background: #64748b; }
    .confidence { color: #888; font-size: 0.85rem; margin-top: 0.25rem; }
    .footer {
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #888;
      font-size: 0.85rem;
    }
    .footer strong { color: #10b981; }
    .ai-badge {
      display: inline-block;
      background: linear-gradient(135deg, #10b981, #a855f7);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-left: 0.5rem;
    }
    @media print {
      body { padding: 0; max-width: none; }
      .cover { page-break-after: always; }
      h2 { page-break-after: avoid; }
      .finding, .rec { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <h1>Busara Analysis Report</h1>
    <div class="subtitle">Twenty-three agents. One wisdom.</div>
    <div class="meta">
      ${analysisId ? `<div>Analysis ID: <code>${analysisId}</code></div>` : ''}
      <div>Generated: ${new Date().toLocaleString()}</div>
      ${metadata?.rowCount ? `<div>Dataset: ${metadata.rowCount.toLocaleString()} rows × ${metadata.columnCount || '?'} columns</div>` : ''}
      ${metadata?.qualityScore ? `<div>Quality score: ${metadata.qualityScore}/100</div>` : ''}
      ${metadata?.aiPowered ? '<span class="ai-badge">AI-Powered by GLM-4.6</span>' : ''}
    </div>
  </div>

  ${executiveSummary ? `<h2>Executive Summary</h2>\n<div>${escapeHtml(executiveSummary).replace(/\n/g, '<br>')}</div>` : ''}

  ${keyFindings && keyFindings.length > 0 ? `<h2>Key Findings</h2>\n${keyFindings.map((f: any, i: number) => `<div class="finding"><strong>${i + 1}. ${escapeHtml(f.title)}</strong><br>${escapeHtml(f.description)}<div class="confidence">Confidence: ${(f.confidence * 100).toFixed(0)}%</div></div>`).join('')}` : ''}

  ${recommendations && recommendations.length > 0 ? `<h2>Recommendations</h2>\n${recommendations.map((r: any, i: number) => `<div class="rec priority-${r.priority}"><strong>${i + 1}. ${escapeHtml(r.title)}</strong><span class="priority-badge">${r.priority}</span><br>${escapeHtml(r.description)}</div>`).join('')}` : ''}

  ${methodology ? `<h2>Methodology</h2>\n<div>${escapeHtml(methodology).replace(/\n/g, '<br>')}</div>` : ''}

  ${fullReport ? `<h2>Full Report</h2>\n<div>${markdownToHtml(fullReport)}</div>` : ''}

  <div class="footer">
    <div><strong>Busara</strong> — 20+ AI Agent Data Intelligence Platform</div>
    <div>Built in Nairobi. Powered by 20 specialized AI agents.</div>
    <div>Generated: ${new Date().toISOString()}</div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="busara-report-${analysisId ?? Date.now()}.html"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownToHtml(md: string): string {
  // Minimal markdown-to-HTML conversion (headers, bold, italic, lists, code)
  let html = escapeHtml(md);
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.+<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/\n\n/g, '</p><p>');
  return '<p>' + html + '</p>';
}
