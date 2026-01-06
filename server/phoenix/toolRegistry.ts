/**
 * Tool Registry - Système centralisé des outils pour l'Agent Phoenix
 * 
 * Ce module définit et gère tous les outils disponibles pour l'agent autonome,
 * similaire au système d'outils de Claude/Manus.
 */

import { e2bSandbox } from './e2bSandbox';
import { generateImage } from '../_core/imageGeneration';
import { contextEnricher as contextEnricherModule } from './contextEnricher';
import { invokeLLM } from '../_core/llm';
import { storagePut, storageGet } from '../storage';

// Types
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

export interface Tool {
  name: string;
  description: string;
  category: 'code' | 'web' | 'file' | 'image' | 'data' | 'system';
  parameters: ToolParameter[];
  execute: (args: Record<string, any>, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  userId: string;
  sessionId: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface ToolResult {
  success: boolean;
  output: any;
  error?: string;
  artifacts?: Array<{
    type: 'text' | 'image' | 'file' | 'code' | 'data';
    content: string;
    mimeType?: string;
    name?: string;
  }>;
  metadata?: Record<string, any>;
}

// Utiliser le singleton existant

/**
 * Registre de tous les outils disponibles
 */
class ToolRegistryService {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerBuiltInTools();
  }

  /**
   * Enregistre tous les outils intégrés
   */
  private registerBuiltInTools() {
    // ===== OUTILS DE CODE =====
    
    this.register({
      name: 'execute_python',
      description: 'Exécute du code Python dans un sandbox isolé. Peut installer des packages avec pip. Retourne la sortie standard et les erreurs.',
      category: 'code',
      parameters: [
        { name: 'code', type: 'string', description: 'Le code Python à exécuter', required: true },
        { name: 'packages', type: 'array', description: 'Liste des packages pip à installer avant exécution', required: false }
      ],
      execute: async (args, context) => {
        try {
          // Installer les packages si demandé
          if (args.packages && Array.isArray(args.packages)) {
            for (const pkg of args.packages) {
              await e2bSandbox.executePython(`!pip install ${pkg}`, context.userId, context.sessionId);
            }
          }
          
          const result = await e2bSandbox.executePython(args.code, context.userId, context.sessionId);
          
          return {
            success: result.success,
            output: result.output,
            error: result.error,
            metadata: {
              executionTime: result.executionTime,
              language: 'python'
            }
          };
        } catch (error: any) {
          return {
            success: false,
            output: '',
            error: error.message
          };
        }
      }
    });

    this.register({
      name: 'execute_javascript',
      description: 'Exécute du code JavaScript/Node.js dans un sandbox isolé. Retourne la sortie standard et les erreurs.',
      category: 'code',
      parameters: [
        { name: 'code', type: 'string', description: 'Le code JavaScript à exécuter', required: true }
      ],
      execute: async (args, context) => {
        try {
          const result = await e2bSandbox.executeJavaScript(args.code, context.userId, context.sessionId);
          
          return {
            success: result.success,
            output: result.output,
            error: result.error,
            metadata: {
              executionTime: result.executionTime,
              language: 'javascript'
            }
          };
        } catch (error: any) {
          return {
            success: false,
            output: '',
            error: error.message
          };
        }
      }
    });

    // ===== OUTILS WEB =====

    this.register({
      name: 'web_search',
      description: 'Effectue une recherche sur le web et retourne les résultats pertinents. Utilise plusieurs sources (Google, actualités, etc.)',
      category: 'web',
      parameters: [
        { name: 'query', type: 'string', description: 'La requête de recherche', required: true },
        { name: 'type', type: 'string', description: 'Type de recherche: general, news, weather, crypto', required: false, default: 'general' }
      ],
      execute: async (args, context) => {
        try {
          const enrichment = await contextEnricherModule.enrichContext(args.query, context.userId);
          
          return {
            success: true,
            output: enrichment.enrichedContext || 'Aucun résultat trouvé',
            metadata: {
              category: enrichment.category,
              needsInternet: enrichment.needsInternet
            }
          };
        } catch (error: any) {
          return {
            success: false,
            output: '',
            error: error.message
          };
        }
      }
    });

    this.register({
      name: 'get_weather',
      description: 'Obtient la météo actuelle ou les prévisions pour une ville',
      category: 'web',
      parameters: [
        { name: 'city', type: 'string', description: 'Nom de la ville', required: true },
        { name: 'forecast', type: 'boolean', description: 'Si true, retourne les prévisions sur 5 jours', required: false, default: false }
      ],
      execute: async (args, context) => {
        try {
          const query = args.forecast 
            ? `prévisions météo ${args.city} cette semaine`
            : `météo actuelle ${args.city}`;
          
          const enrichment = await contextEnricherModule.enrichContext(query, context.userId);
          
          return {
            success: true,
            output: enrichment.enrichedContext || 'Données météo non disponibles',
            metadata: { city: args.city, forecast: args.forecast }
          };
        } catch (error: any) {
          return {
            success: false,
            output: '',
            error: error.message
          };
        }
      }
    });

    this.register({
      name: 'get_crypto_price',
      description: 'Obtient le prix actuel d\'une ou plusieurs cryptomonnaies',
      category: 'web',
      parameters: [
        { name: 'symbols', type: 'array', description: 'Liste des symboles (ex: ["BTC", "ETH"])', required: true }
      ],
      execute: async (args, context) => {
        try {
          const query = `prix ${args.symbols.join(' ')} crypto`;
          const enrichment = await contextEnricherModule.enrichContext(query, context.userId);
          
          return {
            success: true,
            output: enrichment.enrichedContext || 'Prix non disponibles',
            metadata: { symbols: args.symbols }
          };
        } catch (error: any) {
          return {
            success: false,
            output: '',
            error: error.message
          };
        }
      }
    });

    // ===== OUTILS IMAGE =====

    this.register({
      name: 'generate_image',
      description: 'Génère une image à partir d\'une description textuelle en utilisant l\'IA',
      category: 'image',
      parameters: [
        { name: 'prompt', type: 'string', description: 'Description détaillée de l\'image à générer', required: true },
        { name: 'style', type: 'string', description: 'Style artistique (realistic, cartoon, abstract, etc.)', required: false }
      ],
      execute: async (args, context) => {
        try {
          let fullPrompt = args.prompt;
          if (args.style) {
            fullPrompt = `${args.prompt}, style: ${args.style}`;
          }
          
          const result = await generateImage({ prompt: fullPrompt });
          
          if (result.url) {
            return {
              success: true,
              output: `Image générée avec succès`,
              artifacts: [{
                type: 'image',
                content: result.url,
                mimeType: 'image/png',
                name: 'generated_image.png'
              }],
              metadata: { prompt: fullPrompt, url: result.url }
            };
          }
          
          return {
            success: false,
            output: '',
            error: 'Échec de la génération d\'image'
          };
        } catch (error: any) {
          return {
            success: false,
            output: '',
            error: error.message
          };
        }
      }
    });

    // ===== OUTILS DATA =====

    this.register({
      name: 'calculate',
      description: 'Effectue des calculs mathématiques complexes',
      category: 'data',
      parameters: [
        { name: 'expression', type: 'string', description: 'Expression mathématique à calculer', required: true }
      ],
      execute: async (args, context) => {
        try {
          // Utiliser Python pour les calculs complexes
          const code = `
import math
result = ${args.expression}
print(f"Résultat: {result}")
`;
          const result = await e2bSandbox.executePython(code, context.userId, context.sessionId);
          
          return {
            success: result.success,
            output: result.output,
            error: result.error
          };
        } catch (error: any) {
          return {
            success: false,
            output: '',
            error: error.message
          };
        }
      }
    });

    this.register({
      name: 'analyze_data',
      description: 'Analyse des données avec Python (pandas, numpy). Peut créer des graphiques.',
      category: 'data',
      parameters: [
        { name: 'data', type: 'string', description: 'Données à analyser (JSON, CSV, ou description)', required: true },
        { name: 'analysis_type', type: 'string', description: 'Type d\'analyse: statistics, visualization, correlation', required: true }
      ],
      execute: async (args, context) => {
        try {
          let code = '';
          
          if (args.analysis_type === 'statistics') {
            code = `
import pandas as pd
import json

data = '''${args.data}'''
try:
    df = pd.read_json(data) if data.startswith('[') or data.startswith('{') else pd.read_csv(pd.io.common.StringIO(data))
    print("=== Statistiques descriptives ===")
    print(df.describe())
    print("\\n=== Types de données ===")
    print(df.dtypes)
    print("\\n=== Valeurs manquantes ===")
    print(df.isnull().sum())
except Exception as e:
    print(f"Erreur: {e}")
`;
          } else if (args.analysis_type === 'visualization') {
            code = `
import pandas as pd
import matplotlib.pyplot as plt

data = '''${args.data}'''
try:
    df = pd.read_json(data) if data.startswith('[') or data.startswith('{') else pd.read_csv(pd.io.common.StringIO(data))
    df.plot(kind='bar')
    plt.title('Visualisation des données')
    plt.tight_layout()
    plt.savefig('chart.png')
    print("Graphique généré: chart.png")
except Exception as e:
    print(f"Erreur: {e}")
`;
          } else {
            code = `
import pandas as pd

data = '''${args.data}'''
try:
    df = pd.read_json(data) if data.startswith('[') or data.startswith('{') else pd.read_csv(pd.io.common.StringIO(data))
    print("=== Corrélations ===")
    print(df.corr())
except Exception as e:
    print(f"Erreur: {e}")
`;
          }
          
          const result = await e2bSandbox.executePython(code, context.userId, context.sessionId);
          
          return {
            success: result.success,
            output: result.output,
            error: result.error,
            metadata: { analysisType: args.analysis_type }
          };
        } catch (error: any) {
          return {
            success: false,
            output: '',
            error: error.message
          };
        }
      }
    });

    // ===== OUTILS SYSTÈME =====

    this.register({
      name: 'think',
      description: 'Réfléchit à un problème complexe et structure la pensée. Utile pour la planification.',
      category: 'system',
      parameters: [
        { name: 'problem', type: 'string', description: 'Le problème ou la question à analyser', required: true },
        { name: 'approach', type: 'string', description: 'Approche: step_by_step, pros_cons, brainstorm', required: false, default: 'step_by_step' }
      ],
      execute: async (args, context) => {
        try {
          const systemPrompt = args.approach === 'pros_cons'
            ? 'Analyse le problème en listant les avantages et inconvénients de chaque option.'
            : args.approach === 'brainstorm'
            ? 'Génère plusieurs idées créatives pour résoudre ce problème.'
            : 'Décompose le problème étape par étape de manière logique.';
          
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: args.problem }
            ]
          });
          
          const content = response.choices[0]?.message?.content || '';
          
          return {
            success: true,
            output: typeof content === 'string' ? content : JSON.stringify(content),
            metadata: { approach: args.approach }
          };
        } catch (error: any) {
          return {
            success: false,
            output: '',
            error: error.message
          };
        }
      }
    });

    this.register({
      name: 'summarize',
      description: 'Résume un texte long en points clés',
      category: 'system',
      parameters: [
        { name: 'text', type: 'string', description: 'Le texte à résumer', required: true },
        { name: 'max_points', type: 'number', description: 'Nombre maximum de points', required: false, default: 5 }
      ],
      execute: async (args, context) => {
        try {
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: `Résume le texte suivant en ${args.max_points || 5} points clés maximum. Sois concis et précis.` },
              { role: 'user', content: args.text }
            ]
          });
          
          const content = response.choices[0]?.message?.content || '';
          
          return {
            success: true,
            output: typeof content === 'string' ? content : JSON.stringify(content)
          };
        } catch (error: any) {
          return {
            success: false,
            output: '',
            error: error.message
          };
        }
      }
    });

    this.register({
      name: 'translate',
      description: 'Traduit du texte d\'une langue à une autre',
      category: 'system',
      parameters: [
        { name: 'text', type: 'string', description: 'Le texte à traduire', required: true },
        { name: 'target_language', type: 'string', description: 'Langue cible (ex: français, english, español)', required: true },
        { name: 'source_language', type: 'string', description: 'Langue source (auto-détection si non spécifié)', required: false }
      ],
      execute: async (args, context) => {
        try {
          const sourceInfo = args.source_language ? `depuis ${args.source_language}` : '';
          
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: `Tu es un traducteur professionnel. Traduis le texte ${sourceInfo} vers ${args.target_language}. Retourne uniquement la traduction, sans explications.` },
              { role: 'user', content: args.text }
            ]
          });
          
          const content = response.choices[0]?.message?.content || '';
          
          return {
            success: true,
            output: typeof content === 'string' ? content : JSON.stringify(content),
            metadata: { targetLanguage: args.target_language }
          };
        } catch (error: any) {
          return {
            success: false,
            output: '',
            error: error.message
          };
        }
      }
    });
  }

  /**
   * Enregistre un nouvel outil
   */
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
    console.log(`[ToolRegistry] Outil enregistré: ${tool.name}`);
  }

  /**
   * Récupère un outil par son nom
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Liste tous les outils disponibles
   */
  listAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Liste les outils par catégorie
   */
  listByCategory(category: Tool['category']): Tool[] {
    return this.listAll().filter(t => t.category === category);
  }

  /**
   * Exécute un outil
   */
  async execute(toolName: string, args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const tool = this.get(toolName);
    
    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Outil "${toolName}" non trouvé`
      };
    }

    // Valider les paramètres requis
    for (const param of tool.parameters) {
      if (param.required && !(param.name in args)) {
        return {
          success: false,
          output: '',
          error: `Paramètre requis manquant: ${param.name}`
        };
      }
      // Appliquer les valeurs par défaut
      if (!(param.name in args) && param.default !== undefined) {
        args[param.name] = param.default;
      }
    }

    console.log(`[ToolRegistry] Exécution de ${toolName} avec args:`, JSON.stringify(args).substring(0, 200));
    
    try {
      const result = await tool.execute(args, context);
      console.log(`[ToolRegistry] ${toolName} terminé - succès: ${result.success}`);
      return result;
    } catch (error: any) {
      console.error(`[ToolRegistry] Erreur lors de l'exécution de ${toolName}:`, error);
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  /**
   * Génère la description des outils pour le LLM
   */
  generateToolsDescription(): string {
    const tools = this.listAll();
    
    return tools.map(tool => {
      const params = tool.parameters.map(p => 
        `  - ${p.name} (${p.type}${p.required ? ', requis' : ', optionnel'}): ${p.description}`
      ).join('\n');
      
      return `### ${tool.name}
${tool.description}
Catégorie: ${tool.category}
Paramètres:
${params}`;
    }).join('\n\n');
  }

  /**
   * Génère le schéma JSON des outils pour le LLM
   */
  generateToolsSchema(): any[] {
    return this.listAll().map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            tool.parameters.map(p => [
              p.name,
              {
                type: p.type,
                description: p.description
              }
            ])
          ),
          required: tool.parameters.filter(p => p.required).map(p => p.name)
        }
      }
    }));
  }
}

// Export singleton
export const toolRegistry = new ToolRegistryService();

export default toolRegistry;
