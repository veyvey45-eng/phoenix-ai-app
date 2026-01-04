/**
 * Project Recommender Module
 * Génère des recommandations spécifiques basées sur l'analyse réelle du projet
 * Solution #4: Générer des recommandations spécifiques au projet
 */

import { invokeLLM } from '../_core/llm';
import { ProjectStructure } from './projectAnalyzer';
import { ShadowCodeContext } from './shadowCodeDetector';

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  effort: 'small' | 'medium' | 'large';
  steps: string[];
  resources?: string[];
}

export interface ProjectRecommendations {
  projectName: string;
  timestamp: Date;
  summary: string;
  recommendations: Recommendation[];
  nextSteps: string[];
}

/**
 * Génère des recommandations basées sur l'analyse du projet
 */
export async function generateProjectRecommendations(
  projectStructure: ProjectStructure,
  shadowCodeContext?: ShadowCodeContext
): Promise<ProjectRecommendations> {
  console.log('[ProjectRecommender] Generating project-specific recommendations');

  try {
    // Analyser la structure du projet
    const analysis = analyzeProjectStructure(projectStructure);

    // Créer un prompt contextuel
    const prompt = createContextualPrompt(analysis, shadowCodeContext);

    // Invoquer l'LLM pour générer des recommandations
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en architecture logicielle et en bonnes pratiques de développement.
Tu dois générer des recommandations SPÉCIFIQUES et ACTIONNABLES basées sur l'analyse réelle du projet.
Chaque recommandation doit avoir:
- Une priorité (critical, high, medium, low)
- Un titre clair
- Une description détaillée
- L'impact attendu
- L'effort requis (small, medium, large)
- Les étapes concrètes pour l'implémenter

Réponds en JSON valide.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'project_recommendations',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              summary: { type: 'string', description: 'Résumé de l\'analyse' },
              recommendations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    impact: { type: 'string' },
                    effort: { type: 'string', enum: ['small', 'medium', 'large'] },
                    steps: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['priority', 'title', 'description', 'impact', 'effort', 'steps']
                }
              },
              nextSteps: { type: 'array', items: { type: 'string' } }
            },
            required: ['summary', 'recommendations', 'nextSteps']
          }
        }
      }
    });

    // Parser la réponse
    const content = llmResponse.choices[0].message.content;
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const parsed = JSON.parse(contentStr);

    return {
      projectName: projectStructure.rootPath.split('/').pop() || 'Unknown',
      timestamp: new Date(),
      summary: parsed.summary,
      recommendations: parsed.recommendations.map((r: any) => ({
        priority: r.priority,
        title: r.title,
        description: r.description,
        impact: r.impact,
        effort: r.effort,
        steps: r.steps
      })),
      nextSteps: parsed.nextSteps
    };
  } catch (error) {
    console.error('[ProjectRecommender] Error generating recommendations:', error);
    throw error;
  }
}

/**
 * Analyse la structure du projet
 */
function analyzeProjectStructure(projectStructure: ProjectStructure): ProjectAnalysis {
  const files = projectStructure.files;

  // Détecter les technologies
  const technologies = detectTechnologies(files);

  // Détecter les patterns
  const patterns = detectPatterns(files);

  // Évaluer la qualité
  const quality = evaluateCodeQuality(files);

  // Identifier les problèmes
  const issues = identifyIssues(files, technologies);

  return {
    technologies,
    patterns,
    quality,
    issues,
    fileCount: files.filter(f => f.type === 'file').length,
    directoryCount: files.filter(f => f.type === 'directory').length
  };
}

interface ProjectAnalysis {
  technologies: string[];
  patterns: string[];
  quality: {
    hasTests: boolean;
    hasDocumentation: boolean;
    hasLinting: boolean;
    hasBuild: boolean;
  };
  issues: string[];
  fileCount: number;
  directoryCount: number;
}

/**
 * Détecte les technologies utilisées
 */
function detectTechnologies(files: any[]): string[] {
  const technologies: Set<string> = new Set();

  files.forEach(file => {
    if (file.name === 'package.json') technologies.add('Node.js');
    if (file.name === 'tsconfig.json') technologies.add('TypeScript');
    if (file.name === 'requirements.txt') technologies.add('Python');
    if (file.name === 'Dockerfile') technologies.add('Docker');
    if (file.name === 'docker-compose.yml') technologies.add('Docker Compose');
    if (file.name === 'drizzle.config.ts') technologies.add('Drizzle ORM');
    if (file.path?.includes('client') && file.name?.endsWith('.tsx')) technologies.add('React');
    if (file.path?.includes('server') && file.name?.endsWith('.ts')) technologies.add('Express/tRPC');
  });

  return Array.from(technologies);
}

/**
 * Détecte les patterns utilisés
 */
