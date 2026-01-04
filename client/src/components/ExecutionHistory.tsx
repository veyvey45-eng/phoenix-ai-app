/**
 * Execution History Component - Affichage de l'historique des exécutions
 */

import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Trash2, Eye, Copy } from 'lucide-react';

interface ExecutionRecord {
  id: string;
  userId: number;
  conversationId?: string;
  sandboxId: string;
  language: 'python' | 'node' | 'shell';
  code: string;
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  duration: number;
  startedAt: Date;
  completedAt: Date;
  fileInputs?: string[];
  fileOutputs?: string[];
  metadata?: Record<string, any>;
  tags?: string[];
}

export function ExecutionHistory() {
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRecord | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Récupérer l'historique
  const { data: historyData, isLoading: isLoadingHistory } = trpc.e2bHistory.getHistory.useQuery({
    limit: 50,
  });

  // Récupérer les statistiques
  const { data: statsData } = trpc.e2bHistory.getStatistics.useQuery();

  // Mutations
  const exportMutation = trpc.e2bHistory.exportHistory.useQuery();
  const clearMutation = trpc.e2bHistory.clearHistory.useMutation();

  const handleExport = async () => {
    if (exportMutation.data && exportMutation.data.success) {
      const result = exportMutation.data;
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(result.data));
      element.setAttribute('download', result.filename);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  const handleClear = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer tout l\'historique?')) {
      await clearMutation.mutateAsync();
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const records = (historyData?.records || []) as ExecutionRecord[];
  const stats = statsData?.stats;

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Exécutions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalExecutions}</div>
              <p className="text-xs text-muted-foreground">
                {stats.successRate ? `${(stats.successRate * 100).toFixed(1)}% réussi` : '0% réussi'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Durée Moyenne</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(stats.averageDuration)}ms</div>
              <p className="text-xs text-muted-foreground">par exécution</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Par Langage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div>Python: {stats.byLanguage.python}</div>
                <div>Node: {stats.byLanguage.node}</div>
                <div>Shell: {stats.byLanguage.shell}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Succès/Erreurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div className="text-green-600">✓ {stats.successfulExecutions}</div>
                <div className="text-red-600">✗ {stats.failedExecutions}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contrôles */}
      <div className="flex gap-2">
        <Button onClick={handleExport} disabled={exportMutation.isLoading} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exporter
        </Button>
        <Button onClick={handleClear} disabled={clearMutation.isPending} variant="destructive" className="ml-auto">
          <Trash2 className="w-4 h-4 mr-2" />
          Effacer l'historique
        </Button>
      </div>

      {/* Historique */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Exécutions</CardTitle>
          <CardDescription>{records.length} exécutions trouvées</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="text-center py-8">Chargement...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Aucune exécution trouvée</div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition"
                  onClick={() => {
                    setSelectedExecution(record);
                    setShowDetails(true);
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={record.success ? 'default' : 'destructive'}>
                        {(record as ExecutionRecord).language}
                      </Badge>
                      <span className="text-sm font-medium">
                        {record.success ? '✓ Succès' : '✗ Erreur'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(record.startedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="mb-2">
                    <code className="text-xs bg-muted p-2 rounded block truncate">
                      {record.code.substring(0, 100)}...
                    </code>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{record.duration}ms</span>
                    {record.tags && record.tags.length > 0 && (
                      <div className="flex gap-1">
                        {record.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Détails */}
      {showDetails && selectedExecution && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Détails de l'Exécution</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(false)}
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="code" className="w-full">
              <TabsList>
                <TabsTrigger value="code">Code</TabsTrigger>
                <TabsTrigger value="output">Output</TabsTrigger>
                <TabsTrigger value="error">Erreur</TabsTrigger>
                <TabsTrigger value="info">Info</TabsTrigger>
              </TabsList>

              <TabsContent value="code" className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Code Exécuté</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyCode(selectedExecution.code)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-64">
                  {selectedExecution.code}
                </pre>
              </TabsContent>

              <TabsContent value="output" className="space-y-2">
                <h4 className="font-medium">Output</h4>
                {selectedExecution.stdout ? (
                  <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-64">
                    {selectedExecution.stdout}
                  </pre>
                ) : (
                  <p className="text-muted-foreground">Aucun output</p>
                )}
              </TabsContent>

              <TabsContent value="error" className="space-y-2">
                <h4 className="font-medium">Erreur</h4>
                {selectedExecution.stderr ? (
                  <pre className="bg-red-50 p-4 rounded text-sm overflow-auto max-h-64 text-red-900">
                    {selectedExecution.stderr}
                  </pre>
                ) : (
                  <p className="text-muted-foreground">Aucune erreur</p>
                )}
              </TabsContent>

              <TabsContent value="info" className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Langage</p>
                    <p className="text-muted-foreground">{selectedExecution.language}</p>
                  </div>
                  <div>
                    <p className="font-medium">Durée</p>
                    <p className="text-muted-foreground">{selectedExecution.duration}ms</p>
                  </div>
                  <div>
                    <p className="font-medium">Code de sortie</p>
                    <p className="text-muted-foreground">{selectedExecution.exitCode || '-'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Sandbox ID</p>
                    <p className="text-muted-foreground text-xs truncate">{selectedExecution.sandboxId}</p>
                  </div>
                </div>

                {selectedExecution.tags && selectedExecution.tags.length > 0 && (
                  <div>
                    <p className="font-medium mb-2">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedExecution.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
