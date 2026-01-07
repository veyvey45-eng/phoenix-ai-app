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
import { smartErrorCorrector } from './smartErrorCorrector';
import { webGenerator } from './webGenerator';
import { browserless } from './browserless';
import * as fs from 'fs';
import * as path from 'path';
import {
  createWorkspaceFile,
  readWorkspaceFile,
  editWorkspaceFile,
  deleteWorkspaceFile,
  listWorkspaceFiles,
  createWorkspaceDirectory,
  moveWorkspaceFile,
  workspaceFileExists,
  getWorkspaceFileHistory
} from '../workspaceDb';
import { advancedTools } from './advancedTools';
import { moreAdvancedTools } from './moreAdvancedTools';
import { realTools } from './realTools';
import { smartWebTools } from './smartWebTools';

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
    this.registerAdvancedTools();
  }

  /**
   * Enregistre les outils avancés niveau Manus
   */
  private registerAdvancedTools() {
    for (const tool of advancedTools) {
      this.register(tool);
    }
    for (const tool of moreAdvancedTools) {
      this.register(tool);
    }
    for (const tool of realTools) {
      this.register(tool);
    }
    for (const tool of smartWebTools) {
      this.register(tool);
    }
    console.log(`[ToolRegistry] ${advancedTools.length + moreAdvancedTools.length + realTools.length + smartWebTools.length} outils avancés enregistrés`);
  }

  /**
   * Enregistre tous les outils intégrés
   */
  private registerBuiltInTools() {
    // ===== OUTILS DE CODE =====
    
    this.register({
      name: 'execute_python',
      description: 'Exécute du code Python dans un sandbox isolé. Peut installer des packages avec pip. Retourne la sortie standard, les erreurs et les fichiers générés (images, HTML).',
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
          
          // Convertir les fichiers générés en artifacts
          const artifacts: Array<{ type: 'text' | 'image' | 'file' | 'code' | 'data'; content: string; mimeType?: string; name?: string }> = [];
          if (result.filesGenerated && result.filesGenerated.length > 0) {
            for (const file of result.filesGenerated) {
              if (file.type === 'image') {
                artifacts.push({
                  type: 'image',
                  content: file.url,
                  mimeType: file.mimeType,
                  name: file.name
                });
              } else if (file.type === 'html') {
                artifacts.push({
                  type: 'file',
                  content: file.url,
                  mimeType: file.mimeType,
                  name: file.name
                });
              }
            }
          }
          
          return {
            success: result.success,
            output: result.output,
            error: result.error,
            artifacts: artifacts.length > 0 ? artifacts : undefined,
            metadata: {
              executionTime: result.executionTime,
              language: 'python',
              filesGenerated: result.filesGenerated?.length || 0
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
      description: 'Exécute du code JavaScript/Node.js dans un sandbox isolé. Retourne la sortie standard, les erreurs et les fichiers générés (HTML, images).',
      category: 'code',
      parameters: [
        { name: 'code', type: 'string', description: 'Le code JavaScript à exécuter', required: true }
      ],
      execute: async (args, context) => {
        try {
          const result = await e2bSandbox.executeJavaScript(args.code, context.userId, context.sessionId);
          
          // Convertir les fichiers générés en artifacts
          const artifacts: Array<{ type: 'text' | 'image' | 'file' | 'code' | 'data'; content: string; mimeType?: string; name?: string }> = [];
          if (result.filesGenerated && result.filesGenerated.length > 0) {
            for (const file of result.filesGenerated) {
              if (file.type === 'image') {
                artifacts.push({
                  type: 'image',
                  content: file.url,
                  mimeType: file.mimeType,
                  name: file.name
                });
              } else if (file.type === 'html') {
                artifacts.push({
                  type: 'file',
                  content: file.url,
                  mimeType: file.mimeType,
                  name: file.name
                });
              }
            }
          }
          
          return {
            success: result.success,
            output: result.output,
            error: result.error,
            artifacts: artifacts.length > 0 ? artifacts : undefined,
            metadata: {
              executionTime: result.executionTime,
              language: 'javascript',
              filesGenerated: result.filesGenerated?.length || 0
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

    // ===== NOUVEAUX OUTILS MANUS =====

    // Outil de lecture de fichiers
    this.register({
      name: 'file_read',
      description: 'Lit le contenu d\'un fichier. Peut lire des fichiers texte, JSON, code source, etc.',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Chemin du fichier à lire', required: true },
        { name: 'encoding', type: 'string', description: 'Encodage du fichier (utf-8 par défaut)', required: false, default: 'utf-8' }
      ],
      execute: async (args, context) => {
        try {
          // Sécuriser le chemin pour éviter les accès non autorisés
          const safePath = path.resolve('/home/ubuntu', args.path);
          if (!safePath.startsWith('/home/ubuntu')) {
            return {
              success: false,
              output: '',
              error: 'Accès refusé: chemin hors du répertoire autorisé'
            };
          }

          if (!fs.existsSync(safePath)) {
            return {
              success: false,
              output: '',
              error: `Fichier non trouvé: ${args.path}`
            };
          }

          const content = fs.readFileSync(safePath, args.encoding || 'utf-8');
          const stats = fs.statSync(safePath);

          return {
            success: true,
            output: content,
            metadata: {
              path: args.path,
              size: stats.size,
              modified: stats.mtime.toISOString()
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

    // Outil d'écriture de fichiers
    this.register({
      name: 'file_write',
      description: 'Écrit du contenu dans un fichier. Crée le fichier s\'il n\'existe pas.',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Chemin du fichier à écrire', required: true },
        { name: 'content', type: 'string', description: 'Contenu à écrire', required: true },
        { name: 'append', type: 'boolean', description: 'Ajouter au fichier au lieu de le remplacer', required: false, default: false }
      ],
      execute: async (args, context) => {
        try {
          const safePath = path.resolve('/home/ubuntu', args.path);
          if (!safePath.startsWith('/home/ubuntu')) {
            return {
              success: false,
              output: '',
              error: 'Accès refusé: chemin hors du répertoire autorisé'
            };
          }

          // Créer le répertoire parent si nécessaire
          const dir = path.dirname(safePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          if (args.append) {
            fs.appendFileSync(safePath, args.content, 'utf-8');
          } else {
            fs.writeFileSync(safePath, args.content, 'utf-8');
          }

          return {
            success: true,
            output: `Fichier ${args.append ? 'mis à jour' : 'créé'}: ${args.path}`,
            metadata: {
              path: args.path,
              size: Buffer.byteLength(args.content, 'utf-8'),
              append: args.append
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

    // Outil d'édition de fichiers
    this.register({
      name: 'file_edit',
      description: 'Édite un fichier existant en remplaçant du texte ou en insérant du contenu.',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Chemin du fichier à éditer', required: true },
        { name: 'find', type: 'string', description: 'Texte à trouver', required: true },
        { name: 'replace', type: 'string', description: 'Texte de remplacement', required: true },
        { name: 'all', type: 'boolean', description: 'Remplacer toutes les occurrences', required: false, default: false }
      ],
      execute: async (args, context) => {
        try {
          const safePath = path.resolve('/home/ubuntu', args.path);
          if (!safePath.startsWith('/home/ubuntu')) {
            return {
              success: false,
              output: '',
              error: 'Accès refusé: chemin hors du répertoire autorisé'
            };
          }

          if (!fs.existsSync(safePath)) {
            return {
              success: false,
              output: '',
              error: `Fichier non trouvé: ${args.path}`
            };
          }

          let content = fs.readFileSync(safePath, 'utf-8');
          const originalContent = content;

          if (args.all) {
            content = content.split(args.find).join(args.replace);
          } else {
            content = content.replace(args.find, args.replace);
          }

          if (content === originalContent) {
            return {
              success: false,
              output: '',
              error: 'Texte à trouver non présent dans le fichier'
            };
          }

          fs.writeFileSync(safePath, content, 'utf-8');

          return {
            success: true,
            output: `Fichier édité: ${args.path}`,
            metadata: {
              path: args.path,
              replacements: args.all ? (originalContent.split(args.find).length - 1) : 1
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

    // Outil de navigation web
    this.register({
      name: 'browse_web',
      description: 'Navigue sur le web, extrait le contenu des pages, prend des screenshots.',
      category: 'web',
      parameters: [
        { name: 'url', type: 'string', description: 'URL de la page à visiter', required: true },
        { name: 'action', type: 'string', description: 'Action: content, screenshot, click, fill', required: false, default: 'content' },
        { name: 'selector', type: 'string', description: 'Sélecteur CSS pour click/fill', required: false },
        { name: 'value', type: 'string', description: 'Valeur pour fill', required: false }
      ],
      execute: async (args, context) => {
        try {
          const action = args.action || 'content';

          if (action === 'content') {
            const result = await browserless.getContent(args.url);
            return {
              success: result.success,
              output: result.content || '',
              error: result.error,
              metadata: { url: args.url, title: result.title }
            };
          } else if (action === 'screenshot') {
            const result = await browserless.screenshot(args.url);
            if (result.success && result.screenshot) {
              // Extraire le base64 du data URL si nécessaire
              const base64Data = result.screenshot.replace(/^data:image\/png;base64,/, '');
              const filename = `screenshot-${Date.now()}.png`;
              const { url } = await storagePut(
                `${context.userId}/screenshots/${filename}`,
                Buffer.from(base64Data, 'base64'),
                'image/png'
              );
              return {
                success: true,
                output: `Screenshot capturé`,
                artifacts: [{
                  type: 'image',
                  content: url,
                  mimeType: 'image/png',
                  name: filename
                }],
                metadata: { url: args.url }
              };
            }
            return {
              success: false,
              output: '',
              error: result.error || 'Erreur lors de la capture'
            };
          } else if (action === 'scrape' && args.selector) {
            const result = await browserless.scrape(args.url, [args.selector]);
            return {
              success: result.success,
              output: result.content || '',
              error: result.error
            };
          }

          return {
            success: false,
            output: '',
            error: 'Action non reconnue'
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

    // Outil d'exécution shell
    this.register({
      name: 'shell_exec',
      description: 'Exécute des commandes shell dans un environnement sécurisé (sandbox E2B).',
      category: 'system',
      parameters: [
        { name: 'command', type: 'string', description: 'Commande shell à exécuter', required: true },
        { name: 'cwd', type: 'string', description: 'Répertoire de travail', required: false, default: '/home/user' }
      ],
      execute: async (args, context) => {
        try {
          // Liste des commandes dangereuses interdites
          const dangerousCommands = ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:', 'chmod -R 777 /', 'shutdown', 'reboot'];
          const cmdLower = args.command.toLowerCase();
          
          for (const dangerous of dangerousCommands) {
            if (cmdLower.includes(dangerous)) {
              return {
                success: false,
                output: '',
                error: 'Commande dangereuse interdite'
              };
            }
          }

          // Exécuter via Python subprocess pour isolation
          const shellCode = `
import subprocess
import shlex

try:
    result = subprocess.run(
        ${JSON.stringify(args.command)},
        shell=True,
        capture_output=True,
        text=True,
        timeout=30,
        cwd=${JSON.stringify(args.cwd || '/home/user')}
    )
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    print("EXIT_CODE:", result.returncode)
except subprocess.TimeoutExpired:
    print("ERROR: Command timed out")
except Exception as e:
    print(f"ERROR: {e}")
`;
          const result = await e2bSandbox.executePython(shellCode, context.userId, context.sessionId);
          
          return {
            success: result.success,
            output: result.output,
            error: result.error,
            metadata: {
              command: args.command,
              executionTime: result.executionTime
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

    // Outil de génération web
    this.register({
      name: 'generate_web_page',
      description: 'Génère une page web HTML/CSS complète à partir d\'une description.',
      category: 'code',
      parameters: [
        { name: 'description', type: 'string', description: 'Description de la page à générer', required: true },
        { name: 'type', type: 'string', description: 'Type: html, landing, react', required: false, default: 'html' },
        { name: 'style', type: 'string', description: 'Style: modern, minimal, creative', required: false, default: 'modern' }
      ],
      execute: async (args, context) => {
        try {
          let result;
          
          if (args.type === 'landing') {
            result = await webGenerator.generateLandingPage(args.description, { colorScheme: args.style });
          } else if (args.type === 'react') {
            result = await webGenerator.generateReactComponent(args.description, 'GeneratedComponent');
          } else {
            result = await webGenerator.generateHTML(args.description, { style: args.style });
          }

          if (result.success && 'html' in result.content) {
            // Sauvegarder et obtenir l'URL de prévisualisation
            const preview = await webGenerator.saveAndPreview(result.content as any, context.userId);
            
            return {
              success: true,
              output: `Page générée avec succès`,
              artifacts: [{
                type: 'code',
                content: (result.content as any).html,
                mimeType: 'text/html',
                name: 'generated-page.html'
              }],
              metadata: {
                type: args.type,
                previewUrl: preview.url
              }
            };
          } else if (result.success && 'code' in result.content) {
            return {
              success: true,
              output: `Composant React généré`,
              artifacts: [{
                type: 'code',
                content: (result.content as any).code,
                mimeType: 'text/typescript',
                name: `${(result.content as any).name}.tsx`
              }]
            };
          }

          return {
            success: false,
            output: '',
            error: result.error || 'Erreur de génération'
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

    // Outil de correction intelligente
    this.register({
      name: 'smart_fix',
      description: 'Corrige automatiquement les erreurs de code Python ou JavaScript.',
      category: 'code',
      parameters: [
        { name: 'code', type: 'string', description: 'Code à corriger', required: true },
        { name: 'error', type: 'string', description: 'Message d\'erreur', required: true },
        { name: 'language', type: 'string', description: 'Langage: python ou javascript', required: true }
      ],
      execute: async (args, context) => {
        try {
          const result = await smartErrorCorrector.correctAndExecute(
            args.code,
            args.error,
            args.language as 'python' | 'javascript',
            context.userId,
            context.sessionId
          );

          return {
            success: result.success,
            output: result.success ? result.finalOutput || '' : '',
            error: result.finalError,
            artifacts: result.success ? [{
              type: 'code',
              content: result.correctedCode,
              mimeType: args.language === 'python' ? 'text/x-python' : 'text/javascript',
              name: `corrected.${args.language === 'python' ? 'py' : 'js'}`
            }] : undefined,
            metadata: {
              attempts: result.attempts,
              errorType: result.errorAnalysis.errorType,
              confidence: result.errorAnalysis.confidence
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

    // ===== OUTILS WORKSPACE (Système de fichiers persistant) =====

    this.register({
      name: 'workspace_create',
      description: 'Crée un nouveau fichier dans le workspace persistant de l\'utilisateur. Le fichier sera sauvegardé et accessible lors des prochaines sessions.',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Chemin du fichier (ex: /projects/app/index.ts)', required: true },
        { name: 'content', type: 'string', description: 'Contenu du fichier', required: true }
      ],
      execute: async (args, context) => {
        try {
          const userId = parseInt(context.userId) || 0;
          const result = await createWorkspaceFile(userId, args.path, args.content, { modifiedBy: 'agent' });
          
          if (!result.success) {
            return {
              success: false,
              output: '',
              error: result.error
            };
          }
          
          return {
            success: true,
            output: `Fichier créé: ${args.path}`,
            metadata: {
              path: args.path,
              size: result.file?.size,
              version: result.file?.version
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
      name: 'workspace_read',
      description: 'Lit le contenu d\'un fichier du workspace persistant.',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Chemin du fichier à lire', required: true }
      ],
      execute: async (args, context) => {
        try {
          const userId = parseInt(context.userId) || 0;
          const result = await readWorkspaceFile(userId, args.path);
          
          if (!result.success) {
            return {
              success: false,
              output: '',
              error: result.error
            };
          }
          
          return {
            success: true,
            output: result.content || '',
            metadata: {
              path: args.path,
              size: result.file?.size,
              language: result.file?.language,
              version: result.file?.version
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
      name: 'workspace_edit',
      description: 'Édite un fichier existant dans le workspace persistant. Remplace entièrement le contenu.',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Chemin du fichier à éditer', required: true },
        { name: 'content', type: 'string', description: 'Nouveau contenu du fichier', required: true },
        { name: 'description', type: 'string', description: 'Description du changement', required: false }
      ],
      execute: async (args, context) => {
        try {
          const userId = parseInt(context.userId) || 0;
          const result = await editWorkspaceFile(userId, args.path, args.content, {
            modifiedBy: 'agent',
            changeDescription: args.description
          });
          
          if (!result.success) {
            return {
              success: false,
              output: '',
              error: result.error
            };
          }
          
          return {
            success: true,
            output: `Fichier modifié: ${args.path} (v${result.file?.version})`,
            metadata: {
              path: args.path,
              size: result.file?.size,
              version: result.file?.version
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
      name: 'workspace_delete',
      description: 'Supprime un fichier du workspace persistant.',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Chemin du fichier à supprimer', required: true }
      ],
      execute: async (args, context) => {
        try {
          const userId = parseInt(context.userId) || 0;
          const result = await deleteWorkspaceFile(userId, args.path, { modifiedBy: 'agent' });
          
          if (!result.success) {
            return {
              success: false,
              output: '',
              error: result.error
            };
          }
          
          return {
            success: true,
            output: `Fichier supprimé: ${args.path}`,
            metadata: { path: args.path }
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
      name: 'workspace_list',
      description: 'Liste tous les fichiers du workspace persistant de l\'utilisateur.',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Chemin du répertoire (optionnel, / par défaut)', required: false },
        { name: 'recursive', type: 'boolean', description: 'Lister récursivement', required: false, default: true }
      ],
      execute: async (args, context) => {
        try {
          const userId = parseInt(context.userId) || 0;
          const result = await listWorkspaceFiles(userId, {
            path: args.path,
            recursive: args.recursive !== false
          });
          
          if (!result.success) {
            return {
              success: false,
              output: '',
              error: result.error
            };
          }
          
          const files = result.files || [];
          if (files.length === 0) {
            return {
              success: true,
              output: 'Workspace vide - aucun fichier',
              metadata: { count: 0 }
            };
          }
          
          const fileList = files.map(f => {
            const icon = f.fileType === 'directory' ? '📁' : '📄';
            const size = f.size ? ` (${f.size} bytes)` : '';
            return `${icon} ${f.path}${size}`;
          }).join('\n');
          
          return {
            success: true,
            output: fileList,
            metadata: {
              count: files.length,
              totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0)
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
      name: 'workspace_mkdir',
      description: 'Crée un répertoire dans le workspace persistant.',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Chemin du répertoire à créer', required: true }
      ],
      execute: async (args, context) => {
        try {
          const userId = parseInt(context.userId) || 0;
          const result = await createWorkspaceDirectory(userId, args.path);
          
          if (!result.success) {
            return {
              success: false,
              output: '',
              error: result.error
            };
          }
          
          return {
            success: true,
            output: `Répertoire créé: ${args.path}`,
            metadata: { path: args.path }
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
      name: 'workspace_move',
      description: 'Déplace ou renomme un fichier dans le workspace persistant.',
      category: 'file',
      parameters: [
        { name: 'old_path', type: 'string', description: 'Chemin actuel du fichier', required: true },
        { name: 'new_path', type: 'string', description: 'Nouveau chemin du fichier', required: true }
      ],
      execute: async (args, context) => {
        try {
          const userId = parseInt(context.userId) || 0;
          const result = await moveWorkspaceFile(userId, args.old_path, args.new_path, { modifiedBy: 'agent' });
          
          if (!result.success) {
            return {
              success: false,
              output: '',
              error: result.error
            };
          }
          
          return {
            success: true,
            output: `Fichier déplacé: ${args.old_path} → ${args.new_path}`,
            metadata: {
              oldPath: args.old_path,
              newPath: args.new_path,
              version: result.file?.version
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
      name: 'workspace_history',
      description: 'Affiche l\'historique des modifications d\'un fichier.',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Chemin du fichier', required: true }
      ],
      execute: async (args, context) => {
        try {
          const userId = parseInt(context.userId) || 0;
          const result = await getWorkspaceFileHistory(userId, args.path);
          
          if (!result.success) {
            return {
              success: false,
              output: '',
              error: result.error
            };
          }
          
          const history = result.history || [];
          if (history.length === 0) {
            return {
              success: true,
              output: 'Aucun historique disponible',
              metadata: { count: 0 }
            };
          }
          
          const historyList = history.map(h => {
            const date = new Date(h.createdAt).toLocaleString('fr-FR');
            return `v${h.version} - ${h.changeType} - ${date} (${h.changedBy})`;
          }).join('\n');
          
          return {
            success: true,
            output: historyList,
            metadata: { count: history.length }
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

    // ===== NOUVEAUX OUTILS AVANCÉS POUR PHOENIX =====

    // Lire plusieurs fichiers d'un coup
    this.register({
      name: 'workspace_read_multiple',
      description: 'Lit le contenu de plusieurs fichiers du workspace en une seule opération. Utile pour comprendre le contexte d\'un projet.',
      category: 'file',
      parameters: [
        { name: 'paths', type: 'array', description: 'Liste des chemins de fichiers à lire', required: true }
      ],
      execute: async (args, context) => {
        try {
          const userId = parseInt(context.userId) || 0;
          const results: Array<{ path: string; content: string; error?: string }> = [];
          
          for (const filePath of args.paths) {
            const result = await readWorkspaceFile(userId, filePath);
            if (result.success) {
              results.push({ path: filePath, content: result.content || '' });
            } else {
              results.push({ path: filePath, content: '', error: result.error });
            }
          }
          
          const output = results.map(r => {
            if (r.error) {
              return `=== ${r.path} ===\n[ERREUR: ${r.error}]`;
            }
            return `=== ${r.path} ===\n${r.content}`;
          }).join('\n\n');
          
          return {
            success: true,
            output,
            metadata: {
              filesRead: results.filter(r => !r.error).length,
              filesError: results.filter(r => r.error).length
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

    // Voir la structure arborescente du projet
    this.register({
      name: 'workspace_tree',
      description: 'Affiche la structure arborescente complète du workspace. Utile pour comprendre l\'organisation d\'un projet.',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Chemin racine ("/" par défaut)', required: false, default: '/' },
        { name: 'max_depth', type: 'number', description: 'Profondeur maximale (10 par défaut)', required: false, default: 10 }
      ],
      execute: async (args, context) => {
        try {
          const userId = parseInt(context.userId) || 0;
          const result = await listWorkspaceFiles(userId, { path: args.path || '/', recursive: true });
          
          if (!result.success) {
            return {
              success: false,
              output: '',
              error: result.error
            };
          }
          
          const files = result.files || [];
          if (files.length === 0) {
            return {
              success: true,
              output: 'Workspace vide',
              metadata: { count: 0 }
            };
          }
          
          // Construire l'arbre
          const buildTree = (items: typeof files, basePath: string, depth: number): string => {
            if (depth > (args.max_depth || 10)) return '';
            
            const directChildren = items.filter(f => {
              const relativePath = f.path.replace(basePath, '').replace(/^\//, '');
              return relativePath && !relativePath.includes('/');
            });
            
            return directChildren.map(item => {
              const indent = '  '.repeat(depth);
              const icon = item.fileType === 'directory' ? '📁' : '📄';
              const name = item.name;
              const size = item.size ? ` (${item.size}B)` : '';
              
              let line = `${indent}${icon} ${name}${size}`;
              
              if (item.fileType === 'directory') {
                const children = buildTree(items, item.path, depth + 1);
                if (children) line += '\n' + children;
              }
              
              return line;
            }).join('\n');
          };
          
          const tree = buildTree(files, args.path || '/', 0);
          
          return {
            success: true,
            output: tree || 'Aucun fichier',
            metadata: {
              totalFiles: files.filter(f => f.fileType === 'file').length,
              totalDirs: files.filter(f => f.fileType === 'directory').length
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

    // Rechercher dans les fichiers
    this.register({
      name: 'workspace_search',
      description: 'Recherche du texte dans tous les fichiers du workspace. Retourne les fichiers correspondants avec le contexte.',
      category: 'file',
      parameters: [
        { name: 'query', type: 'string', description: 'Texte ou regex à rechercher', required: true },
        { name: 'path', type: 'string', description: 'Répertoire de recherche ("/" par défaut)', required: false, default: '/' },
        { name: 'file_pattern', type: 'string', description: 'Pattern de fichiers (ex: "*.ts", "*.py")', required: false }
      ],
      execute: async (args, context) => {
        try {
          const userId = parseInt(context.userId) || 0;
          const listResult = await listWorkspaceFiles(userId, { path: args.path || '/', recursive: true });
          
          if (!listResult.success) {
            return {
              success: false,
              output: '',
              error: listResult.error
            };
          }
          
          const files = (listResult.files || []).filter(f => f.fileType === 'file');
          
          // Filtrer par pattern si spécifié
          const filteredFiles = args.file_pattern
            ? files.filter(f => {
                const pattern = args.file_pattern.replace('*', '.*');
                return new RegExp(pattern).test(f.name);
              })
            : files;
          
          const matches: Array<{ path: string; line: number; content: string }> = [];
          
          for (const file of filteredFiles) {
            const readResult = await readWorkspaceFile(userId, file.path);
            if (readResult.success && readResult.content) {
              const lines = readResult.content.split('\n');
              lines.forEach((line, idx) => {
                if (line.toLowerCase().includes(args.query.toLowerCase())) {
                  matches.push({
                    path: file.path,
                    line: idx + 1,
                    content: line.trim().substring(0, 200)
                  });
                }
              });
            }
          }
          
          if (matches.length === 0) {
            return {
              success: true,
              output: `Aucune correspondance pour "${args.query}"`,
              metadata: { matches: 0 }
            };
          }
          
          const output = matches.map(m => 
            `${m.path}:${m.line}: ${m.content}`
          ).join('\n');
          
          return {
            success: true,
            output,
            metadata: {
              matches: matches.length,
              filesSearched: filteredFiles.length
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

    // Créer un projet structuré complet
    this.register({
      name: 'project_scaffold',
      description: 'Crée une structure de projet complète avec tous les fichiers nécessaires. Types: react, node, python, html.',
      category: 'file',
      parameters: [
        { name: 'name', type: 'string', description: 'Nom du projet', required: true },
        { name: 'type', type: 'string', description: 'Type: react, node, python, html, fullstack', required: true },
        { name: 'description', type: 'string', description: 'Description du projet', required: false }
      ],
      execute: async (args, context) => {
        try {
          const userId = parseInt(context.userId) || 0;
          const projectPath = `/projects/${args.name}`;
          const createdFiles: string[] = [];
          
          // Créer le répertoire principal
          await createWorkspaceDirectory(userId, projectPath);
          createdFiles.push(projectPath);
          
          // Templates selon le type de projet
          const templates: Record<string, Array<{ path: string; content: string }>> = {
            react: [
              { path: `${projectPath}/package.json`, content: JSON.stringify({
                name: args.name,
                version: '1.0.0',
                description: args.description || '',
                scripts: {
                  dev: 'vite',
                  build: 'vite build',
                  preview: 'vite preview'
                },
                dependencies: {
                  'react': '^18.2.0',
                  'react-dom': '^18.2.0'
                },
                devDependencies: {
                  'vite': '^5.0.0',
                  '@vitejs/plugin-react': '^4.0.0'
                }
              }, null, 2) },
              { path: `${projectPath}/index.html`, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${args.name}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>` },
              { path: `${projectPath}/src/main.tsx`, content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);` },
              { path: `${projectPath}/src/App.tsx`, content: `import React from 'react';

function App() {
  return (
    <div className="app">
      <h1>${args.name}</h1>
      <p>${args.description || 'Bienvenue dans votre application React!'}</p>
    </div>
  );
}

export default App;` },
              { path: `${projectPath}/src/index.css`, content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f172a;
  color: #f8fafc;
  min-height: 100vh;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  color: #10b981;
  margin-bottom: 1rem;
}` },
              { path: `${projectPath}/vite.config.ts`, content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()]
});` },
              { path: `${projectPath}/tsconfig.json`, content: JSON.stringify({
                compilerOptions: {
                  target: 'ES2020',
                  useDefineForClassFields: true,
                  lib: ['ES2020', 'DOM', 'DOM.Iterable'],
                  module: 'ESNext',
                  skipLibCheck: true,
                  moduleResolution: 'bundler',
                  allowImportingTsExtensions: true,
                  resolveJsonModule: true,
                  isolatedModules: true,
                  noEmit: true,
                  jsx: 'react-jsx',
                  strict: true
                },
                include: ['src']
              }, null, 2) },
              { path: `${projectPath}/README.md`, content: `# ${args.name}\n\n${args.description || ''}\n\n## Installation\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`` }
            ],
            node: [
              { path: `${projectPath}/package.json`, content: JSON.stringify({
                name: args.name,
                version: '1.0.0',
                description: args.description || '',
                main: 'src/index.js',
                scripts: {
                  start: 'node src/index.js',
                  dev: 'node --watch src/index.js'
                },
                dependencies: {}
              }, null, 2) },
              { path: `${projectPath}/src/index.js`, content: `// ${args.name}\n// ${args.description || ''}\n\nconsole.log('Hello from ${args.name}!');\n\n// TODO: Add your code here` },
              { path: `${projectPath}/README.md`, content: `# ${args.name}\n\n${args.description || ''}\n\n## Usage\n\n\`\`\`bash\nnpm start\n\`\`\`` }
            ],
            python: [
              { path: `${projectPath}/main.py`, content: `#!/usr/bin/env python3\n"""${args.name}\n\n${args.description || ''}\n"""\n\ndef main():\n    print(f"Hello from ${args.name}!")\n    # TODO: Add your code here\n\nif __name__ == "__main__":\n    main()` },
              { path: `${projectPath}/requirements.txt`, content: `# ${args.name} dependencies\n# Add your dependencies here` },
              { path: `${projectPath}/README.md`, content: `# ${args.name}\n\n${args.description || ''}\n\n## Installation\n\n\`\`\`bash\npip install -r requirements.txt\npython main.py\n\`\`\`` }
            ],
            html: [
              { path: `${projectPath}/index.html`, content: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${args.name}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>${args.name}</h1>
  </header>
  <main>
    <p>${args.description || 'Bienvenue!'}</p>
  </main>
  <script src="script.js"></script>
</body>
</html>` },
              { path: `${projectPath}/style.css`, content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: #f8fafc;
  min-height: 100vh;
}

header {
  padding: 2rem;
  text-align: center;
}

h1 {
  color: #10b981;
}

main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}` },
              { path: `${projectPath}/script.js`, content: `// ${args.name}\nconsole.log('${args.name} loaded!');\n\n// TODO: Add your JavaScript here` }
            ],
            fullstack: [
              { path: `${projectPath}/package.json`, content: JSON.stringify({
                name: args.name,
                version: '1.0.0',
                description: args.description || '',
                scripts: {
                  dev: 'concurrently "npm run server" "npm run client"',
                  server: 'node server/index.js',
                  client: 'cd client && npm run dev'
                },
                dependencies: {
                  'express': '^4.18.0',
                  'cors': '^2.8.5'
                }
              }, null, 2) },
              { path: `${projectPath}/server/index.js`, content: `const express = require('express');\nconst cors = require('cors');\n\nconst app = express();\napp.use(cors());\napp.use(express.json());\n\napp.get('/api/hello', (req, res) => {\n  res.json({ message: 'Hello from ${args.name}!' });\n});\n\nconst PORT = process.env.PORT || 3001;\napp.listen(PORT, () => {\n  console.log(\`Server running on port \${PORT}\`);\n});` },
              { path: `${projectPath}/client/index.html`, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${args.name}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>` },
              { path: `${projectPath}/README.md`, content: `# ${args.name}\n\n${args.description || ''}\n\n## Structure\n\n- \`/server\` - Backend Express\n- \`/client\` - Frontend React\n\n## Installation\n\n\`\`\`bash\nnpm install\ncd client && npm install\nnpm run dev\n\`\`\`` }
            ]
          };
          
          const projectFiles = templates[args.type] || templates.html;
          
          // Créer les sous-répertoires nécessaires
          const dirs = new Set<string>();
          for (const file of projectFiles) {
            const dir = file.path.substring(0, file.path.lastIndexOf('/'));
            if (dir !== projectPath) {
              dirs.add(dir);
            }
          }
          
          for (const dir of Array.from(dirs)) {
            await createWorkspaceDirectory(userId, dir);
            createdFiles.push(dir);
          }
          
          // Créer les fichiers
          for (const file of projectFiles) {
            await createWorkspaceFile(userId, file.path, file.content, { modifiedBy: 'agent' });
            createdFiles.push(file.path);
          }
          
          return {
            success: true,
            output: `Projet "${args.name}" créé avec succès!\n\nFichiers créés:\n${createdFiles.map(f => `  - ${f}`).join('\n')}`,
            metadata: {
              projectPath,
              type: args.type,
              filesCreated: createdFiles.length
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

    // Exécuter et voir le résultat (boucle de feedback)
    this.register({
      name: 'execute_and_observe',
      description: 'Exécute du code et observe le résultat. Si erreur, analyse et propose une correction. Crée une boucle de feedback.',
      category: 'code',
      parameters: [
        { name: 'code', type: 'string', description: 'Code à exécuter', required: true },
        { name: 'language', type: 'string', description: 'Langage: python ou javascript', required: true },
        { name: 'max_retries', type: 'number', description: 'Nombre max de tentatives de correction', required: false, default: 3 }
      ],
      execute: async (args, context) => {
        try {
          let code = args.code;
          let attempts = 0;
          const maxRetries = args.max_retries || 3;
          const history: Array<{ attempt: number; code: string; output: string; error?: string }> = [];
          
          while (attempts < maxRetries) {
            attempts++;
            
            // Exécuter le code
            const result = args.language === 'python'
              ? await e2bSandbox.executePython(code, context.userId, context.sessionId)
              : await e2bSandbox.executeJavaScript(code, context.userId, context.sessionId);
            
            history.push({
              attempt: attempts,
              code: code.substring(0, 500),
              output: result.output.substring(0, 500),
              error: result.error
            });
            
            // Si succès, retourner
            if (result.success && !result.error) {
              return {
                success: true,
                output: result.output,
                artifacts: result.filesGenerated?.map(f => ({
                  type: 'image' as const,
                  content: f.url,
                  mimeType: f.mimeType,
                  name: f.name
                })),
                metadata: {
                  attempts,
                  history,
                  executionTime: result.executionTime
                }
              };
            }
            
            // Si erreur et encore des tentatives, essayer de corriger
            if (attempts < maxRetries && result.error) {
              const correctionResult = await smartErrorCorrector.correctAndExecute(
                code,
                result.error,
                args.language as 'python' | 'javascript',
                context.userId,
                context.sessionId
              );
              
              if (correctionResult.success) {
                return {
                  success: true,
                  output: correctionResult.finalOutput || '',
                  metadata: {
                    attempts: attempts + 1,
                    corrected: true,
                    history
                  }
                };
              }
              
              // Utiliser le code corrigé pour la prochaine tentative
              code = correctionResult.correctedCode;
            }
          }
          
          // Échec après toutes les tentatives
          return {
            success: false,
            output: history[history.length - 1]?.output || '',
            error: `Échec après ${attempts} tentatives. Dernière erreur: ${history[history.length - 1]?.error}`,
            metadata: { attempts, history }
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

    // Créer plusieurs fichiers d'un coup
    this.register({
      name: 'workspace_create_multiple',
      description: 'Crée plusieurs fichiers dans le workspace en une seule opération. Utile pour créer un projet complet.',
      category: 'file',
      parameters: [
        { name: 'files', type: 'array', description: 'Liste d\'objets {path, content} pour chaque fichier', required: true }
      ],
      execute: async (args, context) => {
        try {
          const userId = parseInt(context.userId) || 0;
          const results: Array<{ path: string; success: boolean; error?: string }> = [];
          
          // D'abord créer les répertoires nécessaires
          const dirs = new Set<string>();
          for (const file of args.files) {
            const dir = file.path.substring(0, file.path.lastIndexOf('/'));
            if (dir && dir !== '/') {
              // Ajouter tous les répertoires parents
              const parts = dir.split('/').filter(Boolean);
              let currentPath = '';
              for (const part of parts) {
                currentPath += '/' + part;
                dirs.add(currentPath);
              }
            }
          }
          
          // Créer les répertoires dans l'ordre
          const sortedDirs = Array.from(dirs).sort((a, b) => a.length - b.length);
          for (const dir of sortedDirs) {
            await createWorkspaceDirectory(userId, dir);
          }
          
          // Créer les fichiers
          for (const file of args.files) {
            const result = await createWorkspaceFile(userId, file.path, file.content, { modifiedBy: 'agent' });
            results.push({
              path: file.path,
              success: result.success,
              error: result.error
            });
          }
          
          const successCount = results.filter(r => r.success).length;
          const failCount = results.filter(r => !r.success).length;
          
          const output = results.map(r => 
            r.success ? `✅ ${r.path}` : `❌ ${r.path}: ${r.error}`
          ).join('\n');
          
          return {
            success: failCount === 0,
            output: `${successCount} fichiers créés, ${failCount} erreurs\n\n${output}`,
            metadata: {
              created: successCount,
              failed: failCount,
              results
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

    // Outil de liste de fichiers (système local - pour compatibilité)
    this.register({
      name: 'file_list',
      description: 'Liste les fichiers et dossiers dans un répertoire.',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Chemin du répertoire', required: true },
        { name: 'recursive', type: 'boolean', description: 'Lister récursivement', required: false, default: false }
      ],
      execute: async (args, context) => {
        try {
          const safePath = path.resolve('/home/ubuntu', args.path);
          if (!safePath.startsWith('/home/ubuntu')) {
            return {
              success: false,
              output: '',
              error: 'Accès refusé: chemin hors du répertoire autorisé'
            };
          }

          if (!fs.existsSync(safePath)) {
            return {
              success: false,
              output: '',
              error: `Répertoire non trouvé: ${args.path}`
            };
          }

          const listDir = (dir: string, prefix: string = ''): string[] => {
            const items: string[] = [];
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              const relativePath = path.join(prefix, entry.name);
              
              if (entry.isDirectory()) {
                items.push(`📁 ${relativePath}/`);
                if (args.recursive) {
                  items.push(...listDir(fullPath, relativePath));
                }
              } else {
                const stats = fs.statSync(fullPath);
                items.push(`📄 ${relativePath} (${formatSize(stats.size)})`);
              }
            }
            return items;
          };

          const formatSize = (bytes: number): string => {
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
          };

          const files = listDir(safePath);
          
          return {
            success: true,
            output: files.join('\n'),
            metadata: {
              path: args.path,
              count: files.length
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
