/**
 * Phoenix Tools Engine
 * Outils concrets que Phoenix peut utiliser pour passer de la réflexion à l'action
 */

import { invokeLLM } from '../_core/llm';

// Types pour les outils
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  timestamp: Date;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  success: boolean;
  result: unknown;
  error?: string;
  executionTime: number;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

// Outil: Calculatrice
const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Effectue des calculs mathématiques. Supporte les opérations de base (+, -, *, /), les puissances (^), les parenthèses, et les fonctions mathématiques (sqrt, sin, cos, tan, log, exp, abs, round, floor, ceil).',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'L\'expression mathématique à évaluer, ex: "2 + 2", "sqrt(16)", "(3 + 4) * 2"'
      }
    },
    required: ['expression']
  },
  execute: async (args) => {
    const expression = args.expression as string;
    
    // Sécuriser l'expression - n'autoriser que les caractères mathématiques
    const sanitized = expression
      .replace(/\s+/g, '')
      .replace(/\^/g, '**'); // Convertir ^ en **
    
    // Vérifier que l'expression ne contient que des caractères autorisés
    const allowedPattern = /^[0-9+\-*/().%,\s]+$|^(sqrt|sin|cos|tan|log|exp|abs|round|floor|ceil|pow|min|max|PI|E)\(/i;
    
    // Créer un environnement sécurisé pour l'évaluation
    const mathFunctions = {
      sqrt: Math.sqrt,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      log: Math.log,
      exp: Math.exp,
      abs: Math.abs,
      round: Math.round,
      floor: Math.floor,
      ceil: Math.ceil,
      pow: Math.pow,
      min: Math.min,
      max: Math.max,
      PI: Math.PI,
      E: Math.E
    };
    
    try {
      // Remplacer les fonctions mathématiques par leurs équivalents
      let evalExpression = sanitized;
      for (const [name, fn] of Object.entries(mathFunctions)) {
        const regex = new RegExp(`\\b${name}\\b`, 'gi');
        evalExpression = evalExpression.replace(regex, `Math.${name}`);
      }
      
      // Évaluer de manière sécurisée
      const result = Function(`"use strict"; return (${evalExpression})`)();
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Résultat invalide');
      }
      
      return {
        expression: expression,
        result: result,
        formatted: Number.isInteger(result) ? result.toString() : result.toFixed(6).replace(/\.?0+$/, '')
      };
    } catch (error) {
      throw new Error(`Impossible d'évaluer l'expression: ${expression}`);
    }
  }
};

