/**
 * Persistent State Manager
 * Maintient l'état global entre les exécutions de code
 * Permet à Phoenix de créer des fichiers persistants et des variables de session
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface SessionState {
  userId: string;
  sessionId: string;
  variables: Map<string, any>;
  files: Map<string, string>; // filename -> filepath
  createdAt: number;
  lastUpdated: number;
}

class PersistentStateManager {
  private sessions: Map<string, SessionState> = new Map();
  private stateDir: string;
  private maxSessions: number = 100;

  constructor() {
    this.stateDir = path.join(os.tmpdir(), 'phoenix-state');
    
    // Créer le répertoire de stockage
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
    
    // Charger les sessions existantes
    this.loadSessions();
    
    console.log('[PersistentState] Initialized with', this.sessions.size, 'sessions');
  }

  /**
   * Créer ou récupérer une session
   */
  getSession(userId: string, sessionId: string): SessionState {
    const key = `${userId}:${sessionId}`;
    
    if (this.sessions.has(key)) {
      const session = this.sessions.get(key)!;
      session.lastUpdated = Date.now();
      return session;
    }
    
    // Créer une nouvelle session
    const session: SessionState = {
      userId,
      sessionId,
      variables: new Map(),
      files: new Map(),
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };
    
    this.sessions.set(key, session);
    
    // Nettoyer les anciennes sessions si nécessaire
    if (this.sessions.size > this.maxSessions) {
      this.cleanupOldSessions();
    }
    
    console.log('[PersistentState] Created new session:', key);
    
    return session;
  }

  /**
   * Stocker une variable dans la session
   */
  setVariable(userId: string, sessionId: string, varName: string, value: any): void {
    const session = this.getSession(userId, sessionId);
    session.variables.set(varName, value);
    session.lastUpdated = Date.now();
    
    console.log('[PersistentState] Set variable:', varName, 'in session:', `${userId}:${sessionId}`);
  }

  /**
   * Récupérer une variable de la session
   */
  getVariable(userId: string, sessionId: string, varName: string): any {
    const session = this.getSession(userId, sessionId);
    return session.variables.get(varName);
  }

  /**
   * Obtenir toutes les variables de la session
   */
  getAllVariables(userId: string, sessionId: string): Record<string, any> {
    const session = this.getSession(userId, sessionId);
    const result: Record<string, any> = {};
    
    session.variables.forEach((value, key) => {
      result[key] = value;
    });
    
    return result;
  }

  /**
   * Créer un fichier persistant dans la session
   */
  createFile(userId: string, sessionId: string, filename: string, content: string): string {
    const session = this.getSession(userId, sessionId);
    
    // Créer un répertoire pour la session
    const sessionDir = path.join(this.stateDir, `${userId}-${sessionId}`);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // Créer le fichier
    const filePath = path.join(sessionDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    
    // Enregistrer dans la session
    session.files.set(filename, filePath);
    session.lastUpdated = Date.now();
    
    console.log('[PersistentState] Created file:', filePath);
    
    return filePath;
  }

  /**
   * Lire un fichier persistant de la session
   */
  readFile(userId: string, sessionId: string, filename: string): string | null {
    const session = this.getSession(userId, sessionId);
    
    const filePath = session.files.get(filename);
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }
    
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Lister tous les fichiers de la session
   */
  listFiles(userId: string, sessionId: string): string[] {
    const session = this.getSession(userId, sessionId);
    return Array.from(session.files.keys());
  }

  /**
   * Supprimer un fichier de la session
   */
  deleteFile(userId: string, sessionId: string, filename: string): boolean {
    const session = this.getSession(userId, sessionId);
    
    const filePath = session.files.get(filename);
    if (!filePath) {
      return false;
    }
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      session.files.delete(filename);
      session.lastUpdated = Date.now();
      
      console.log('[PersistentState] Deleted file:', filePath);
      
      return true;
    } catch (error) {
      console.error('[PersistentState] Error deleting file:', error);
      return false;
    }
  }

  /**
   * Obtenir le chemin d'un fichier persistant
   */
  getFilePath(userId: string, sessionId: string, filename: string): string | null {
    const session = this.getSession(userId, sessionId);
    return session.files.get(filename) || null;
  }

  /**
   * Exporter l'état de la session
   */
  exportSession(userId: string, sessionId: string): Record<string, any> {
    const session = this.getSession(userId, sessionId);
    
    const variables: Record<string, any> = {};
    session.variables.forEach((value, key) => {
      variables[key] = value;
    });
    
    const files: Record<string, string> = {};
    session.files.forEach((filePath, filename) => {
      files[filename] = filePath;
    });
    
    return {
      userId: session.userId,
      sessionId: session.sessionId,
      variables,
      files,
      createdAt: session.createdAt,
      lastUpdated: session.lastUpdated,
    };
  }

  /**
   * Nettoyer les anciennes sessions
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 heures
    
    let cleaned = 0;
    this.sessions.forEach((session, key) => {
      if (now - session.lastUpdated > maxAge) {
        this.deleteSession(session.userId, session.sessionId);
        cleaned++;
      }
    });
    
    console.log('[PersistentState] Cleaned up', cleaned, 'old sessions');
  }

  /**
   * Supprimer une session complète
   */
  deleteSession(userId: string, sessionId: string): void {
    const key = `${userId}:${sessionId}`;
    const session = this.sessions.get(key);
    
    if (!session) {
      return;
    }
    
    // Supprimer tous les fichiers
    session.files.forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error('[PersistentState] Error deleting file:', error);
      }
    });
    
    // Supprimer le répertoire de la session
    const sessionDir = path.join(this.stateDir, `${userId}-${sessionId}`);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true });
      }
    } catch (error) {
      console.error('[PersistentState] Error deleting session directory:', error);
    }
    
    this.sessions.delete(key);
    
    console.log('[PersistentState] Deleted session:', key);
  }

  /**
   * Charger les sessions existantes
   */
  private loadSessions(): void {
    try {
      if (!fs.existsSync(this.stateDir)) {
        return;
      }
      
      const entries = fs.readdirSync(this.stateDir);
      for (const entry of entries) {
        const match = entry.match(/^(.+)-(.+)$/);
        if (match) {
          const [, userId, sessionId] = match;
          this.getSession(userId, sessionId);
        }
      }
    } catch (error) {
      console.error('[PersistentState] Error loading sessions:', error);
    }
  }

  /**
   * Obtenir les statistiques
   */
  getStats(): Record<string, any> {
    const sessions: any[] = [];
    this.sessions.forEach((s) => {
      sessions.push({
        userId: s.userId,
        sessionId: s.sessionId,
        variablesCount: s.variables.size,
        filesCount: s.files.size,
        createdAt: s.createdAt,
        lastUpdated: s.lastUpdated,
      });
    });
    
    return {
      totalSessions: this.sessions.size,
      stateDir: this.stateDir,
      sessions,
    };
  }
}

// Export singleton instance
export const persistentState = new PersistentStateManager();
