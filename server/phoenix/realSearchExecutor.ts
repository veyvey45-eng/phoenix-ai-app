/**
 * Real Search Executor Module
 * Exécute les recherches web réelles via Serper API
 * Solution #3: Exécuter les recherches web réelles
 */

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  answerBox?: {
    answer: string;
    source: string;
  };
  knowledgeGraph?: {
    title: string;
    description: string;
    attributes?: Record<string, string>;
  };
  executedAt: Date;
}

/**
 * Exécute une recherche web réelle via Serper API
 */
export async function executeRealSearch(query: string): Promise<SearchResponse> {
  console.log(`[RealSearchExecutor] Executing search for: ${query}`);

  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    console.error('[RealSearchExecutor] SERPER_API_KEY not configured');
    throw new Error('Search API not configured');
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: 10, // Nombre de résultats
        autocorrect: true,
        page: 1
      })
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.statusText}`);
    }

    const data = await response.json();

    console.log(`[RealSearchExecutor] Found ${data.organic?.length || 0} results`);

    return {
      query,
      results: (data.organic || []).map((result: any, index: number) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet,
        position: index + 1
      })),
      answerBox: data.answerBox ? {
        answer: data.answerBox.answer,
        source: data.answerBox.source
      } : undefined,
      knowledgeGraph: data.knowledgeGraph ? {
        title: data.knowledgeGraph.title,
        description: data.knowledgeGraph.description,
        attributes: data.knowledgeGraph.attributes
      } : undefined,
      executedAt: new Date()
    };
  } catch (error) {
    console.error('[RealSearchExecutor] Search failed:', error);
    throw error;
  }
}

/**
 * Exécute plusieurs recherches en parallèle
 */
export async function executeMultipleSearches(queries: string[]): Promise<SearchResponse[]> {
  console.log(`[RealSearchExecutor] Executing ${queries.length} searches`);

  try {
    const results = await Promise.all(
      queries.map(query => executeRealSearch(query))
    );

    console.log(`[RealSearchExecutor] All searches completed`);
    return results;
  } catch (error) {
    console.error('[RealSearchExecutor] Multiple searches failed:', error);
    throw error;
  }
}

/**
 * Formate les résultats de recherche pour l'affichage
 */
export function formatSearchResults(response: SearchResponse): string {
  let formatted = `# Résultats de Recherche: "${response.query}"\n\n`;

  // Answer Box
  if (response.answerBox) {
    formatted += `## Réponse Directe\n${response.answerBox.answer}\n*Source: ${response.answerBox.source}*\n\n`;
  }

  // Knowledge Graph
  if (response.knowledgeGraph) {
    formatted += `## Information\n**${response.knowledgeGraph.title}**\n${response.knowledgeGraph.description}\n\n`;
  }

  // Résultats organiques
  if (response.results.length > 0) {
    formatted += `## Résultats (${response.results.length})\n\n`;

    response.results.forEach(result => {
      formatted += `### ${result.position}. [${result.title}](${result.link})\n`;
      formatted += `${result.snippet}\n\n`;
    });
  } else {
    formatted += 'Aucun résultat trouvé.\n';
  }

  formatted += `\n*Recherche exécutée le ${response.executedAt.toLocaleString('fr-FR')}*`;

  return formatted;
}

/**
 * Extrait les informations clés des résultats
 */
export function extractKeyInformation(response: SearchResponse): string[] {
  const keyInfo: string[] = [];

  // Answer Box
  if (response.answerBox) {
    keyInfo.push(`Réponse: ${response.answerBox.answer}`);
  }

  // Knowledge Graph
  if (response.knowledgeGraph) {
    keyInfo.push(`${response.knowledgeGraph.title}: ${response.knowledgeGraph.description}`);
  }

  // Top 3 résultats
  response.results.slice(0, 3).forEach(result => {
    keyInfo.push(`${result.title}: ${result.snippet}`);
  });

  return keyInfo;
}

/**
 * Crée une requête de recherche optimisée
 */
export function optimizeSearchQuery(originalQuery: string): string {
  // Nettoyer et optimiser la requête
  let optimized = originalQuery
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // Normaliser les espaces
    .replace(/[^\w\s-]/g, ''); // Supprimer les caractères spéciaux

  // Ajouter des opérateurs de recherche si nécessaire
  if (!optimized.includes('site:') && !optimized.includes('filetype:')) {
    // Requête générale
  }

  return optimized;
}

/**
 * Exécute une recherche avec contexte de projet
 */
export async function searchWithProjectContext(
  query: string,
  projectContext: string
): Promise<SearchResponse> {
  console.log(`[RealSearchExecutor] Searching with project context`);

  // Enrichir la requête avec le contexte du projet
  const enrichedQuery = `${query} ${extractKeywordsFromContext(projectContext)}`;

  return executeRealSearch(enrichedQuery);
}

/**
 * Extrait les mots-clés du contexte du projet
 */
function extractKeywordsFromContext(context: string): string {
  const keywords: string[] = [];

  // Extraire les technologies
  if (/typescript|react|node|express|trpc/i.test(context)) {
    keywords.push('TypeScript React');
  }

  if (/python|django|flask/i.test(context)) {
    keywords.push('Python');
  }

  if (/database|sql|mysql|postgres/i.test(context)) {
    keywords.push('Database');
  }

  return keywords.join(' ');
}

/**
 * Crée un résumé des résultats de recherche
 */
export function summarizeSearchResults(response: SearchResponse): string {
  let summary = `Résumé de la recherche pour "${response.query}":\n\n`;

  if (response.answerBox) {
    summary += `**Réponse directe:** ${response.answerBox.answer}\n\n`;
  }

  if (response.results.length > 0) {
    summary += `**Top 3 résultats:**\n`;
    response.results.slice(0, 3).forEach(result => {
      summary += `- ${result.title}: ${result.snippet}\n`;
    });
  }

  return summary;
}

/**
 * Valide une requête de recherche
 */
export function validateSearchQuery(query: string): { valid: boolean; error?: string } {
  if (!query || query.trim().length === 0) {
    return { valid: false, error: 'La requête ne peut pas être vide' };
  }

  if (query.length > 2048) {
    return { valid: false, error: 'La requête est trop longue' };
  }

  // Vérifier les caractères interdits
  const forbiddenChars = /[<>{}|\\^`]/;
  if (forbiddenChars.test(query)) {
    return { valid: false, error: 'La requête contient des caractères interdits' };
  }

  return { valid: true };
}