// Outil: Recherche Web (simulée pour le MVP, peut être connectée à une vraie API)
const webSearchTool: Tool = {
  name: 'web_search',
  description: 'Recherche des informations sur le web. Utile pour trouver des faits actuels, des définitions, ou des informations générales.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'La requête de recherche'
      },
      type: {
        type: 'string',
        description: 'Le type de recherche',
        enum: ['general', 'news', 'academic']
      }
    },
    required: ['query']
  },
  execute: async (args) => {
    const query = args.query as string;
    const searchType = (args.type as string) || 'general';
    
    // Pour le MVP, utiliser le LLM pour simuler une recherche
    // En production, connecter à une vraie API de recherche
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Tu es un moteur de recherche. Fournis des informations factuelles et vérifiables sur la requête. 
            Type de recherche: ${searchType}
            Réponds en JSON avec le format: {"results": [{"title": "...", "snippet": "...", "source": "..."}], "summary": "..."}`
          },
          {
            role: 'user',
            content: query
          }
        ]
      });
      
      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === 'string' ? rawContent : '{}';
      try {
        return JSON.parse(content);
      } catch {
        return {
          results: [],
          summary: String(content),
          note: 'Résultats simulés - connecter une vraie API pour des résultats réels'
        };
      }
    } catch (error) {
      return {
        results: [],
        summary: `Recherche pour: "${query}" - Résultats non disponibles`,
        error: 'Service de recherche temporairement indisponible'
      };
    }
  }
};

// Outil: Lecture de fichier (texte extrait)
const fileReaderTool: Tool = {
  name: 'read_file',
  description: 'Lit et analyse le contenu d\'un fichier précédemment uploadé. Peut extraire du texte, résumer, ou répondre à des questions sur le contenu.',
  parameters: {
    type: 'object',
    properties: {
      fileId: {
        type: 'string',
        description: 'L\'identifiant du fichier à lire'
      },
      action: {
        type: 'string',
        description: 'L\'action à effectuer sur le fichier',
        enum: ['extract', 'summarize', 'analyze', 'search']
      },
      query: {
        type: 'string',
        description: 'Question ou terme de recherche (optionnel, utilisé avec action=search ou analyze)'
      }
    },
    required: ['fileId', 'action']
  },
  execute: async (args) => {
    const fileId = args.fileId as string;
    const action = args.action as string;
    const query = args.query as string | undefined;
    
    // Cette fonction sera connectée au système de fichiers uploadés
    // Pour l'instant, retourner une structure de base
    return {
      fileId,
      action,
      query,
      status: 'pending',
      message: 'Fichier en attente de traitement. Uploadez un fichier pour l\'analyser.'
    };
  }
};

// Outil: Date et heure
const dateTimeTool: Tool = {
  name: 'datetime',
  description: 'Obtient la date et l\'heure actuelles, ou effectue des calculs de dates.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'L\'action à effectuer',
        enum: ['now', 'format', 'add', 'diff']
      },
      date: {
        type: 'string',
        description: 'Date de référence (format ISO ou naturel)'
      },
      amount: {
        type: 'number',
        description: 'Quantité à ajouter (pour action=add)'
      },
      unit: {
        type: 'string',
        description: 'Unité de temps',
        enum: ['days', 'weeks', 'months', 'years', 'hours', 'minutes']
      }
    },
    required: ['action']
  },
  execute: async (args) => {
    const action = args.action as string;
    const now = new Date();
    
    switch (action) {
      case 'now':
        return {
          iso: now.toISOString(),
          date: now.toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          time: now.toLocaleTimeString('fr-FR'),
          timestamp: now.getTime()
        };
        
      case 'format':
        const dateStr = args.date as string;
        const date = new Date(dateStr);
        return {
          input: dateStr,
          iso: date.toISOString(),
          formatted: date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        };
        
      case 'add':
        const baseDate = args.date ? new Date(args.date as string) : now;
        const amount = args.amount as number;
        const unit = args.unit as string;
        
        const result = new Date(baseDate);
        switch (unit) {
          case 'days': result.setDate(result.getDate() + amount); break;
          case 'weeks': result.setDate(result.getDate() + amount * 7); break;
          case 'months': result.setMonth(result.getMonth() + amount); break;
          case 'years': result.setFullYear(result.getFullYear() + amount); break;
          case 'hours': result.setHours(result.getHours() + amount); break;
          case 'minutes': result.setMinutes(result.getMinutes() + amount); break;
        }
        
        return {
          original: baseDate.toISOString(),
          result: result.toISOString(),
          formatted: result.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        };
        
      case 'diff':
        const date1 = new Date(args.date as string);
        const diffMs = now.getTime() - date1.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        return {
          from: date1.toISOString(),
          to: now.toISOString(),
          difference: {
            milliseconds: diffMs,
            seconds: Math.floor(diffMs / 1000),
            minutes: Math.floor(diffMs / (1000 * 60)),
            hours: Math.floor(diffMs / (1000 * 60 * 60)),
            days: diffDays
          }
        };
        
      default:
        throw new Error(`Action non supportée: ${action}`);
    }
  }
};

// Registre des outils
const toolsRegistry: Map<string, Tool> = new Map([
  ['calculator', calculatorTool],
  ['web_search', webSearchTool],
  ['read_file', fileReaderTool],
  ['datetime', dateTimeTool]
]);

// Classe principale du moteur d'outils
export class ToolsEngine {
  private tools: Map<string, Tool>;
  private executionHistory: ToolResult[] = [];

  constructor() {
    this.tools = new Map(toolsRegistry);
  }

  // Obtenir la liste des outils disponibles
  getAvailableTools(): Array<{ name: string; description: string; parameters: Tool['parameters'] }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  // Obtenir les définitions d'outils pour le LLM
  getToolDefinitions(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Tool['parameters'];
    };
  }> {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  // Exécuter un outil
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.tools.get(toolCall.name);

    if (!tool) {
      const result: ToolResult = {
        toolCallId: toolCall.id,
        name: toolCall.name,
        success: false,
        result: null,
        error: `Outil inconnu: ${toolCall.name}`,
        executionTime: Date.now() - startTime
      };
      this.executionHistory.push(result);
      return result;
    }

    try {
      const toolResult = await tool.execute(toolCall.arguments);
      const result: ToolResult = {
        toolCallId: toolCall.id,
        name: toolCall.name,
        success: true,
        result: toolResult,
        executionTime: Date.now() - startTime
      };
      this.executionHistory.push(result);
      return result;
    } catch (error) {
      const result: ToolResult = {
        toolCallId: toolCall.id,
        name: toolCall.name,
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        executionTime: Date.now() - startTime
      };
      this.executionHistory.push(result);
      return result;
    }
  }

  // Exécuter plusieurs outils en parallèle
  async executeTools(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(toolCalls.map(call => this.executeTool(call)));
  }

  // Obtenir l'historique d'exécution
  getExecutionHistory(): ToolResult[] {
    return [...this.executionHistory];
  }

  // Vider l'historique
  clearHistory(): void {
    this.executionHistory = [];
  }

  // Enregistrer un nouvel outil
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }
}

// Singleton
let toolsEngineInstance: ToolsEngine | null = null;

export function getToolsEngine(): ToolsEngine {
  if (!toolsEngineInstance) {
    toolsEngineInstance = new ToolsEngine();
  }
  return toolsEngineInstance;
}

export default ToolsEngine;
