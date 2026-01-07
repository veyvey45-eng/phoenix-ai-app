import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Copy, Download, Image, FileCode, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface GeneratedFile {
  name: string;
  type: 'image' | 'html' | 'other';
  url: string;
  mimeType: string;
}

interface ExecutionResponse {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  language: 'python' | 'javascript';
  filesGenerated?: GeneratedFile[];
}

export function CodeExecutorTab() {
  const [pythonCode, setPythonCode] = useState(`# Exemple: Générer un graphique avec matplotlib
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.figure(figsize=(10, 6))
plt.plot(x, y, 'b-', linewidth=2)
plt.title('Graphique Sinusoïdal')
plt.xlabel('x')
plt.ylabel('sin(x)')
plt.grid(True)
plt.show()`);
  const [jsCode, setJsCode] = useState("// Écrivez votre code JavaScript ici\nconsole.log('Hello, World!');");
  const [activeTab, setActiveTab] = useState("python");
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<string>("");
  const [executionTime, setExecutionTime] = useState<number>(0);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);

  const executePythonMutation = trpc.codeInterpreter.executePythonPublic.useMutation();
  const executeJSMutation = trpc.codeInterpreter.executeJavaScriptPublic.useMutation();

  const handleExecute = async () => {
    const code = activeTab === "python" ? pythonCode : jsCode;
    if (!code.trim()) {
      toast.error("Veuillez entrer du code");
      return;
    }

    setIsExecuting(true);
    setResult("");
    setGeneratedFiles([]);
    const startTime = Date.now();

    try {
      let response: ExecutionResponse;
      if (activeTab === "python") {
        response = await executePythonMutation.mutateAsync({ code }) as ExecutionResponse;
      } else {
        response = await executeJSMutation.mutateAsync({ code }) as ExecutionResponse;
      }
      
      setResult(response.output || "Exécution réussie");
      setExecutionTime(Date.now() - startTime);
      
      // Gérer les fichiers générés
      if (response.filesGenerated && response.filesGenerated.length > 0) {
        setGeneratedFiles(response.filesGenerated);
        toast.success(`Code exécuté avec succès - ${response.filesGenerated.length} fichier(s) généré(s)`);
      } else {
        toast.success("Code exécuté avec succès");
      }
    } catch (error) {
      setResult(`Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
      toast.error("Erreur lors de l'exécution");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyCode = () => {
    const code = activeTab === "python" ? pythonCode : jsCode;
    navigator.clipboard.writeText(code);
    toast.success("Code copié");
  };

  const handleDownloadResult = () => {
    if (!result) {
      toast.error("Aucun résultat à télécharger");
      return;
    }
    const element = document.createElement("a");
    const file = new Blob([result], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `result-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Résultat téléchargé");
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="python">Python 3.11</TabsTrigger>
          <TabsTrigger value="javascript">JavaScript</TabsTrigger>
        </TabsList>

        <TabsContent value="python" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                Code Python
                <Badge variant="secondary" className="text-xs">matplotlib, numpy, PIL disponibles</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={pythonCode}
                onChange={(e) => setPythonCode(e.target.value)}
                placeholder="Entrez votre code Python..."
                className="font-mono min-h-48"
                disabled={isExecuting}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className="gap-2 flex-1"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Exécution...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Exécuter
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCopyCode}
                  variant="outline"
                  size="icon"
                  disabled={isExecuting}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="javascript" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Code JavaScript</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={jsCode}
                onChange={(e) => setJsCode(e.target.value)}
                placeholder="Entrez votre code JavaScript..."
                className="font-mono min-h-48"
                disabled={isExecuting}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className="gap-2 flex-1"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Exécution...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Exécuter
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCopyCode}
                  variant="outline"
                  size="icon"
                  disabled={isExecuting}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Fichiers générés (images, HTML) */}
      {generatedFiles.length > 0 && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Image className="w-4 h-4 text-green-500" />
              Fichiers Générés ({generatedFiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generatedFiles.map((file, index) => (
                <div key={index} className="border rounded-lg overflow-hidden">
                  {file.type === 'image' ? (
                    <div className="space-y-2">
                      <img 
                        src={file.url} 
                        alt={file.name}
                        className="w-full h-auto max-h-64 object-contain bg-white"
                      />
                      <div className="p-2 flex items-center justify-between bg-muted/50">
                        <span className="text-xs text-muted-foreground truncate">{file.name}</span>
                        <a 
                          href={file.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ouvrir
                        </a>
                      </div>
                    </div>
                  ) : file.type === 'html' ? (
                    <div className="space-y-2">
                      <div className="p-4 bg-muted/30 flex items-center justify-center">
                        <FileCode className="w-12 h-12 text-muted-foreground" />
                      </div>
                      <div className="p-2 flex items-center justify-between bg-muted/50">
                        <span className="text-xs text-muted-foreground truncate">{file.name}</span>
                        <a 
                          href={file.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Prévisualiser
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground truncate">{file.name}</span>
                      <a 
                        href={file.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Télécharger
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Résultats</CardTitle>
              <div className="flex gap-2">
                {executionTime > 0 && (
                  <Badge variant="outline">⏱️ {executionTime}ms</Badge>
                )}
                <Button
                  onClick={handleDownloadResult}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Download className="w-3 h-3" />
                  Télécharger
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-48 text-sm font-mono whitespace-pre-wrap break-words">
              {result}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
