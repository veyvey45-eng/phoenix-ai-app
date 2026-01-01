/**
 * Phoenix File Processor
 * Gestion de l'upload et de l'extraction de contenu des fichiers
 */

import { storagePut } from '../storage';
import { nanoid } from 'nanoid';

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
  private uploadedFiles: Map<string, UploadedFile> = new Map();

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

    this.uploadedFiles.set(fileId, uploadedFile);
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
        error: error instanceof Error ? error.message : 'Erreur d\'extraction'
      };
    }
  }

  // Extraction depuis fichier texte
  private extractFromText(buffer: Buffer): FileExtractionResult {
    const text = buffer.toString('utf-8');
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    return {
      success: true,
      text,
      wordCount,
      metadata: {
        encoding: 'utf-8',
        lineCount: text.split('\n').length
      }
    };
  }

  // Extraction depuis JSON
  private extractFromJson(buffer: Buffer): FileExtractionResult {
    const text = buffer.toString('utf-8');
    try {
      const parsed = JSON.parse(text);
      const prettyText = JSON.stringify(parsed, null, 2);
      
      return {
        success: true,
        text: prettyText,
        wordCount: prettyText.split(/\s+/).length,
        metadata: {
          type: 'json',
          keys: typeof parsed === 'object' ? Object.keys(parsed) : []
        }
      };
    } catch {
      return {
        success: true,
        text,
        metadata: { type: 'invalid-json' }
      };
    }
  }

  // Extraction depuis PDF (simplifiée - en production utiliser pdf-parse)
  private async extractFromPdf(buffer: Buffer): Promise<FileExtractionResult> {
    // Pour le MVP, on retourne un placeholder
    // En production, utiliser pdf-parse ou pdfjs-dist
    try {
      // Vérifier que c'est bien un PDF (magic bytes)
      const header = buffer.slice(0, 5).toString('ascii');
      if (header !== '%PDF-') {
        return {
          success: false,
          error: 'Fichier PDF invalide'
        };
      }

      // Extraction basique du texte brut (très simplifiée)
      const content = buffer.toString('latin1');
      
      // Chercher les streams de texte
      const textMatches: string[] = [];
      const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
      let match;
      
      while ((match = streamRegex.exec(content)) !== null) {
        // Extraire le texte visible (très basique)
        const streamContent = match[1];
        const textParts = streamContent.match(/\(([^)]+)\)/g);
        if (textParts) {
          textMatches.push(...textParts.map(p => p.slice(1, -1)));
        }
      }

      const extractedText = textMatches.join(' ').replace(/\\[nrt]/g, ' ').trim();
      
      if (extractedText.length > 0) {
        return {
          success: true,
          text: extractedText,
          wordCount: extractedText.split(/\s+/).length,
          metadata: {
            type: 'pdf',
            extractionMethod: 'basic'
          }
        };
      }

      return {
        success: true,
        text: '[Contenu PDF - extraction avancée requise pour ce document]',
        metadata: {
          type: 'pdf',
          note: 'Le PDF contient probablement des images ou du texte encodé. Une extraction avancée serait nécessaire.'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Erreur lors de l\'extraction du PDF'
      };
    }
  }

  // Extraction depuis DOCX (simplifiée)
  private async extractFromDocx(buffer: Buffer): Promise<FileExtractionResult> {
    // Pour le MVP, extraction basique
    // En production, utiliser mammoth ou docx
    try {
      const content = buffer.toString('utf-8');
      
      // DOCX est un ZIP, chercher le contenu XML
      // Extraction très basique des textes entre balises
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
    // Pour le MVP, retourner un placeholder
    // En production, utiliser Tesseract.js ou une API OCR
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

  // Obtenir un fichier par ID
  getFile(fileId: string): UploadedFile | undefined {
    return this.uploadedFiles.get(fileId);
  }

  // Obtenir tous les fichiers d'un utilisateur
  getUserFiles(userId: number): UploadedFile[] {
    return Array.from(this.uploadedFiles.values())
      .filter(f => f.userId === userId)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  // Supprimer un fichier
  deleteFile(fileId: string): boolean {
    return this.uploadedFiles.delete(fileId);
  }

  // Rechercher dans les fichiers
  searchInFiles(userId: number, query: string): Array<{ file: UploadedFile; matches: string[] }> {
    const results: Array<{ file: UploadedFile; matches: string[] }> = [];
    const queryLower = query.toLowerCase();

    for (const file of this.getUserFiles(userId)) {
      if (!file.extractedText) continue;

      const textLower = file.extractedText.toLowerCase();
      if (textLower.includes(queryLower)) {
        // Extraire les contextes autour des matches
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
