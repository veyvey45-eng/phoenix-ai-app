/**
 * Phoenix File Processor
 * Gestion de l'upload et de l'extraction de contenu des fichiers
 * Persistance en base de données pour survivre aux redémarrages
 */

import { storagePut } from '../storage';
import { nanoid } from 'nanoid';
import { getDb } from '../db';
import { userFiles } from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';

// Types pour les fichiers
export interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageUrl: string;
  storageKey: string;
  extractedText?: string;
  metadata?: Record<string, unknown>;
  uploadedAt: Date;
  userId: number;
}

export interface FileExtractionResult {
  success: boolean;
  text?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  pageCount?: number;
  wordCount?: number;
}

// Types MIME supportés
const SUPPORTED_MIME_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
  'text/csv': ['.csv'],
  'application/json': ['.json'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp']
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Classe principale du processeur de fichiers
export class FileProcessor {
  // Cache en mémoire pour les fichiers récemment accédés
  private fileCache: Map<string, UploadedFile> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // Vérifier si le type MIME est supporté
  isSupportedType(mimeType: string): boolean {
    return Object.keys(SUPPORTED_MIME_TYPES).includes(mimeType);
  }

  // Obtenir les types supportés
  getSupportedTypes(): string[] {
    return Object.keys(SUPPORTED_MIME_TYPES);
  }

  // Obtenir les extensions supportées
  getSupportedExtensions(): string[] {
    return Object.values(SUPPORTED_MIME_TYPES).flat();
  }

  // Valider un fichier avant upload
  validateFile(file: { name: string; size: number; type: string }): { valid: boolean; error?: string } {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `Fichier trop volumineux. Taille maximale: ${MAX_FILE_SIZE / 1024 / 1024}MB` };
    }

    if (!this.isSupportedType(file.type)) {
      return { valid: false, error: `Type de fichier non supporté: ${file.type}. Types supportés: ${this.getSupportedExtensions().join(', ')}` };
    }

    return { valid: true };
  }

  // Uploader un fichier
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: number
  ): Promise<UploadedFile> {
    const fileId = nanoid();
    const extension = fileName.split('.').pop() || '';
    const storageKey = `phoenix-files/${userId}/${fileId}.${extension}`;

    // Upload vers S3
    const { url } = await storagePut(storageKey, fileBuffer, mimeType);

    // Extraire le texte si possible
    const extraction = await this.extractText(fileBuffer, mimeType, fileName);

    const uploadedFile: UploadedFile = {
      id: fileId,
      originalName: fileName,
      mimeType,
      size: fileBuffer.length,
      storageUrl: url,
      storageKey,
      extractedText: extraction.text,
      metadata: extraction.metadata,
      uploadedAt: new Date(),
      userId
    };

    // Sauvegarder en base de données
    const db = await getDb();
    if (db) {
      await db.insert(userFiles).values({
      id: fileId,
      userId,
      originalName: fileName,
      mimeType,
      size: fileBuffer.length,
      storageUrl: url,
      storageKey,
      extractedText: extraction.text || null,
      metadata: extraction.metadata || null,
      });
    }

    // Mettre en cache
    this.fileCache.set(fileId, uploadedFile);
    
    console.log(`[FileProcessor] File uploaded and saved to DB: ${fileId} (${fileName})`);
    return uploadedFile;
  }

  // Extraire le texte d'un fichier
  async extractText(
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<FileExtractionResult> {
    try {
      switch (mimeType) {
        case 'text/plain':
        case 'text/markdown':
        case 'text/csv':
          return this.extractFromText(fileBuffer);

        case 'application/json':
          return this.extractFromJson(fileBuffer);

        case 'application/pdf':
          return this.extractFromPdf(fileBuffer);

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return this.extractFromDocx(fileBuffer);

        case 'image/png':
        case 'image/jpeg':
        case 'image/gif':
        case 'image/webp':
          return this.extractFromImage(fileBuffer, mimeType);

        default:
          return {
            success: false,
            error: `Extraction non supportée pour le type: ${mimeType}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de l'extraction: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Extraction depuis fichier texte
  private extractFromText(buffer: Buffer): FileExtractionResult {
    const text = buffer.toString('utf-8');
    return {
      success: true,
      text,
      wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
      metadata: {
        type: 'text',
        encoding: 'utf-8'
      }
    };
  }

  // Extraction depuis JSON
  private extractFromJson(buffer: Buffer): FileExtractionResult {
    try {
      const content = buffer.toString('utf-8');
      const parsed = JSON.parse(content);
      const text = JSON.stringify(parsed, null, 2);
      
      return {
        success: true,
        text,
        metadata: {
          type: 'json',
          keys: Object.keys(parsed),
          isArray: Array.isArray(parsed)
        }
      };
    } catch {
      return {
        success: false,
        error: 'JSON invalide'
      };
    }
  }

  // Extraction depuis PDF - utilise le module robuste avec fallbacks multiples
  private async extractFromPdf(buffer: Buffer): Promise<FileExtractionResult> {
    try {
      console.log('[FileProcessor] Starting PDF extraction, buffer size:', buffer.length);
      
      // Use the robust extractor with multiple fallback methods
      const { extractPDFTextRobust } = await import('./pdfExtractorRobust');
      const extracted = await extractPDFTextRobust(buffer);
      
      console.log('[FileProcessor] PDF extraction result:', {
        textLength: extracted.text.length,
        pages: extracted.pages,
        method: extracted.extractionMethod,
        confidence: extracted.confidence
      });
      
      // Check if extraction was successful
      if (extracted.confidence === 0) {
        console.warn('[FileProcessor] PDF extraction had low confidence');
      }
      
      return {
        success: true,
        text: extracted.text,
        pageCount: extracted.pages,
        wordCount: extracted.text.split(/\s+/).filter(w => w.length > 0).length,
        metadata: {
          type: 'pdf',
          pages: extracted.pages,
          title: extracted.metadata.title,
          author: extracted.metadata.author,
          subject: extracted.metadata.subject,
          extractionMethod: extracted.extractionMethod,
          confidence: extracted.confidence
        }
      };
    } catch (error) {
      console.error('[FileProcessor] PDF extraction error:', error);
      return {
        success: false,
        error: `Erreur lors de l'extraction du PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Extraction depuis DOCX (simplifiée)
  private async extractFromDocx(buffer: Buffer): Promise<FileExtractionResult> {
    try {
      const content = buffer.toString('utf-8');
      
      const textMatches = content.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      
      if (textMatches) {
        const text = textMatches
          .map(m => m.replace(/<[^>]+>/g, ''))
          .join(' ')
          .trim();
        
        return {
          success: true,
          text,
          wordCount: text.split(/\s+/).length,
          metadata: {
            type: 'docx',
            extractionMethod: 'basic'
          }
        };
      }

      return {
        success: true,
        text: '[Document Word - extraction avancée requise]',
        metadata: {
          type: 'docx',
          note: 'Utilisez un format texte pour une meilleure extraction.'
        }
      };
    } catch {
      return {
        success: false,
        error: 'Erreur lors de l\'extraction du document Word'
      };
    }
  }

  // Extraction depuis image (placeholder pour OCR)
  private async extractFromImage(buffer: Buffer, mimeType: string): Promise<FileExtractionResult> {
    return {
      success: true,
      text: '[Image uploadée - OCR non disponible dans cette version]',
      metadata: {
        type: 'image',
        mimeType,
        size: buffer.length,
        note: 'L\'OCR (reconnaissance de texte) sera disponible dans une version future.'
      }
    };
  }

  // Obtenir un fichier par ID (depuis DB ou cache)
  async getFile(fileId: string): Promise<UploadedFile | undefined> {
    // Vérifier le cache d'abord
    if (this.fileCache.has(fileId)) {
      return this.fileCache.get(fileId);
    }

    // Sinon, charger depuis la DB
    try {
      const db = await getDb();
      if (!db) return undefined;
      
      const [dbFile] = await db.select().from(userFiles).where(eq(userFiles.id, fileId)).limit(1);
      
      if (!dbFile) {
        return undefined;
      }

      const uploadedFile: UploadedFile = {
        id: dbFile.id,
        originalName: dbFile.originalName,
        mimeType: dbFile.mimeType,
        size: dbFile.size,
        storageUrl: dbFile.storageUrl,
        storageKey: dbFile.storageKey,
        extractedText: dbFile.extractedText || undefined,
        metadata: dbFile.metadata as Record<string, unknown> || undefined,
        uploadedAt: dbFile.createdAt,
        userId: dbFile.userId
      };

      // Mettre en cache
      this.fileCache.set(fileId, uploadedFile);
      
      return uploadedFile;
    } catch (error) {
      console.error('[FileProcessor] Error loading file from DB:', error);
      return undefined;
    }
  }

  // Obtenir tous les fichiers d'un utilisateur (depuis DB)
  async getUserFiles(userId: number): Promise<UploadedFile[]> {
    try {
      const db = await getDb();
      if (!db) return [];
      
      const dbFiles = await db.select()
        .from(userFiles)
        .where(eq(userFiles.userId, userId))
        .orderBy(desc(userFiles.createdAt));

      return dbFiles.map(dbFile => ({
        id: dbFile.id,
        originalName: dbFile.originalName,
        mimeType: dbFile.mimeType,
        size: dbFile.size,
        storageUrl: dbFile.storageUrl,
        storageKey: dbFile.storageKey,
        extractedText: dbFile.extractedText || undefined,
        metadata: dbFile.metadata as Record<string, unknown> || undefined,
        uploadedAt: dbFile.createdAt,
        userId: dbFile.userId
      }));
    } catch (error) {
      console.error('[FileProcessor] Error loading user files from DB:', error);
      return [];
    }
  }

  // Supprimer un fichier
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const db = await getDb();
      if (!db) return false;
      
      await db.delete(userFiles).where(eq(userFiles.id, fileId));
      this.fileCache.delete(fileId);
      console.log(`[FileProcessor] File deleted: ${fileId}`);
      return true;
    } catch (error) {
      console.error('[FileProcessor] Error deleting file:', error);
      return false;
    }
  }

  // Rechercher dans les fichiers
  async searchInFiles(userId: number, query: string): Promise<Array<{ file: UploadedFile; matches: string[] }>> {
    const results: Array<{ file: UploadedFile; matches: string[] }> = [];
    const queryLower = query.toLowerCase();

    const files = await this.getUserFiles(userId);
    
    for (const file of files) {
      if (!file.extractedText) continue;

      const textLower = file.extractedText.toLowerCase();
      if (textLower.includes(queryLower)) {
        const matches: string[] = [];
        let index = textLower.indexOf(queryLower);
        
        while (index !== -1 && matches.length < 3) {
          const start = Math.max(0, index - 50);
          const end = Math.min(file.extractedText.length, index + query.length + 50);
          matches.push('...' + file.extractedText.slice(start, end) + '...');
          index = textLower.indexOf(queryLower, index + 1);
        }

        results.push({ file, matches });
      }
    }

    return results;
  }

  // Vider le cache
  clearCache(): void {
    this.fileCache.clear();
  }
}

// Singleton
let fileProcessorInstance: FileProcessor | null = null;

export function getFileProcessor(): FileProcessor {
  if (!fileProcessorInstance) {
    fileProcessorInstance = new FileProcessor();
  }
  return fileProcessorInstance;
}

export default FileProcessor;
