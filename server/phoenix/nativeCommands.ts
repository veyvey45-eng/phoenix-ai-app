/**
 * Native Commands Module
 * Gère les commandes natives: /code, /search, /browse
 * Permet à Phoenix de déclencher l'exécution réelle directement
 */

import { RealExecutor } from './realExecutor';
import { invokeLLM } from '../_core/llm';

export type CommandType = 'code' | 'search' | 'browse' | 'generate' | 'analyze';

export interface NativeCommand {
  type: CommandType;
  content: string;
  language?: 'python' | 'javascript';
  userId: number;
  username: string;
}

export interface CommandResult {
  success: boolean;
  result: string;
  executionTime: number;
  error?: string;
  command: CommandType;
}

/**
 * Détecte et extrait les commandes natives du message
 * Patterns supportés:
 * - /code python: print("hello")
 * - /search: dernières nouvelles sur l'IA
 * - /browse: https://example.com
 * - /generate: créer une fonction Fibonacci
 * - /analyze: analyser ce code
 */
export function detectNativeCommand(message: string): NativeCommand | null {
  const codeMatch = message.match(/^\/code\s+(\w+):\s*([\s\S]+)$/i);
  if (codeMatch) {
    return {
      type: 'code',
      language: codeMatch[1].toLowerCase() as 'python' | 'javascript',
      content: codeMatch[2].trim(),
      userId: 0,
      username: 'Phoenix'
    };
  }

  const searchMatch = message.match(/^\/search:\s*([\s\S]+)$/i);
  if (searchMatch) {
    return {
      type: 'search',
      content: searchMatch[1].trim(),
      userId: 0,
      username: 'Phoenix'
    };
  }

  const browseMatch = message.match(/^\/browse:\s*([\s\S]+)$/i);
  if (browseMatch) {
    return {
      type: 'browse',
      content: browseMatch[1].trim(),
      userId: 0,
      username: 'Phoenix'
    };
  }

  const generateMatch = message.match(/^\/generate:\s*([\s\S]+)$/i);
  if (generateMatch) {
    return {
      type: 'generate',
      content: generateMatch[1].trim(),
      userId: 0,
      username: 'Phoenix'
    };
  }

  const analyzeMatch = message.match(/^\/analyze:\s*([\s\S]+)$/i);
  if (analyzeMatch) {
    return {
      type: 'analyze',
      content: analyzeMatch[1].trim(),
      userId: 0,
      username: 'Phoenix'
    };
  }

  return null;
}

/**
 * Exécute une commande native
 */
export async function executeNativeCommand(command: NativeCommand): Promise<CommandResult> {
  const startTime = Date.now();

  try {
    switch (command.type) {
      case 'code':
        return await executeCodeCommand(command, startTime);

      case 'search':
        return await executeSearchCommand(command, startTime);

      case 'browse':
        return await executeBrowseCommand(command, startTime);

      case 'generate':
        return await executeGenerateCommand(command, startTime);

      case 'analyze':
        return await executeAnalyzeCommand(command, startTime);

      default:
        return {
          success: false,
          result: 'Commande inconnue',
          executionTime: Date.now() - startTime,
          command: command.type
        };
    }
  } catch (error) {
    return {
      success: false,
      result: '',
      executionTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      command: command.type
    };
  }
}

/**
 * Exécute une commande /code
 */
async function executeCodeCommand(command: NativeCommand, startTime: number): Promise<CommandResult> {
  const result = await RealExecutor.execute({
    type: 'code',
    language: command.language || 'python',
    content: command.content,
    userId: command.userId,
    username: command.username
  });

  return {
    success: result.success,
    result: result.result,
    executionTime: Date.now() - startTime,
    error: result.error,
    command: 'code'
  };
}

/**
 * Exécute une commande /search
 */
async function executeSearchCommand(command: NativeCommand, startTime: number): Promise<CommandResult> {
  const result = await RealExecutor.execute({
    type: 'search',
    content: command.content,
    userId: command.userId,
    username: command.username
  });

  return {
    success: result.success,
    result: result.result,
    executionTime: Date.now() - startTime,
    error: result.error,
    command: 'search'
  };
}

/**
 * Exécute une commande /browse
 */
async function executeBrowseCommand(command: NativeCommand, startTime: number): Promise<CommandResult> {
  const result = await RealExecutor.execute({
    type: 'browse',
    content: command.content,
    userId: command.userId,
    username: command.username
  });

  return {
    success: result.success,
    result: result.result,
    executionTime: Date.now() - startTime,
    error: result.error,
    command: 'browse'
  };
}

/**
 * Exécute une commande /generate
 */
async function executeGenerateCommand(command: NativeCommand, startTime: number): Promise<CommandResult> {
  const result = await RealExecutor.execute({
    type: 'generate',
    language: 'python',
    content: command.content,
    userId: command.userId,
    username: command.username
  });

  return {
    success: result.success,
    result: result.result,
    executionTime: Date.now() - startTime,
    error: result.error,
    command: 'generate'
  };
}

/**
 * Exécute une commande /analyze
 */
async function executeAnalyzeCommand(command: NativeCommand, startTime: number): Promise<CommandResult> {
  // Analyse le code avec LLM
  const analysis = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: 'Tu es un expert en analyse de code. Analyse le code fourni et explique ce qu\'il fait, ses points forts et ses faiblesses.'
      },
      {
        role: 'user',
        content: `Analyse ce code:\n\n${command.content}`
      }
    ]
  });

  const analysisContent = analysis.choices[0]?.message?.content;
  const analysisText = typeof analysisContent === 'string' ? analysisContent : 'Analyse impossible';

  return {
    success: true,
    result: analysisText,
    executionTime: Date.now() - startTime,
    command: 'analyze'
  };
}

/**
 * Formatte une commande pour affichage
 */
export function formatCommand(command: NativeCommand): string {
  switch (command.type) {
    case 'code':
      return `\`\`\`${command.language}\n${command.content}\n\`\`\``;
    case 'search':
      return `🔍 Recherche: ${command.content}`;
    case 'browse':
      return `🌐 Navigation: ${command.content}`;
    case 'generate':
      return `⚙️ Génération: ${command.content}`;
    case 'analyze':
      return `📊 Analyse: ${command.content}`;
    default:
      return command.content;
  }
}

/**
 * Formatte un résultat pour affichage
 */
export function formatResult(result: CommandResult): string {
  if (!result.success && result.error) {
    return `❌ Erreur (${result.command}): ${result.error}\nTemps: ${result.executionTime}ms`;
  }

  return `✅ Résultat (${result.command}):\n${result.result}\n\nTemps: ${result.executionTime}ms`;
}
