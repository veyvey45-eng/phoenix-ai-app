/**
 * MCP Bridge Configuration Page
 * 
 * Permet aux utilisateurs de connecter Phoenix à leurs serveurs MCP locaux
 */

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Loader2, 
  Plug, 
  PlugZap, 
  Server, 
  Play, 
  Square, 
  RefreshCw, 
  Copy, 
  Check,
  AlertCircle,
  CheckCircle,
  Wrench,
  Download,
  ExternalLink,
  Terminal,
  Shield,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useMCPSecurity, type SecurityConfirmationRequest } from '@/hooks/useMCPSecurity';
import { MCPSecurityConfirmation } from '@/components/MCPSecurityConfirmation';

export default function MCPBridge() {
  const [url, setUrl] = useState('ws://localhost:8765');
  const [secret, setSecret] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Hook de sécurité MCP
  const {
    pendingConfirmations,
    isProcessing,
    approveAction,
    rejectAction,
    refreshPendingConfirmations,
  } = useMCPSecurity();

  const { data: status, refetch: refetchStatus } = trpc.mcpBridge.getStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const { data: serversData, refetch: refetchServers } = trpc.mcpBridge.discoverServers.useQuery(undefined, {
    enabled: status?.connected && status?.authenticated,
  });

  const connectMutation = trpc.mcpBridge.connect.useMutation({
    onSuccess: () => {
      toast.success('Connecté au MCP Bridge !');
      refetchStatus();
      refetchServers();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const disconnectMutation = trpc.mcpBridge.disconnect.useMutation({
    onSuccess: () => {
      toast.success('Déconnecté du MCP Bridge');
      refetchStatus();
    },
  });

  const pingMutation = trpc.mcpBridge.ping.useMutation({
    onSuccess: (data) => {
      toast.success(`Ping: ${data.latency}ms`);
    },
    onError: () => {
      toast.error('Ping failed');
    },
  });

  const handleConnect = () => {
    if (!url || !secret) {
      toast.error('Veuillez remplir l\'URL et le secret');
      return;
    }
    connectMutation.mutate({ url, secret });
  };

  const copyInstallCommand = () => {
    navigator.clipboard.writeText('npx phoenix-mcp-bridge');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Commande copiée !');
  };

  const isConnected = status?.connected && status?.authenticated;

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">MCP Bridge</h1>
            <p className="text-muted-foreground mt-1">
              Connectez Phoenix à vos serveurs MCP locaux
            </p>
          </div>
          <Badge 
            variant={isConnected ? 'default' : 'secondary'}
            className={isConnected ? 'bg-green-500' : ''}
          >
            {isConnected ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Connecté
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Déconnecté
              </>
            )}
          </Badge>
        </div>

        <Tabs defaultValue="connect" className="space-y-6">
          <TabsList>
            <TabsTrigger value="connect" className="gap-2">
              <Plug className="h-4 w-4" />
              Connexion
            </TabsTrigger>
            <TabsTrigger value="servers" className="gap-2" disabled={!isConnected}>
              <Server className="h-4 w-4" />
              Serveurs MCP
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Sécurité
              {pendingConfirmations.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingConfirmations.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="setup" className="gap-2">
              <Download className="h-4 w-4" />
              Installation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connect">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PlugZap className="h-5 w-5 text-primary" />
                    Configuration de Connexion
                  </CardTitle>
                  <CardDescription>
                    Entrez les informations de votre MCP Bridge local
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">URL du Bridge</label>
                    <Input
                      placeholder="ws://localhost:8765"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={isConnected}
                    />
                    <p className="text-xs text-muted-foreground">
                      Par défaut: ws://localhost:8765
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Secret</label>
                    <Input
                      type="password"
                      placeholder="Votre secret de connexion"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      disabled={isConnected}
                    />
                    <p className="text-xs text-muted-foreground">
                      Affiché au démarrage du bridge sur votre PC
                    </p>
                  </div>

                  {isConnected ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => pingMutation.mutate()}
                        disabled={pingMutation.isPending}
                        className="flex-1"
                      >
                        {pingMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Ping'
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => disconnectMutation.mutate()}
                        disabled={disconnectMutation.isPending}
                        className="flex-1"
                      >
                        Déconnecter
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={handleConnect}
                      disabled={connectMutation.isPending || !url || !secret}
                      className="w-full"
                    >
                      {connectMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connexion...
                        </>
                      ) : (
                        <>
                          <Plug className="mr-2 h-4 w-4" />
                          Se connecter
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Statut</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Connexion</p>
                      <p className="text-lg font-semibold">
                        {status?.connected ? '✅ Établie' : '❌ Non établie'}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Authentification</p>
                      <p className="text-lg font-semibold">
                        {status?.authenticated ? '✅ OK' : '❌ Non authentifié'}
                      </p>
                    </div>
                  </div>

                  {status?.activeMCPs && status.activeMCPs.length > 0 && (
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground mb-2">MCP Actifs</p>
                      <div className="flex flex-wrap gap-2">
                        {status.activeMCPs.map((mcp) => (
                          <Badge key={mcp} variant="secondary">
                            {mcp}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {status?.lastPing && (
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Latence</p>
                      <p className="text-lg font-semibold">{status.lastPing}ms</p>
                    </div>
                  )}

                  {status?.error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Erreur</AlertTitle>
                      <AlertDescription>{status.error}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="servers">
            <MCPServersPanel servers={serversData?.servers || []} onRefresh={refetchServers} />
          </TabsContent>

          <TabsContent value="security">
            <SecurityPanel
              pendingConfirmations={pendingConfirmations}
              isProcessing={isProcessing}
              onApprove={approveAction}
              onReject={rejectAction}
              onRefresh={refreshPendingConfirmations}
            />
          </TabsContent>

          <TabsContent value="setup">
            <InstallationGuide onCopyCommand={copyInstallCommand} copied={copied} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ============================================================================
// MCP SERVERS PANEL
// ============================================================================

interface MCPServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  status: string;
  source: string;
}

function MCPServersPanel({ servers, onRefresh }: { servers: MCPServer[]; onRefresh: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Serveurs MCP Disponibles
          </CardTitle>
          <CardDescription>
            Serveurs MCP détectés sur votre PC
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </CardHeader>
      <CardContent>
        {servers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucun serveur MCP détecté</p>
            <p className="text-sm mt-2">
              Configurez vos serveurs MCP dans ~/.config/mcp/servers.json
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {servers.map((server) => (
              <MCPServerCard key={server.id} server={server} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MCPServerCard({ server }: { server: MCPServer }) {
  const startMutation = trpc.mcpBridge.startServer.useMutation({
    onSuccess: () => {
      toast.success(`${server.name} démarré`);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const stopMutation = trpc.mcpBridge.stopServer.useMutation({
    onSuccess: () => {
      toast.success(`${server.name} arrêté`);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const { data: toolsData } = trpc.mcpBridge.listTools.useQuery(
    { serverId: server.id },
    { enabled: server.status === 'running' }
  );

  const isRunning = server.status === 'running';

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isRunning ? 'bg-green-500/10 text-green-500' : 'bg-muted'}`}>
            <Server className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">{server.name}</p>
            <p className="text-xs text-muted-foreground">
              {server.command} {server.args.join(' ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={server.source === 'config' ? 'default' : 'secondary'}>
            {server.source}
          </Badge>
          <Badge variant={isRunning ? 'default' : 'secondary'} className={isRunning ? 'bg-green-500' : ''}>
            {server.status}
          </Badge>
          {isRunning ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => stopMutation.mutate({ serverId: server.id })}
              disabled={stopMutation.isPending}
            >
              {stopMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => startMutation.mutate({ 
                serverId: server.id,
                command: server.command,
                args: server.args
              })}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {toolsData?.tools && toolsData.tools.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-muted-foreground mb-2">Outils disponibles:</p>
          <div className="flex flex-wrap gap-1">
            {toolsData.tools.map((tool) => (
              <Badge key={tool.name} variant="outline" className="text-xs">
                <Wrench className="h-3 w-3 mr-1" />
                {tool.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SECURITY PANEL
// ============================================================================

interface SecurityPanelProps {
  pendingConfirmations: SecurityConfirmationRequest[];
  isProcessing: boolean;
  onApprove: (requestId: string) => Promise<{ success: boolean; result?: unknown }>;
  onReject: (requestId: string, reason?: string) => Promise<void>;
  onRefresh: () => void;
}

function SecurityPanel({ 
  pendingConfirmations, 
  isProcessing, 
  onApprove, 
  onReject,
  onRefresh 
}: SecurityPanelProps) {
  return (
    <div className="space-y-6">
      {/* En-tête */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-500" />
              Sécurité MCP
            </CardTitle>
            <CardDescription>
              Phoenix vous demande l'autorisation avant d'exécuter des actions sensibles
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </CardHeader>
        <CardContent>
          <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <AlertTitle>Protection activée</AlertTitle>
            <AlertDescription>
              Toutes les actions MCP sensibles (suppression, installation, exécution de commandes) 
              nécessitent votre approbation avant d'être exécutées.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Demandes en attente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-500" />
            Demandes en attente
            {pendingConfirmations.length > 0 && (
              <Badge variant="destructive">{pendingConfirmations.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Actions que Phoenix souhaite exécuter et qui nécessitent votre approbation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingConfirmations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune demande en attente</p>
              <p className="text-sm mt-2">
                Les demandes de confirmation apparaîtront ici quand Phoenix voudra exécuter une action sensible.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingConfirmations.map((request) => (
                <MCPSecurityConfirmation
                  key={request.id}
                  request={request}
                  onApprove={onApprove}
                  onReject={onReject}
                  isProcessing={isProcessing}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Niveaux de risque */}
      <Card>
        <CardHeader>
          <CardTitle>Niveaux de risque</CardTitle>
          <CardDescription>
            Comment Phoenix classifie les actions MCP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-green-500">✅ Faible</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Lecture de fichiers, liste de dossiers, recherche. 
                <strong className="text-foreground"> Pas de confirmation requise.</strong>
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-yellow-500">⚠️ Moyen</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Création/modification de fichiers, copie, renommage.
                <strong className="text-foreground"> Confirmation simple.</strong>
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-orange-500">🔶 Élevé</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Suppression, installation de packages, exécution de commandes.
                <strong className="text-foreground"> Confirmation détaillée.</strong>
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-red-500">🚨 CRITIQUE</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Suppression récursive, commandes système, chemins protégés.
                <strong className="text-foreground"> Avertissement spécial.</strong>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// INSTALLATION GUIDE
// ============================================================================

function InstallationGuide({ onCopyCommand, copied }: { onCopyCommand: () => void; copied: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Installation du MCP Bridge
          </CardTitle>
          <CardDescription>
            Suivez ces étapes pour installer le bridge sur votre PC
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <p className="font-medium">Prérequis</p>
                <p className="text-sm text-muted-foreground">
                  Assurez-vous d'avoir Node.js 18+ installé sur votre PC
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <p className="font-medium">Télécharger le bridge</p>
                <p className="text-sm text-muted-foreground mb-2">
                  Téléchargez le dossier mcp-bridge depuis le projet Phoenix
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="/api/download/mcp-bridge" download>
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger mcp-bridge.zip
                  </a>
                </Button>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <p className="font-medium">Installer les dépendances</p>
                <div className="mt-2 p-3 bg-muted rounded-lg font-mono text-sm">
                  <code>cd mcp-bridge && npm install</code>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <p className="font-medium">Démarrer le bridge</p>
                <div className="mt-2 p-3 bg-muted rounded-lg font-mono text-sm flex items-center justify-between">
                  <code>npm start</code>
                  <Button variant="ghost" size="sm" onClick={onCopyCommand}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                5
              </div>
              <div>
                <p className="font-medium">Copier le secret</p>
                <p className="text-sm text-muted-foreground">
                  Au démarrage, le bridge affiche un secret. Copiez-le et collez-le dans Phoenix.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            Configuration des MCP
          </CardTitle>
          <CardDescription>
            Comment configurer vos serveurs MCP
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Fichier de configuration</AlertTitle>
            <AlertDescription>
              Créez le fichier <code className="bg-muted px-1 rounded">~/.config/mcp/servers.json</code>
            </AlertDescription>
          </Alert>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Exemple de configuration:</p>
            <pre className="text-xs overflow-x-auto">
{`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx"
      }
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "xxx"
      }
    }
  }
}`}
            </pre>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">MCP populaires:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Filesystem', desc: 'Accès fichiers' },
                { name: 'GitHub', desc: 'Repos, Issues, PRs' },
                { name: 'Brave Search', desc: 'Recherche web' },
                { name: 'SQLite', desc: 'Base de données' },
                { name: 'Puppeteer', desc: 'Automatisation web' },
                { name: 'Memory', desc: 'Mémoire persistante' },
              ].map((mcp) => (
                <div key={mcp.name} className="p-2 border rounded text-sm">
                  <p className="font-medium">{mcp.name}</p>
                  <p className="text-xs text-muted-foreground">{mcp.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <Button variant="outline" className="w-full" asChild>
            <a href="https://modelcontextprotocol.io/servers" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Voir tous les MCP disponibles
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
