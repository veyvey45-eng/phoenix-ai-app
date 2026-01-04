/**
 * Execution History Service - Gestion de l'historique des exécutions E2B
 */

import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

export interface ExecutionRecord {
  id: string;
  userId: number;
  conversationId?: string;
  sandboxId: string;
  language: 'python' | 'node' | 'shell';
  code: string;
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  duration: number;
  startedAt: Date;
  completedAt: Date;
  fileInputs?: string[];
  fileOutputs?: string[];
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface ExecutionQuery {
  userId: number;
  conversationId?: string;
  language?: 'python' | 'node' | 'shell';
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

export class ExecutionHistoryService {
  private records: Map<string, ExecutionRecord> = new Map();
  private userRecords: Map<number, string[]> = new Map();

  constructor() {
    console.log('[ExecutionHistoryService] Initialized');
  }

  /**
   * Enregistrer une exécution
   */
  recordExecution(
    userId: number,
    conversationId: string | undefined,
    sandboxId: string,
    language: 'python' | 'node' | 'shell',
    code: string,
    success: boolean,
    stdout: string | undefined,
    stderr: string | undefined,
    exitCode: number | undefined,
    duration: number,
    fileInputs?: string[],
    fileOutputs?: string[],
    metadata?: Record<string, any>
  ): ExecutionRecord {
    const id = randomUUID();
    const now = new Date();

    const record: ExecutionRecord = {
      id,
      userId,
      conversationId,
      sandboxId,
      language,
      code,
      success,
      stdout,
      stderr,
      exitCode,
      duration,
      startedAt: new Date(now.getTime() - duration),
      completedAt: now,
      fileInputs,
      fileOutputs,
      metadata,
      tags: this.extractTags(code, language),
    };

    this.records.set(id, record);

    // Ajouter à l'index utilisateur
    if (!this.userRecords.has(userId)) {
      this.userRecords.set(userId, []);
    }
    this.userRecords.get(userId)!.unshift(id);

    // Garder seulement les 1000 derniers enregistrements par utilisateur
    const userIds = this.userRecords.get(userId)!;
    if (userIds.length > 1000) {
      const toDelete = userIds.splice(1000);
      toDelete.forEach(recordId => this.records.delete(recordId));
    }

    console.log('[ExecutionHistoryService] Execution recorded:', {
      id,
      userId,
      language,
      success,
      duration,
    });

    return record;
  }

  /**
   * Récupérer l'historique d'un utilisateur
   */
  getHistory(query: ExecutionQuery): ExecutionRecord[] {
    const recordIds = this.userRecords.get(query.userId) || [];
    let results = recordIds
      .map(id => this.records.get(id)!)
      .filter(r => r !== undefined);

    // Filtrer par conversation
    if (query.conversationId) {
      results = results.filter(r => r.conversationId === query.conversationId);
    }

    // Filtrer par langage
    if (query.language) {
      results = results.filter(r => r.language === query.language);
    }

    // Filtrer par date
    if (query.startDate) {
      results = results.filter(r => r.startedAt >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter(r => r.completedAt <= query.endDate!);
    }

    // Pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;

    return results.slice(offset, offset + limit);
  }

  /**
   * Récupérer une exécution spécifique
   */
  getExecution(id: string): ExecutionRecord | null {
    return this.records.get(id) || null;
  }

  /**
   * Récupérer les exécutions récentes
   */
  getRecentExecutions(userId: number, limit: number = 20): ExecutionRecord[] {
    const recordIds = this.userRecords.get(userId) || [];
    return recordIds
      .slice(0, limit)
      .map(id => this.records.get(id)!)
      .filter(r => r !== undefined);
  }

  /**
   * Récupérer les statistiques
   */
  getStatistics(userId: number): Record<string, any> {
    const records = this.getHistory({ userId });

    const stats = {
      totalExecutions: records.length,
      successfulExecutions: records.filter(r => r.success).length,
      failedExecutions: records.filter(r => !r.success).length,
      totalDuration: records.reduce((sum, r) => sum + r.duration, 0),
      averageDuration: records.length > 0 ? records.reduce((sum, r) => sum + r.duration, 0) / records.length : 0,
      byLanguage: {
        python: records.filter(r => r.language === 'python').length,
        node: records.filter(r => r.language === 'node').length,
        shell: records.filter(r => r.language === 'shell').length,
      },
      successRate: records.length > 0 ? records.filter(r => r.success).length / records.length : 0,
      topTags: this.getTopTags(records),
      recentErrors: records.filter(r => !r.success).slice(0, 5),
    };

    return stats;
  }

  /**
   * Extraire les tags du code
   */
  private extractTags(code: string, language: string): string[] {
    const tags: Set<string> = new Set();

    // Ajouter le langage
    tags.add(`lang:${language}`);

    // Détecter les patterns courants
    if (code.includes('import pandas') || code.includes('import numpy')) {
      tags.add('data_analysis');
    }
    if (code.includes('requests') || code.includes('BeautifulSoup')) {
      tags.add('web_scraping');
    }
    if (code.includes('matplotlib') || code.includes('plt.')) {
      tags.add('visualization');
    }
    if (code.includes('import tensorflow') || code.includes('import torch')) {
      tags.add('ml_training');
    }
    if (code.includes('async ') || code.includes('await ')) {
      tags.add('async');
    }
    if (code.includes('def ') || code.includes('function ')) {
      tags.add('function_definition');
    }
    if (code.includes('class ')) {
      tags.add('class_definition');
    }
    if (code.includes('for ') || code.includes('while ')) {
      tags.add('loops');
    }
    if (code.includes('try:') || code.includes('try {')) {
      tags.add('error_handling');
    }

    return Array.from(tags);
  }

  /**
   * Obtenir les tags les plus utilisés
   */
  private getTopTags(records: ExecutionRecord[]): Record<string, number> {
    const tagCounts: Record<string, number> = {};

    records.forEach(record => {
      if (record.tags) {
        record.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    // Trier et retourner les 10 premiers
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce((acc, [tag, count]) => {
        acc[tag] = count;
        return acc;
      }, {} as Record<string, number>);
  }

  /**
   * Supprimer l'historique d'un utilisateur
   */
  clearHistory(userId: number): void {
    const recordIds = this.userRecords.get(userId) || [];
    recordIds.forEach(id => this.records.delete(id));
    this.userRecords.delete(userId);

    console.log('[ExecutionHistoryService] History cleared for user:', userId);
  }

  /**
   * Exporter l'historique en JSON
   */
  exportHistory(userId: number): string {
    const records = this.getHistory({ userId });
    return JSON.stringify(records, null, 2);
  }

  /**
   * Calculer le hash du code
   */
  static hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  /**
   * Obtenir les exécutions similaires
   */
  getSimilarExecutions(userId: number, codeHash: string, limit: number = 5): ExecutionRecord[] {
    const records = this.getHistory({ userId });
    const targetCode = records.find(r => ExecutionHistoryService.hashCode(r.code) === codeHash)?.code;

    if (!targetCode) return [];

    // Retourner les exécutions avec le même code
    return records
      .filter(r => ExecutionHistoryService.hashCode(r.code) === codeHash)
      .slice(0, limit);
  }
}

// Singleton global
let historyService: ExecutionHistoryService | null = null;

export function getExecutionHistoryService(): ExecutionHistoryService {
  if (!historyService) {
    historyService = new ExecutionHistoryService();
  }
  return historyService;
}
