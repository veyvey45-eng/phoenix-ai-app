/**
 * Deep Research Module for Phoenix AI
 */

import { invokeLLM } from '../_core/llm';
import { serperApi } from './serperApi';

// Type local pour SearchResult
interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position?: number;
  date?: string;
  source?: string;
}

export interface ResearchReport {
  topic: string;
  summary: string;
  sections: ReportSection[];
  sources: Source[];
  keyFindings: string[];
  methodology: string;
  limitations: string[];
  generatedAt: Date;
  researchDepth: 'quick' | 'standard' | 'deep';
  totalSourcesAnalyzed: number;
}

export interface ReportSection {
  title: string;
  content: string;
  sources: number[];
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
  relevanceScore: number;
  accessedAt: Date;
}

export interface ResearchConfig {
  topic: string;
  depth: 'quick' | 'standard' | 'deep';
  language?: string;
  focusAreas?: string[];
  excludeDomains?: string[];
}

export function shouldTriggerDeepResearch(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  const triggers = [
    'recherche approfondie', 'deep research', 'analyse complète',
    'analyse détaillée', 'étude complète', 'rapport complet',
    'investigation', 'recherche exhaustive', 'analyse en profondeur',
    'étude approfondie', 'rapport détaillé', 'comprehensive research',
    'in-depth analysis', 'thorough research',
  ];
  return triggers.some(trigger => lowerMessage.includes(trigger));
}

export function determineResearchDepth(message: string): 'quick' | 'standard' | 'deep' {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('rapide') || lowerMessage.includes('quick') || lowerMessage.includes('bref')) {
    return 'quick';
  }
  if (lowerMessage.includes('exhaustive') || lowerMessage.includes('en profondeur')) {
    return 'deep';
  }
  return 'standard';
}

export async function conductDeepResearch(
  config: ResearchConfig,
  onProgress?: (progress: { stage: string; percent: number; message: string }) => void
): Promise<ResearchReport> {
  const { topic, depth, language = 'fr' } = config;
  console.log(`[DeepResearch] Starting ${depth} research on: ${topic}`);
  
  const searchCount = depth === 'quick' ? 3 : depth === 'standard' ? 6 : 10;
  onProgress?.({ stage: 'search', percent: 10, message: 'Génération des requêtes...' });
  
  const queries = await generateSearchQueries(topic, searchCount, language);
  onProgress?.({ stage: 'search', percent: 20, message: `Recherche (${queries.length} requêtes)...` });
  
  const allResults: SearchResult[] = [];
  for (let i = 0; i < queries.length; i++) {
    try {
      const results = await serperApi.search(queries[i]);
      allResults.push(...results.slice(0, 5));
      onProgress?.({ stage: 'search', percent: 20 + (i / queries.length) * 30, message: `Recherche ${i + 1}/${queries.length}` });
    } catch (error) {
      console.error(`[DeepResearch] Search error: ${queries[i]}`, error);
    }
  }
  
  onProgress?.({ stage: 'analysis', percent: 50, message: 'Analyse des sources...' });
  const sources = deduplicateAndRankSources(allResults);
  
  onProgress?.({ stage: 'synthesis', percent: 60, message: 'Synthèse...' });
  const sections = await generateReportSections(topic, sources, depth, language);
  
  onProgress?.({ stage: 'synthesis', percent: 80, message: 'Génération du rapport...' });
  const { summary, keyFindings } = await generateSummaryAndFindings(topic, sections, language);
  
  onProgress?.({ stage: 'complete', percent: 100, message: 'Terminé!' });
  
  return {
    topic, summary, sections, sources, keyFindings,
    methodology: `Recherche "${depth}" avec ${queries.length} requêtes, ${sources.length} sources.`,
    limitations: ['Sources publiques uniquement.', 'Informations peuvent évoluer.'],
    generatedAt: new Date(), researchDepth: depth, totalSourcesAnalyzed: sources.length,
  };
}

