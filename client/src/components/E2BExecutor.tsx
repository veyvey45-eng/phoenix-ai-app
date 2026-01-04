/**
 * E2BExecutor - Composant pour exécuter du code via E2B
 * 
 * Affiche:
 * - Éditeur de code
 * - Bouton d'exécution
 * - Résultats en temps réel
 * - Gestion des erreurs
 * - Statistiques d'exécution
 */

import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Play, Copy, Check, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface E2BExecutorProps {
  conversationId?: string;
  onExecute?: (result: any) => void;
}

export function E2BExecutor({ conversationId, onExecute }: E2BExecutorProps) {
  const [pythonCode, setPythonCode] = useState('print("Hello from E2B!")');
  const [nodeCode, setNodeCode] = useState('console.log("Hello from E2B!");');
  const [shellCommand, setShellCommand] = useState('echo "Hello from E2B!"');
  const [activeTab, setActiveTab] = useState<'python' | 'node' | 'shell'>('python');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const executePythonMutation = trpc.e2b.executePython.useMutation();
  const executeNodeMutation = trpc.e2b.executeNode.useMutation();
  const executeShellMutation = trpc.e2b.executeShell.useMutation();
  const getStatsQuery = trpc.e2b.getStats.useQuery();

  const handleExecute = async () => {
    setIsExecuting(true);
    setResult(null);

    try {
      let response;

      if (activeTab === 'python') {
        response = await executePythonMutation.mutateAsync({
          code: pythonCode,
          conversationId,
        });
      } else if (activeTab === 'node') {
        response = await executeNodeMutation.mutateAsync({
          code: nodeCode,
          conversationId,
        });
      } else {
        response = await executeShellMutation.mutateAsync({
          command: shellCommand,
          conversationId,
        });
      }

      setResult(response);
      onExecute?.(response);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyResult = () => {
    if (result?.stdout) {
      navigator.clipboard.writeText(result.stdout);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGetStats = () => {
    if (getStatsQuery.data?.success && getStatsQuery.data?.adapter && getStatsQuery.data?.user) {
      const stats = getStatsQuery.data;
      alert(`Sandboxes actives: ${stats.adapter.activeSandboxes}\nExécutions totales: ${stats.user.totalExecutions}`);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>E2B Code Executor</CardTitle>
          <CardDescription>
            Exécutez du code Python, Node.js ou des commandes Shell dans une sandbox isolée E2B
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'python' | 'node' | 'shell')}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="python">Python 3</TabsTrigger>
              <TabsTrigger value="node">Node.js</TabsTrigger>
              <TabsTrigger value="shell">Shell</TabsTrigger>
            </TabsList>

            <TabsContent value="python" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code Python</label>
                <textarea
                  value={pythonCode}
                  onChange={(e) => setPythonCode(e.target.value)}
                  className="w-full h-64 p-4 font-mono text-sm border rounded-lg bg-slate-950 text-slate-50 border-slate-700"
                  placeholder="Entrez votre code Python..."
                  disabled={isExecuting}
                />
              </div>
            </TabsContent>

            <TabsContent value="node" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code Node.js</label>
                <textarea
                  value={nodeCode}
                  onChange={(e) => setNodeCode(e.target.value)}
                  className="w-full h-64 p-4 font-mono text-sm border rounded-lg bg-slate-950 text-slate-50 border-slate-700"
                  placeholder="Entrez votre code Node.js..."
                  disabled={isExecuting}
                />
              </div>
            </TabsContent>

            <TabsContent value="shell" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Commande Shell</label>
                <textarea
                  value={shellCommand}
                  onChange={(e) => setShellCommand(e.target.value)}
                  className="w-full h-64 p-4 font-mono text-sm border rounded-lg bg-slate-950 text-slate-50 border-slate-700"
                  placeholder="Entrez votre commande shell..."
                  disabled={isExecuting}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Boutons d'action */}
          <div className="flex gap-2">
            <Button
              onClick={handleExecute}
              disabled={isExecuting}
              className="gap-2"
              size="lg"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exécution...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Exécuter
                </>
              )}
            </Button>
            <Button
              onClick={handleGetStats}
              variant="outline"
              disabled={isExecuting || getStatsQuery.isLoading}
            >
              {getStatsQuery.isLoading ? 'Chargement...' : 'Statistiques'}
            </Button>
          </div>

          {/* Résultats */}
          {result && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Résultats d'exécution</h3>
                <div className="flex items-center gap-2">
                  {result.duration && (
                    <span className="text-xs text-muted-foreground">
                      Durée: {result.duration}ms
                    </span>
                  )}
                </div>
              </div>

              {!result.success && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {result.error || 'Une erreur est survenue'}
                  </AlertDescription>
                </Alert>
              )}

              {result.success && (
                <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <AlertDescription className="text-green-800 dark:text-green-300">
                    ✅ Exécution réussie
                  </AlertDescription>
                </Alert>
              )}

              {/* Stdout */}
              {result.stdout && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Résultat:</span>
                    <button
                      onClick={handleCopyResult}
                      className="p-1 hover:bg-muted rounded transition-colors"
                      title="Copier"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <pre className="bg-slate-950 border border-slate-700 p-4 rounded text-sm overflow-auto max-h-[300px] text-slate-50">
                    <code>{result.stdout}</code>
                  </pre>
                </div>
              )}

              {/* Stderr */}
              {result.stderr && (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">Erreur:</span>
                  <pre className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 rounded text-sm overflow-auto max-h-[300px] text-red-700 dark:text-red-300">
                    <code>{result.stderr}</code>
                  </pre>
                </div>
              )}

              {/* Métadonnées */}
              {result.metadata && (
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  {result.metadata.sandboxId && (
                    <div>
                      Sandbox: <code className="bg-muted px-1 py-0.5 rounded">{result.metadata.sandboxId}</code>
                    </div>
                  )}
                  {result.metadata.exitCode !== undefined && (
                    <div>Code de sortie: {result.metadata.exitCode}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Info de sécurité */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">🔒 Sécurité</h4>
            <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
              <li>✅ Code exécuté dans une sandbox isolée E2B</li>
              <li>✅ Timeout de 60 secondes par exécution</li>
              <li>✅ Gestion automatique des ressources</li>
              <li>✅ Persistance d'état par utilisateur</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
