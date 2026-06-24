// AI Narrative Generator — uses z-ai-web-dev-sdk to produce LLM-powered insights
// This is a separate "enhancement" agent that runs after the rule-based agents.
// If the SDK is unavailable, it gracefully falls back to a templated summary.

import 'server-only';
import ZAI from 'z-ai-web-dev-sdk';

let _zai: any = null;

async function getZAI() {
  if (_zai) return _zai;
  try {
    _zai = await ZAI.create();
    return _zai;
  } catch (err) {
    console.warn('[AI Narrative] z-ai-web-dev-sdk not available, will use fallback');
    return null;
  }
}

export interface NarrativeRequest {
  datasetSummary: {
    rowCount: number;
    columnCount: number;
    columnTypes: Record<string, string>;
    qualityScore: number;
    detectedDomain: string;
  };
  keyFindings: { title: string; description: string; confidence: number }[];
  anomalies: { total: number; topAnomalies: any[] };
  forecast: { method: string; accuracy: number; trend: string; periods: number } | null;
  causalRelationships: { cause: string; effect: string; strength: string; correlation: number }[];
  recommendations: { title: string; description: string; priority: string }[];
}

export interface NarrativeResponse {
  executiveSummary: string;
  keyInsights: string[];
  strategicRecommendations: string[];
  methodology: string;
  conclusion: string;
  fullReport: string;
  aiPowered: boolean;
  model: string;
}

export async function generateAINarrative(req: NarrativeRequest): Promise<NarrativeResponse> {
  const zai = await getZAI();
  const prompt = buildPrompt(req);

  if (!zai) {
    return fallbackNarrative(req);
  }

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are Akili, an expert data analyst AI. You produce clear, actionable, business-friendly narratives from data analysis results. Be specific, quantitative, and insightful. Avoid generic statements. Use markdown formatting with headers (##) and bullet points where helpful. Keep the tone professional but accessible to non-technical business stakeholders. Always ground your insights in the provided data — do not invent numbers.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      thinking: { type: 'disabled' },
      temperature: 0.4,
      max_tokens: 2000,
    });

    const content = completion.choices?.[0]?.message?.content ?? '';

    if (!content || content.length < 100) {
      return fallbackNarrative(req);
    }

    const sections = parseMarkdownSections(content);

    return {
      executiveSummary: sections['Executive Summary'] ?? sections['executive summary'] ?? content.split('\n\n')[0],
      keyInsights: extractBulletPoints(sections['Key Insights'] ?? sections['key insights'] ?? ''),
      strategicRecommendations: extractBulletPoints(sections['Recommendations'] ?? sections['Strategic Recommendations'] ?? ''),
      methodology: sections['Methodology'] ?? sections['methodology'] ?? 'Multi-agent DAG pipeline with 20 specialized agents.',
      conclusion: sections['Conclusion'] ?? sections['conclusion'] ?? content.split('\n\n').pop() ?? '',
      fullReport: content,
      aiPowered: true,
      model: 'GLM-4.6',
    };
  } catch (err: any) {
    console.warn('[AI Narrative] LLM call failed, using fallback:', err.message);
    return fallbackNarrative(req);
  }
}

