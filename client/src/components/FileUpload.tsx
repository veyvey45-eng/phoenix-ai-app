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
  AlertCircle
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
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, number>>(new Map());
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: supportedTypes } = trpc.files.supportedTypes.useQuery();
  const uploadMutation = trpc.files.upload.useMutation();
  const deleteMutation = trpc.files.delete.useMutation();
  const { data: persistedFiles = [], refetch: refetchFiles, isLoading: isLoadingFiles } = trpc.files.list.useQuery();

  // Charger les fichiers persistés depuis la base de données
  useEffect(() => {
    if (persistedFiles && persistedFiles.length > 0) {
      setUploadedFiles(persistedFiles.map(f => ({
        id: f.id.toString(),
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.size,
        extractedText: f.hasExtractedText ? `Contenu du fichier: ${f.originalName}` : undefined,
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
    // Reset input
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
      setUploadingFiles(prev => new Map(prev).set(tempId, 0));

      try {
        // Convert to base64
        const base64 = await fileToBase64(file);
        
        // Simulate progress
        setUploadingFiles(prev => new Map(prev).set(tempId, 50));

        // Upload
        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          mimeType: file.type,
          base64Content: base64
        });

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
        
        // Appeler le callback avec le fichier uploadé
        onFileUploaded?.(uploadedFile);
        
        // Attendre que l'extraction soit complète
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Recharger depuis la base de données pour obtenir le contenu extrait
        await refetchFiles();
        
        // Sélectionner automatiquement le fichier avec le contenu complet
        await selectFile(uploadedFile);
        
        toast.success(`${file.name} uploadé avec succès`);
      } catch (error) {
        setUploadingFiles(prev => {
          const newMap = new Map(prev);
          newMap.delete(tempId);
          return newMap;
        });
        toast.error(`Erreur lors de l'upload de ${file.name}`);
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeFile = async (fileId: string) => {
    // Supprimer de la base de données
    try {
      await deleteMutation.mutateAsync({ fileId });
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      await refetchFiles();
      toast.success('Fichier supprimé');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const selectFile = async (file: UploadedFile) => {
    // Charger le contenu complet du fichier depuis le serveur
    try {
      const fullContent = await loadFileContent(file.id);
      if (fullContent) {
        onFileSelected?.({
          ...file,
          extractedText: fullContent
        });
      } else {
        onFileSelected?.(file);
      }
    } catch (error) {
      console.error('Error loading file content:', error);
      onFileSelected?.(file);
    }
  };
  
  const loadFileContent = async (fileId: string, retries = 3): Promise<string | null> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`/api/files/${fileId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) {
          if (attempt === retries) return null;
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        const fullFile = await response.json();
        if (fullFile.extractedText) return fullFile.extractedText;
        if (attempt === retries) return null;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      } catch (error) {
        if (attempt === retries) return null;
        console.warn(`Attempt ${attempt} failed, retrying...`);
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
            PDF, TXT, MD, JSON, Images (max 10MB)
          </p>
        </motion.div>
      </div>

      {/* Uploading Files */}
      <AnimatePresence>
        {Array.from(uploadingFiles.entries()).map(([id, progress]) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="p-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Upload en cours...</p>
                  <Progress value={progress} className="h-1 mt-1" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Uploaded Files */}
      <AnimatePresence>
        {uploadedFiles.map((file) => {
          const Icon = FileIcon(file.mimeType);
          return (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
            >
              <Card 
                className="p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={async () => {
                  await selectFile(file);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.originalName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(file.size)}</span>
                      {file.extractedText && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            Texte extrait
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeFile(file.id);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* File Count */}
      {uploadedFiles.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {uploadedFiles.length}/{maxFiles} fichiers
        </p>
      )}
    </div>
  );
}

export default FileUpload;
