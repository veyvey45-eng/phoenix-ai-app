/**
 * Workspace - Page de gestion des fichiers persistants
 * Explorateur de fichiers + Éditeur de code intégré
 */

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { FileExplorer } from '@/components/FileExplorer';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  Save,
  X,
  FileCode,
  Play,
  Download,
  Copy,
  History,
  RefreshCw,
  Terminal,
  Eye,
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

export default function Workspace() {
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isModified, setIsModified] = useState(false);
  const [executionOutput, setExecutionOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');

  // Mutations
  const editFileMutation = trpc.workspace.editFile.useMutation({
    onSuccess: () => {
      toast.success('Fichier sauvegardé');
      setOriginalContent(fileContent);
      setIsModified(false);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const executePythonMutation = trpc.codeInterpreter.executePythonPublic.useMutation();
  const executeJsMutation = trpc.codeInterpreter.executeJavaScriptPublic.useMutation();

  // Détecter les modifications
  useEffect(() => {
    setIsModified(fileContent !== originalContent);
  }, [fileContent, originalContent]);

  // Sélection d'un fichier
  const handleFileSelect = (file: WorkspaceFile, content: string) => {
    // Vérifier s'il y a des modifications non sauvegardées
    if (isModified) {
      if (!confirm('Vous avez des modifications non sauvegardées. Continuer ?')) {
        return;
      }
    }
    setSelectedFile(file);
    setFileContent(content);
    setOriginalContent(content);
    setIsModified(false);
    setExecutionOutput('');
  };

  // Sauvegarder le fichier
  const handleSave = () => {
    if (!selectedFile) return;
    editFileMutation.mutate({
      path: selectedFile.path,
      content: fileContent,
      changeDescription: 'Modification via l\'éditeur',
    });
  };

  // Exécuter le code
  const handleExecute = async () => {
    if (!selectedFile || !fileContent) return;
    
    setIsExecuting(true);
    setExecutionOutput('Exécution en cours...\n');
    setActiveTab('output');

    try {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      let result;

      if (ext === 'py') {
        result = await executePythonMutation.mutateAsync({ code: fileContent });
      } else if (['js', 'ts', 'mjs'].includes(ext || '')) {
        result = await executeJsMutation.mutateAsync({ code: fileContent });
      } else {
        setExecutionOutput('Type de fichier non supporté pour l\'exécution.\nTypes supportés: .py, .js, .ts, .mjs');
        setIsExecuting(false);
        return;
      }

      if (result.success) {
        setExecutionOutput(result.output || 'Exécution terminée (pas de sortie)');
      } else {
        setExecutionOutput(`Erreur:\n${result.output || 'Erreur inconnue'}`);
      }
    } catch (error: any) {
      setExecutionOutput(`Erreur: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Copier le contenu
  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent);
    toast.success('Copié dans le presse-papier');
  };

  // Télécharger le fichier
  const handleDownload = () => {
    if (!selectedFile) return;
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fermer le fichier
  const handleClose = () => {
    if (isModified) {
      if (!confirm('Vous avez des modifications non sauvegardées. Fermer quand même ?')) {
        return;
      }
    }
    setSelectedFile(null);
    setFileContent('');
    setOriginalContent('');
    setIsModified(false);
    setExecutionOutput('');
  };

  // Déterminer si le fichier est exécutable
  const isExecutable = selectedFile && ['py', 'js', 'ts', 'mjs'].includes(
    selectedFile.name.split('.').pop()?.toLowerCase() || ''
  );

  // Obtenir le langage pour la coloration syntaxique
  const getLanguage = () => {
    if (!selectedFile) return 'text';
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'py': 'python',
      'js': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'jsx': 'javascript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'md': 'markdown',
      'sql': 'sql',
      'sh': 'bash',
      'yaml': 'yaml',
      'yml': 'yaml',
    };
    return langMap[ext || ''] || 'text';
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Workspace</h1>
            {selectedFile && (
              <span className="text-sm text-muted-foreground ml-2">
                {selectedFile.path}
                {isModified && <span className="text-orange-500 ml-1">●</span>}
              </span>
            )}
          </div>
          {selectedFile && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copier
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-1" />
                Télécharger
              </Button>
              {isExecutable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExecute}
                  disabled={isExecuting}
                >
                  {isExecuting ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  Exécuter
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={!isModified || editFileMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" />
                Sauvegarder
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            {/* Explorateur de fichiers */}
            <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
              <FileExplorer
                onFileSelect={handleFileSelect}
                className="h-full rounded-none border-0 border-r"
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Zone d'édition */}
            <ResizablePanel defaultSize={75}>
              {selectedFile ? (
                <div className="h-full flex flex-col">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <TabsList className="mx-4 mt-2 w-fit">
                      <TabsTrigger value="editor" className="gap-2">
                        <FileCode className="h-4 w-4" />
                        Éditeur
                      </TabsTrigger>
                      <TabsTrigger value="output" className="gap-2">
                        <Terminal className="h-4 w-4" />
                        Sortie
                        {executionOutput && (
                          <span className="ml-1 w-2 h-2 bg-green-500 rounded-full" />
                        )}
                      </TabsTrigger>
                      {selectedFile.name.endsWith('.html') && (
                        <TabsTrigger value="preview" className="gap-2">
                          <Eye className="h-4 w-4" />
                          Aperçu
                        </TabsTrigger>
                      )}
                    </TabsList>

                    <TabsContent value="editor" className="flex-1 m-0 p-4">
                      <Textarea
                        value={fileContent}
                        onChange={(e) => setFileContent(e.target.value)}
                        className="h-full font-mono text-sm resize-none"
                        placeholder="Contenu du fichier..."
                        spellCheck={false}
                      />
                    </TabsContent>

                    <TabsContent value="output" className="flex-1 m-0 p-4">
                      <ScrollArea className="h-full">
                        <pre className="font-mono text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg min-h-full">
                          {executionOutput || 'Aucune sortie. Exécutez le code pour voir les résultats.'}
                        </pre>
                      </ScrollArea>
                    </TabsContent>

                    {selectedFile.name.endsWith('.html') && (
                      <TabsContent value="preview" className="flex-1 m-0 p-4">
                        <div className="h-full border rounded-lg overflow-hidden bg-white">
                          <iframe
                            srcDoc={fileContent}
                            className="w-full h-full"
                            sandbox="allow-scripts"
                            title="Aperçu HTML"
                          />
                        </div>
                      </TabsContent>
                    )}
                  </Tabs>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <FileCode className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <h2 className="text-lg font-medium mb-2">Aucun fichier sélectionné</h2>
                    <p className="text-sm">
                      Sélectionnez un fichier dans l'explorateur ou créez-en un nouveau
                    </p>
                  </div>
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </DashboardLayout>
  );
}