function detectPatterns(files: any[]): string[] {
  const patterns: Set<string> = new Set();

  files.forEach(file => {
    if (file.name?.includes('test')) patterns.add('Testing');
    if (file.name?.includes('spec')) patterns.add('Specification');
    if (file.name?.includes('component')) patterns.add('Component Architecture');
    if (file.name?.includes('hook')) patterns.add('React Hooks');
    if (file.name?.includes('middleware')) patterns.add('Middleware Pattern');
    if (file.name?.includes('router')) patterns.add('Router Pattern');
    if (file.name?.includes('schema')) patterns.add('Schema Validation');
    if (file.name?.includes('config')) patterns.add('Configuration Management');
  });

  return Array.from(patterns);
}

/**
 * Évalue la qualité du code
 */
function evaluateCodeQuality(files: any[]): ProjectAnalysis['quality'] {
  const fileNames = files.map(f => f.name.toLowerCase());

  return {
    hasTests: fileNames.some(f => f.includes('test') || f.includes('spec')),
    hasDocumentation: fileNames.some(f => f.includes('readme') || f.includes('doc')),
    hasLinting: fileNames.some(f => f.includes('eslint') || f.includes('prettier')),
    hasBuild: fileNames.some(f => f.includes('build') || f.includes('webpack') || f.includes('vite'))
  };
}

/**
 * Identifie les problèmes potentiels
 */
function identifyIssues(files: any[], technologies: string[]): string[] {
  const issues: string[] = [];

  const fileNames = files.map(f => f.name.toLowerCase());

  // Vérifier les tests
  if (!fileNames.some(f => f.includes('test') || f.includes('spec'))) {
    issues.push('Pas de tests détectés');
  }

  // Vérifier la documentation
  if (!fileNames.some(f => f.includes('readme'))) {
    issues.push('Pas de README détecté');
  }

  // Vérifier la configuration
  if (technologies.includes('Node.js') && !fileNames.includes('package.json')) {
    issues.push('package.json manquant');
  }

  // Vérifier les fichiers de configuration
  if (!fileNames.some(f => f.includes('env') || f.includes('config'))) {
    issues.push('Pas de configuration d\'environnement');
  }

  // Vérifier les dépendances
  if (technologies.includes('TypeScript') && !fileNames.includes('tsconfig.json')) {
    issues.push('tsconfig.json manquant');
  }

  return issues;
}

/**
 * Crée un prompt contextuel pour l'LLM
 */
function createContextualPrompt(analysis: ProjectAnalysis, shadowCodeContext?: ShadowCodeContext): string {
  let prompt = `
# Analyse du Projet

## Technologies Détectées
${analysis.technologies.join(', ')}

## Patterns Utilisés
${analysis.patterns.join(', ')}

## Qualité du Code
- Tests: ${analysis.quality.hasTests ? '✓ Présents' : '✗ Absents'}
- Documentation: ${analysis.quality.hasDocumentation ? '✓ Présente' : '✗ Absente'}
- Linting: ${analysis.quality.hasLinting ? '✓ Configuré' : '✗ Non configuré'}
- Build: ${analysis.quality.hasBuild ? '✓ Configuré' : '✗ Non configuré'}

## Problèmes Identifiés
${analysis.issues.length > 0 ? analysis.issues.map(i => `- ${i}`).join('\n') : 'Aucun problème détecté'}

## Statistiques
- Fichiers: ${analysis.fileCount}
- Répertoires: ${analysis.directoryCount}
`;

  if (shadowCodeContext) {
    prompt += `

## Contexte du "Code Ombre"
- Type: ${shadowCodeContext.type}
- Description: ${shadowCodeContext.description}
- Préoccupations: ${shadowCodeContext.concerns.join(', ')}
`;
  }

  prompt += `

## Demande
Basé sur cette analyse, génère 3-5 recommandations SPÉCIFIQUES et ACTIONNABLES pour améliorer ce projet.
Chaque recommandation doit être concrète et applicable immédiatement.
`;

  return prompt;
}

/**
 * Formate les recommandations pour l'affichage
 */
export function formatRecommendations(recommendations: ProjectRecommendations): string {
  let formatted = `# Recommandations pour ${recommendations.projectName}\n\n`;

  formatted += `## Résumé\n${recommendations.summary}\n\n`;

  // Trier par priorité
  const sorted = recommendations.recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  formatted += `## Recommandations (${sorted.length})\n\n`;

  sorted.forEach((rec, index) => {
    formatted += `### ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}\n`;
    formatted += `**Description:** ${rec.description}\n`;
    formatted += `**Impact:** ${rec.impact}\n`;
    formatted += `**Effort:** ${rec.effort}\n`;
    formatted += `**Étapes:**\n`;
    rec.steps.forEach((step, i) => {
      formatted += `${i + 1}. ${step}\n`;
    });
    formatted += '\n';
  });

  formatted += `## Prochaines Étapes\n`;
  recommendations.nextSteps.forEach((step, i) => {
    formatted += `${i + 1}. ${step}\n`;
  });

  formatted += `\n*Généré le ${recommendations.timestamp.toLocaleString('fr-FR')}*`;

  return formatted;
}