function buildPrompt(req: NarrativeRequest): string {
  const findings = req.keyFindings.map(f => `- ${f.title}: ${f.description} (confidence: ${(f.confidence * 100).toFixed(0)}%)`).join('\n');
  const causal = req.causalRelationships.map(r => `- ${r.cause} → ${r.effect}: ${r.strength} (r=${r.correlation})`).join('\n');
  const recs = req.recommendations.map(r => `- [${r.priority}] ${r.title}: ${r.description}`).join('\n');
  const topAnoms = req.anomalies.topAnomalies.map(a => `- ${a.column} row ${a.rowIndex}: value ${a.value} (${a.severity})`).join('\n');

  return `You are analyzing the results of a 20+ AI agent data analysis pipeline. Generate a comprehensive narrative report in markdown format.

## Dataset Profile
- ${req.datasetSummary.rowCount.toLocaleString()} rows × ${req.datasetSummary.columnCount} columns
- Quality score: ${req.datasetSummary.qualityScore}/100
- Detected domain: ${req.datasetSummary.detectedDomain}
- Column types: ${Object.entries(req.datasetSummary.columnTypes).map(([k, v]) => `${k} (${v})`).join(', ')}

## Key Findings
${findings || 'No significant findings.'}

## Anomalies Detected
${req.anomalies.total > 0 ? `${req.anomalies.total} anomalies. Top examples:\n${topAnoms}` : 'No anomalies detected.'}

## Forecast
${req.forecast ? `Method: ${req.forecast.method}, accuracy: ${req.forecast.accuracy}%, trend: ${req.forecast.trend}, periods: ${req.forecast.periods}` : 'No forecast available.'}

## Causal Relationships
${causal || 'No significant causal relationships found.'}

## Recommendations from the system
${recs || 'No specific recommendations.'}

---

Please write a comprehensive narrative report with these exact markdown sections:

## Executive Summary
A 3-4 paragraph executive summary that a C-suite executive would find valuable. Lead with the most important finding. Quantify everything possible.

## Key Insights
5-7 bullet points, each a single insight that a business stakeholder would care about. Be specific — avoid "the data shows..." filler.

## Strategic Recommendations
3-5 actionable recommendations ordered by priority. Each should have a clear rationale tied to the data.

## Methodology
One paragraph explaining how the analysis was performed (the 20+ AI agent DAG pipeline).

## Conclusion
A single paragraph that ties everything together and suggests next steps.

Keep it factual, specific, and grounded in the data above. Do not invent metrics.`;
}

function parseMarkdownSections(md: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = md.split(/^##\s+/m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const newlineIdx = part.indexOf('\n');
    if (newlineIdx === -1) continue;
    const heading = part.slice(0, newlineIdx).trim();
    const body = part.slice(newlineIdx + 1).trim();
    sections[heading] = body;
  }
  return sections;
}

function extractBulletPoints(text: string): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('- ') || l.startsWith('* ') || l.startsWith('• '))
    .map(l => l.replace(/^[-*•]\s+/, ''));
}

function fallbackNarrative(req: NarrativeRequest): NarrativeResponse {
  const findings = req.keyFindings.slice(0, 5).map(f => `- ${f.title}: ${f.description}`);
  const recs = req.recommendations.slice(0, 4).map(r => `- [${r.priority}] ${r.title}: ${r.description}`);

  const executiveSummary = `This analysis examined a dataset of ${req.datasetSummary.rowCount.toLocaleString()} records across ${req.datasetSummary.columnCount} columns in the ${req.datasetSummary.detectedDomain} domain. The data quality score was ${req.datasetSummary.qualityScore}/100. The 20+ AI agent pipeline identified ${req.keyFindings.length} findings${req.anomalies.total > 0 ? `, ${req.anomalies.total} anomalies` : ''}${req.forecast ? `, and forecasted a ${req.forecast.trend} trend with ${req.forecast.accuracy}% accuracy` : ''}.`;

  return {
    executiveSummary,
    keyInsights: findings,
    strategicRecommendations: recs,
    methodology: 'The Akili v3.1 pipeline employs a 6-stage Directed Acyclic Graph (DAG) where 20 specialized agents run in topological order with parallelism within each stage.',
    conclusion: 'This analysis provides actionable intelligence for data-driven decision making. Review the key findings and implement the recommended actions in priority order.',
    fullReport: `## Executive Summary\n\n${executiveSummary}\n\n## Key Insights\n\n${findings.join('\n')}\n\n## Strategic Recommendations\n\n${recs.join('\n')}\n\n## Conclusion\n\nReview the findings and implement recommended actions.`,
    aiPowered: false,
    model: 'fallback-template',
  };
}
