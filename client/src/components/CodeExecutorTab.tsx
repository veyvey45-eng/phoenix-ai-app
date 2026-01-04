import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Copy, Download } from "lucide-react";
import { toast } from "sonner";

export function CodeExecutorTab() {
  const [pythonCode, setPythonCode] = useState("# Écrivez votre code Python ici\nprint('Hello, World!')");
  const [jsCode, setJsCode] = useState("// Écrivez votre code JavaScript ici\nconsole.log('Hello, World!');");
  const [activeTab, setActiveTab] = useState("python");
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<string>("");
  const [executionTime, setExecutionTime] = useState<number>(0);

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
    const startTime = Date.now();

    try {
      if (activeTab === "python") {
        const response = await executePythonMutation.mutateAsync({ code });
        setResult(response.output || response.stdout || "Exécution réussie");
      } else {
        const response = await executeJSMutation.mutateAsync({ code });
        setResult(response.output || response.stdout || "Exécution réussie");
      }
      setExecutionTime(Date.now() - startTime);
      toast.success("Code exécuté avec succès");
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
              <CardTitle className="text-sm">Code Python</CardTitle>
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
