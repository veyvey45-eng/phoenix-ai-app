import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, 
  File, 
  FileText, 
  Image, 
  X, 
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  extractedText?: string;
  uploadedAt: Date;
}

interface FileUploadProps {
  onFileUploaded?: (file: UploadedFile) => void;
  onFileSelected?: (file: UploadedFile) => void;
  maxFiles?: number;
  compact?: boolean;
}

const fileTypeIcons: Record<string, typeof File> = {
  'application/pdf': FileText,
  'text/plain': FileText,
  'text/markdown': FileText,
  'image/png': Image,
  'image/jpeg': Image,
  'image/gif': Image,
  'default': File
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ 
  onFileUploaded, 
  onFileSelected,
  maxFiles = 5,
  compact = false 
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, { progress: number; status: string }>>(new Map());
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: supportedTypes } = trpc.uploadedFiles.supportedTypes.useQuery();
  const uploadMutation = trpc.uploadedFiles.upload.useMutation();
  const deleteMutation = trpc.uploadedFiles.delete.useMutation();
  const { data: persistedFiles = [], refetch: refetchFiles, isLoading: isLoadingFiles } = trpc.uploadedFiles.list.useQuery();

  // Charger les fichiers persistés depuis la base de données
  useEffect(() => {
    if (persistedFiles && persistedFiles.length > 0) {
      setUploadedFiles(persistedFiles.map((f: { id: string | number; originalName: string; mimeType: string; size: number; hasExtractedText: boolean; uploadedAt: Date }) => ({
        id: f.id.toString(),
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.size,
        extractedText: f.hasExtractedText ? '__HAS_CONTENT__' : undefined,
        uploadedAt: new Date(f.uploadedAt)
      })));
    }
  }, [persistedFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleFiles = async (files: File[]) => {
    if (uploadedFiles.length + files.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} fichiers autorisés`);
      return;
    }

    for (const file of files) {
      // Check file type
      if (supportedTypes && !supportedTypes.mimeTypes.includes(file.type)) {
        toast.error(`Type non supporté: ${file.type}`);
        continue;
      }

      // Check file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Fichier trop volumineux: ${file.name}`);
        continue;
      }

      // Start upload
      const tempId = `temp-${Date.now()}-${file.name}`;
      setUploadingFiles(prev => new Map(prev).set(tempId, { progress: 10, status: 'Lecture du fichier...' }));

      try {
        // Convert to base64
        const base64 = await fileToBase64(file);
        setUploadingFiles(prev => new Map(prev).set(tempId, { progress: 30, status: 'Upload en cours...' }));

        // Upload
        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          mimeType: file.type,
          base64Content: base64
        });

        setUploadingFiles(prev => new Map(prev).set(tempId, { progress: 70, status: 'Extraction du contenu...' }));

        // Wait a bit for extraction to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        setUploadingFiles(prev => {
          const newMap = new Map(prev);
          newMap.delete(tempId);
          return newMap;
        });

        const uploadedFile: UploadedFile = {
          id: result.id,
          originalName: result.originalName,
          mimeType: result.mimeType,
          size: result.size,
          extractedText: result.extractedText || undefined,
          uploadedAt: new Date(result.uploadedAt)
        };

        setUploadedFiles(prev => [...prev, uploadedFile]);
        
        // Log extraction result
        console.log('[FileUpload] Upload result:', {
          id: result.id,
          name: result.originalName,
          hasExtractedText: !!result.extractedText,
          extractedTextLength: result.extractedText?.length || 0
        });

        // If we got extracted text directly, use it
        if (result.extractedText && result.extractedText.length > 0) {
          onFileUploaded?.(uploadedFile);
          onFileSelected?.(uploadedFile);
          toast.success(`${file.name} uploadé et analysé (${result.extractedText.length} caractères extraits)`);
        } else {
          // Try to load content from server
          toast.info(`${file.name} uploadé, chargement du contenu...`);
          await loadAndSelectFile(uploadedFile);
        }
        
        await refetchFiles();
      } catch (error) {
        console.error('[FileUpload] Upload error:', error);
        setUploadingFiles(prev => {
          const newMap = new Map(prev);
          newMap.delete(tempId);
          return newMap;
        });
        toast.error(`Erreur lors de l'upload de ${file.name}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeFile = async (fileId: string) => {
    try {
      await deleteMutation.mutateAsync({ fileId });
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      await refetchFiles();
      toast.success('Fichier supprimé');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const loadAndSelectFile = async (file: UploadedFile) => {
    setLoadingFileId(file.id);
    try {
      console.log('[FileUpload] Loading content for file:', file.id, file.originalName);
      const fullContent = await loadFileContent(file.id);
      console.log('[FileUpload] Content loaded:', fullContent ? `${fullContent.length} chars` : 'null');
      
      if (fullContent && fullContent.length > 0) {
        const updatedFile = { ...file, extractedText: fullContent };
        setUploadedFiles(prev => prev.map(f => 
          f.id === file.id ? updatedFile : f
        ));
        onFileSelected?.(updatedFile);
        toast.success(`${file.originalName} prêt (${fullContent.length} caractères)`);
      } else {
        console.warn('[FileUpload] No content found for file:', file.id);
        toast.warning(`Impossible d'extraire le contenu de ${file.originalName}`);
        onFileSelected?.(file);
      }
    } catch (error) {
      console.error('[FileUpload] Error loading file content:', error);
      toast.error(`Erreur lors du chargement de ${file.originalName}`);
      onFileSelected?.(file);
    } finally {
      setLoadingFileId(null);
    }
  };

  const selectFile = async (file: UploadedFile) => {
    // If already has content, use it directly
    if (file.extractedText && file.extractedText !== '__HAS_CONTENT__' && file.extractedText.length > 0) {
      onFileSelected?.(file);
      toast.success(`${file.originalName} sélectionné`);
      return;
    }
    
    // Otherwise load from server
    await loadAndSelectFile(file);
  };
  
  const loadFileContent = async (fileId: string, retries = 5): Promise<string | null> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[FileUpload] Loading file content, attempt ${attempt}/${retries}`);
        const response = await fetch(`/api/files/${fileId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: AbortSignal.timeout(15000)
        });
        
        if (!response.ok) {
          console.warn(`[FileUpload] Response not OK: ${response.status}`);
          if (attempt === retries) return null;
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        
        const fullFile = await response.json();
        console.log('[FileUpload] File response:', {
          id: fullFile.id,
          hasExtractedText: !!fullFile.extractedText,
          extractedTextLength: fullFile.extractedText?.length || 0
        });
        
        if (fullFile.extractedText && fullFile.extractedText.length > 0) {
          return fullFile.extractedText;
        }
        
        if (attempt === retries) return null;
        console.log(`[FileUpload] No content yet, waiting before retry...`);
        await new Promise(r => setTimeout(r, 1500 * attempt));
      } catch (error) {
        console.error(`[FileUpload] Attempt ${attempt} failed:`, error);
        if (attempt === retries) return null;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
    return null;
  };

  const FileIcon = (mimeType: string) => {
    return fileTypeIcons[mimeType] || fileTypeIcons['default'];
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={supportedTypes?.extensions.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          className="h-8 w-8"
        >
          <Upload className="h-4 w-4" />
        </Button>
        {uploadedFiles.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {uploadedFiles.length} fichier(s)
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-all duration-200
          ${isDragging 
            ? 'border-primary bg-primary/10' 
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={supportedTypes?.extensions.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <motion.div
          animate={{ scale: isDragging ? 1.1 : 1 }}
          className="flex flex-col items-center gap-2"
        >
          <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-sm">
            <span className="font-medium text-foreground">Cliquez pour uploader</span>
            <span className="text-muted-foreground"> ou glissez-déposez</span>
          </div>
          <p className="text-xs text-muted-foreground">
            PDF, TXT, MD, JSON, DOCX, Images (max 10MB)
          </p>
        </motion.div>
      </div>

      {/* Uploading files */}
      <AnimatePresence>
        {Array.from(uploadingFiles.entries()).map(([tempId, { progress, status }]) => (
          <motion.div
            key={tempId}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="p-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {tempId.replace(/^temp-\d+-/, '')}
                  </p>
                  <p className="text-xs text-muted-foreground">{status}</p>
                  <Progress value={progress} className="h-1 mt-1" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Fichiers uploadés ({uploadedFiles.length})
          </p>
          {uploadedFiles.map((file) => {
            const Icon = FileIcon(file.mimeType);
            const hasContent = file.extractedText && file.extractedText !== '__HAS_CONTENT__' && file.extractedText.length > 0;
            const isLoading = loadingFileId === file.id;
            
            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card 
                  className={`p-3 cursor-pointer transition-colors ${hasContent ? 'hover:bg-accent/50 border-green-500/30' : 'hover:bg-muted/50'}`}
                  onClick={() => !isLoading && selectFile(file)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${hasContent ? 'bg-green-500/10' : 'bg-muted'}`}>
                      <Icon className={`h-5 w-5 ${hasContent ? 'text-green-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.originalName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(file.size)}</span>
                        {hasContent && (
                          <>
                            <span>•</span>
                            <span className="text-green-500 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {file.extractedText!.length} caractères
                            </span>
                          </>
                        )}
                        {!hasContent && !isLoading && (
                          <>
                            <span>•</span>
                            <span className="text-amber-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Cliquez pour charger
                            </span>
                          </>
                        )}
                        {isLoading && (
                          <>
                            <span>•</span>
                            <span className="text-blue-500 flex items-center gap-1">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              Chargement...
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.id);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