async function generateSearchQueries(topic: string, count: number, language: string): Promise<string[]> {
  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: `Génère ${count} requêtes de recherche variées. Format JSON: {"queries": [...]}` },
        { role: 'user', content: `Sujet: ${topic}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'search_queries', strict: true,
          schema: { type: 'object', properties: { queries: { type: 'array', items: { type: 'string' } } }, required: ['queries'], additionalProperties: false },
        },
      },
    });
    const content = response.choices[0]?.message?.content;
    const contentStr = typeof content === 'string' ? content : '';
    const parsed = JSON.parse(contentStr || '{"queries": []}');
    return parsed.queries.slice(0, count);
  } catch (error) {
    return [topic, `${topic} définition`, `${topic} actualités`].slice(0, count);
  }
}

function deduplicateAndRankSources(results: SearchResult[]): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const result of results) {
    if (!seen.has(result.link)) {
      seen.add(result.link);
      sources.push({ title: result.title, url: result.link, snippet: result.snippet, relevanceScore: 0.5, accessedAt: new Date() });
    }
  }
  return sources.slice(0, 20);
}

async function generateReportSections(topic: string, sources: Source[], depth: 'quick' | 'standard' | 'deep', language: string): Promise<ReportSection[]> {
  const sectionCount = depth === 'quick' ? 3 : depth === 'standard' ? 5 : 8;
  const sourceContext = sources.slice(0, 10).map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet}`).join('\n\n');
  
  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: `Génère ${sectionCount} sections. Format JSON.` },
        { role: 'user', content: `Sujet: ${topic}\n\nSources:\n${sourceContext}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'report_sections', strict: true,
          schema: {
            type: 'object',
            properties: {
              sections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { title: { type: 'string' }, content: { type: 'string' }, sourceIndices: { type: 'array', items: { type: 'number' } } },
                  required: ['title', 'content', 'sourceIndices'], additionalProperties: false,
                },
              },
            },
            required: ['sections'], additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices[0]?.message?.content;
    const contentStr = typeof content === 'string' ? content : '';
    const parsed = JSON.parse(contentStr || '{"sections": []}');
    return parsed.sections.map((s: { title: string; content: string; sourceIndices: number[] }) => ({ title: s.title, content: s.content, sources: s.sourceIndices.map((i: number) => i - 1) }));
  } catch (error) {
    return [{ title: 'Résumé', content: `Recherche sur "${topic}".`, sources: [0] }];
  }
}

async function generateSummaryAndFindings(topic: string, sections: ReportSection[], language: string): Promise<{ summary: string; keyFindings: string[] }> {
  const sectionContent = sections.map(s => `${s.title}: ${s.content}`).join('\n\n');
  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'Génère un résumé et points clés. Format JSON.' },
        { role: 'user', content: `Sujet: ${topic}\n\nContenu:\n${sectionContent}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'summary_findings', strict: true,
          schema: { type: 'object', properties: { summary: { type: 'string' }, keyFindings: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'keyFindings'], additionalProperties: false },
        },
      },
    });
    const content = response.choices[0]?.message?.content;
    const contentStr = typeof content === 'string' ? content : '';
    return JSON.parse(contentStr || '{"summary": "", "keyFindings": []}');
  } catch (error) {
    return { summary: `Recherche sur "${topic}".`, keyFindings: ['Voir sections.'] };
  }
}

export function formatReportAsMarkdown(report: ResearchReport): string {
  let md = `# ${report.topic}\n\n`;
  md += `*Généré le ${report.generatedAt.toLocaleDateString('fr-FR')}*\n\n`;
  md += `## Résumé\n\n${report.summary}\n\n`;
  md += `## Points Clés\n\n`;
  report.keyFindings.forEach((f, i) => { md += `${i + 1}. ${f}\n`; });
  report.sections.forEach(s => { md += `\n## ${s.title}\n\n${s.content}\n`; });
  md += `\n## Sources\n\n`;
  report.sources.forEach((s, i) => { md += `${i + 1}. [${s.title}](${s.url})\n`; });
  return md;
}

export async function quickResearch(query: string): Promise<{ summary: string; sources: { title: string; url: string; snippet: string }[] }> {
  try {
    const results = await serperApi.search(query);
    const topResults = results.slice(0, 5);
    const sourceContext = topResults.map(r => `- ${r.title}: ${r.snippet}`).join('\n');
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'Génère un résumé concis.' },
        { role: 'user', content: `Question: ${query}\n\nSources:\n${sourceContext}` },
      ],
    });
    const summary = typeof response.choices[0]?.message?.content === 'string' ? response.choices[0].message.content : 'Résumé non disponible.';
    return { summary, sources: topResults.map((r: SearchResult) => ({ title: r.title, url: r.link, snippet: r.snippet })) };
  } catch (error) {
    return { summary: 'Erreur lors de la recherche.', sources: [] };
  }
}
