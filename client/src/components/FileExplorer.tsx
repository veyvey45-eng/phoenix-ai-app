/**
 * FileExplorer - Explorateur de fichiers du workspace persistant
 * Similaire à l'explorateur de fichiers de Manus/VS Code
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  Folder,
  File,
  FileCode,
  FileJson,
  FileText,
  FilePlus,
  FolderPlus,
  Trash2,
  Edit,
  Download,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Copy,
  Move,
  History,
} from 'lucide-react';
import { toast } from 'sonner';

interface WorkspaceFile {
  id: string;
  path: string;
  name: string;
  fileType: 'file' | 'directory';
  mimeType: string | null;
  size: number | null;
  language: string | null;
  version: number | null;
  updatedAt: Date;
}

interface FileExplorerProps {
  onFileSelect?: (file: WorkspaceFile, content: string) => void;
  className?: string;
}

// Icône selon le type de fichier
function getFileIcon(file: WorkspaceFile) {
  if (file.fileType === 'directory') {
    return <Folder className="h-4 w-4 text-yellow-500" />;
  }
  
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'java':
    case 'cpp':
    case 'c':
    case 'go':
    case 'rs':
      return <FileCode className="h-4 w-4 text-blue-500" />;
    case 'json':
      return <FileJson className="h-4 w-4 text-yellow-600" />;
    case 'md':
    case 'txt':
    case 'log':
      return <FileText className="h-4 w-4 text-gray-500" />;
    default:
      return <File className="h-4 w-4 text-gray-400" />;
  }
}

// Formater la taille
function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileExplorer({ onFileSelect, className }: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = useState(false);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');

  // Requêtes tRPC - Utilise le nouveau système de fichiers persistant
  const { data: filesData, refetch: refetchFiles, isLoading } = trpc.persistentFiles.list.useQuery({
    directory: '/',
    recursive: true,
    fileType: 'all',
  });

  const createFileMutation = trpc.persistentFiles.create.useMutation({
    onSuccess: () => {
      toast.success('Fichier créé');
      refetchFiles();
      setIsNewFileDialogOpen(false);
      setNewFileName('');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const createDirMutation = trpc.persistentFiles.createDirectory.useMutation({
    onSuccess: () => {
      toast.success('Dossier créé');
      refetchFiles();
      setIsNewFolderDialogOpen(false);
      setNewFolderName('');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteFileMutation = trpc.persistentFiles.delete.useMutation({
    onSuccess: () => {
      toast.success('Fichier supprimé');
      refetchFiles();
      setSelectedFile(null);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const readFileMutation = trpc.persistentFiles.readByPath.useQuery(
    { path: selectedFile?.path || '' },
    { enabled: !!selectedFile && selectedFile.fileType === 'file' }
  );

  // Organiser les fichiers en arborescence
  const buildTree = (files: WorkspaceFile[]) => {
    const tree: Map<string, WorkspaceFile[]> = new Map();
    tree.set('/', []);

    files.forEach((file) => {
      const parentPath = file.path.substring(0, file.path.lastIndexOf('/')) || '/';
      if (!tree.has(parentPath)) {
        tree.set(parentPath, []);
      }
      tree.get(parentPath)!.push(file);
    });

    // Trier: dossiers d'abord, puis fichiers par nom
    tree.forEach((children) => {
      children.sort((a, b) => {
        if (a.fileType !== b.fileType) {
          return a.fileType === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    });

    return tree;
  };

  const files = filesData || [];
  const tree = buildTree(files as WorkspaceFile[]);

  // Toggle dossier
  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Sélectionner un fichier
  const handleFileClick = async (file: WorkspaceFile) => {
    setSelectedFile(file);
    if (file.fileType === 'file' && onFileSelect) {
      // Le contenu sera chargé via la query
    }
  };

  // Effet pour notifier quand le contenu est chargé
  useEffect(() => {
    if (readFileMutation.data && selectedFile && onFileSelect) {
      onFileSelect(selectedFile, readFileMutation.data.content || '');
    }
  }, [readFileMutation.data, selectedFile]);

  // Créer un fichier
  const handleCreateFile = () => {
    if (!newFileName.trim()) return;
    const path = currentPath === '/' ? `/${newFileName}` : `${currentPath}/${newFileName}`;
    createFileMutation.mutate({ path, content: '' });
  };

  // Créer un dossier
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const path = currentPath === '/' ? `/${newFolderName}` : `${currentPath}/${newFolderName}`;
    createDirMutation.mutate({ path });
  };

  // Supprimer un fichier
  const handleDelete = (file: WorkspaceFile) => {
    if (confirm(`Supprimer ${file.name} ?`)) {
      deleteFileMutation.mutate({ fileId: file.id });
    }
  };

  // Télécharger un fichier
  const handleDownload = async (file: WorkspaceFile) => {
    try {
      const result = await readFileMutation.refetch();
      if (result.data?.content) {
        const blob = new Blob([result.data.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast.error('Erreur lors du téléchargement');
    }
  };

  // Rendu d'un élément de l'arbre
  const renderTreeItem = (file: WorkspaceFile, depth: number = 0) => {
    const isExpanded = expandedFolders.has(file.path);
    const isSelected = selectedFile?.path === file.path;
    const children = tree.get(file.path) || [];

    return (
      <div key={file.path}>
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent/50 rounded-sm transition-colors ${
                isSelected ? 'bg-accent' : ''
              }`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
              onClick={() => {
                if (file.fileType === 'directory') {
                  toggleFolder(file.path);
                  setCurrentPath(file.path);
                } else {
                  handleFileClick(file);
                }
              }}
            >
              {file.fileType === 'directory' && (
                <span className="w-4 h-4 flex items-center justify-center">
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </span>
              )}
              {file.fileType !== 'directory' && <span className="w-4" />}
              {getFileIcon(file)}
              <span className="text-sm truncate flex-1">{file.name}</span>
              {file.size && (
                <span className="text-xs text-muted-foreground">
                  {formatSize(file.size)}
                </span>
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {file.fileType === 'file' && (
              <>
                <ContextMenuItem onClick={() => handleFileClick(file)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Ouvrir
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleDownload(file)}>
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            {file.fileType === 'directory' && (
              <>
                <ContextMenuItem onClick={() => {
                  setCurrentPath(file.path);
                  setIsNewFileDialogOpen(true);
                }}>
                  <FilePlus className="h-4 w-4 mr-2" />
                  Nouveau fichier
                </ContextMenuItem>
                <ContextMenuItem onClick={() => {
                  setCurrentPath(file.path);
                  setIsNewFolderDialogOpen(true);
                }}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Nouveau dossier
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            <ContextMenuItem
              onClick={() => handleDelete(file)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Enfants si dossier expandé */}
        {file.fileType === 'directory' && isExpanded && (
          <div>
            {children.map((child) => renderTreeItem(child as WorkspaceFile, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Fichiers à la racine
  const rootFiles = tree.get('/') || [];

  return (
    <div className={`flex flex-col h-full bg-background border rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b">
        <h3 className="text-sm font-medium">Workspace</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => refetchFiles()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          <Dialog open={isNewFileDialogOpen} onOpenChange={setIsNewFileDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <FilePlus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau fichier</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Input
                  placeholder="nom-du-fichier.txt"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Sera créé dans: {currentPath}
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewFileDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleCreateFile} disabled={!newFileName.trim()}>
                  Créer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <FolderPlus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau dossier</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Input
                  placeholder="nom-du-dossier"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Sera créé dans: {currentPath}
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewFolderDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                  Créer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Arborescence */}
      <ScrollArea className="flex-1">
        <div className="p-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rootFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Workspace vide</p>
              <p className="text-xs mt-1">
                Créez un fichier ou demandez à Phoenix
              </p>
            </div>
          ) : (
            rootFiles.map((file) => renderTreeItem(file as WorkspaceFile, 0))
          )}
        </div>
      </ScrollArea>

      {/* Stats */}
      <div className="p-2 border-t text-xs text-muted-foreground">
        {files.length} fichier{files.length > 1 ? 's' : ''}
        {files.length > 0 && (
          <span className="ml-2">
            ({formatSize((files as WorkspaceFile[]).reduce((sum: number, f: WorkspaceFile) => sum + (f.size || 0), 0))})
          </span>
        )}
      </div>
    </div>
  );
}

export default FileExplorer;
