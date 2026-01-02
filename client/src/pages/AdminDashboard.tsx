import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Shield, 
  Settings, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  Activity,
  Lock,
  Unlock,
  RefreshCw,
  BookOpen,
  Upload,
  Database,
  Search,
  Scale,
  Undo2,
  AlertOctagon,
  Globe,
  BarChart3,
  ShieldCheck,
  Key,
  Eye,
  EyeOff,
  FileKey,
  Flame,
  Heart,
  Zap,
  MessageSquare,
  BellRing,
  Send,
  TrendingUp,
  TrendingDown,
  Play,
  Square,
  FileBarChart,
  Bell,
  Gauge,
  ListOrdered,
  Timer,
  Cpu
} from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  // Check admin status
  const { data: adminStatus, isLoading: checkingAdmin } = trpc.admin.isAdmin.useQuery();
  
  // Get dashboard data
  const { data: dashboardData, refetch: refetchDashboard } = trpc.admin.dashboard.useQuery(
    undefined,
    { enabled: adminStatus?.isAdmin === true }
  );

  // Initialize admin system
  const initializeMutation = trpc.admin.initialize.useMutation({
    onSuccess: () => {
      toast.success("Système admin initialisé avec succès");
      refetchDashboard();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    }
  });

  // Update module
  const updateModuleMutation = trpc.admin.modules.update.useMutation({
    onSuccess: () => {
      toast.success("Module mis à jour");
      refetchDashboard();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    }
  });

  // Update validation
  const updateValidationMutation = trpc.admin.validations.update.useMutation({
    onSuccess: () => {
      toast.success("Validation mise à jour");
      refetchDashboard();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    }
  });

  // Process approval
  const processApprovalMutation = trpc.admin.approvals.process.useMutation({
    onSuccess: () => {
      toast.success("Approbation traitée");
      refetchDashboard();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    }
  });

  if (checkingAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!adminStatus?.isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Shield className="w-16 h-16 text-destructive" />
          <h1 className="text-2xl font-bold">Accès Refusé</h1>
          <p className="text-muted-foreground">
            Vous n'avez pas les permissions administrateur requises.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const severityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="w-8 h-8 text-primary" />
              Tableau de Bord Admin
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestion des modules, validations et approbations Phoenix
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => refetchDashboard()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Button 
              onClick={() => initializeMutation.mutate()}
              disabled={initializeMutation.isPending}
            >
              {initializeMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Settings className="w-4 h-4 mr-2" />
              )}
              Initialiser Système
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Modules Actifs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData?.modules?.filter(m => m.isEnabled).length || 0}
                <span className="text-muted-foreground text-sm font-normal">
                  /{dashboardData?.modules?.length || 10}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Validations Critiques
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {dashboardData?.validations?.filter(v => v.severity === "critical").length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Approbations en Attente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">
                {dashboardData?.pendingApprovals?.length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Actions Récentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData?.recentAuditLog?.length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-10">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="modules">Modules (10)</TabsTrigger>
            <TabsTrigger value="validations">Axiomes (16)</TabsTrigger>
            <TabsTrigger value="arbitrage">Arbitrage</TabsTrigger>
            <TabsTrigger value="actions">Actions Web</TabsTrigger>
            <TabsTrigger value="reports">Rapports</TabsTrigger>
            <TabsTrigger value="renaissance">Renaissance</TabsTrigger>
            <TabsTrigger value="comms">Communication</TabsTrigger>
            <TabsTrigger value="optimizer">Optimisation</TabsTrigger>
            <TabsTrigger value="security">Sécurité</TabsTrigger>
            <TabsTrigger value="evolution">Évolution</TabsTrigger>
            <TabsTrigger value="memory">Memory Sync</TabsTrigger>
            <TabsTrigger value="audit">Journal d'Audit</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pending Approvals */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Approbations en Attente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {dashboardData?.pendingApprovals?.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Aucune approbation en attente
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {dashboardData?.pendingApprovals?.map((approval) => (
                          <div 
                            key={approval.id} 
                            className="p-3 border rounded-lg flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium">Demande #{approval.id}</p>
                              <p className="text-sm text-muted-foreground">
                                Validation ID: {approval.validationId}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-500"
                                onClick={() => processApprovalMutation.mutate({
                                  requestId: approval.id,
                                  approved: true
                                })}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-500"
                                onClick={() => processApprovalMutation.mutate({
                                  requestId: approval.id,
                                  approved: false
                                })}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Recent Audit Log */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Activité Récente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {dashboardData?.recentAuditLog?.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Aucune activité récente
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {dashboardData?.recentAuditLog?.map((log) => (
                          <div 
                            key={log.id} 
                            className="p-3 border rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <Badge variant="outline">{log.action}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(log.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm mt-1">
                              {log.resourceType} #{log.resourceId || "N/A"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Modules Tab */}
          <TabsContent value="modules">
            <Card>
              <CardHeader>
                <CardTitle>Configuration des 10 Modules Phoenix</CardTitle>
                <CardDescription>
                  Activez ou désactivez les modules de l'architecture Phoenix
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData?.modules?.map((module) => (
                    <div 
                      key={module.id} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${module.isEnabled ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Settings className={`w-5 h-5 ${module.isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <h3 className="font-medium">{module.moduleName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {module.description}
                          </p>
                          <code className="text-xs text-muted-foreground">
                            {module.moduleId}
                          </code>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={module.isEnabled ? "default" : "secondary"}>
                          {module.isEnabled ? "Actif" : "Inactif"}
                        </Badge>
                        <Switch
                          checked={module.isEnabled}
                          onCheckedChange={(checked) => {
                            updateModuleMutation.mutate({
                              moduleId: module.moduleId,
                              isEnabled: checked
                            });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Validations Tab */}
          <TabsContent value="validations">
            <Card>
              <CardHeader>
                <CardTitle>Les 16 Axiomes de Validation</CardTitle>
                <CardDescription>
                  Configurez les validations sensibles et leurs niveaux d'approbation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData?.validations?.map((validation) => (
                    <div 
                      key={validation.id} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${severityColor(validation.severity)}`} />
                        <div>
                          <h3 className="font-medium flex items-center gap-2">
                            {validation.axiomName}
                            <code className="text-xs text-muted-foreground">
                              {validation.axiomId}
                            </code>
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {validation.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={severityColor(validation.severity)}>
                          {validation.severity}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {validation.requiresApproval ? (
                            <Lock className="w-4 h-4 text-orange-500" />
                          ) : (
                            <Unlock className="w-4 h-4 text-green-500" />
                          )}
                          <Switch
                            checked={validation.requiresApproval}
                            onCheckedChange={(checked) => {
                              updateValidationMutation.mutate({
                                axiomId: validation.axiomId,
                                requiresApproval: checked
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Arbitrage Tab */}
          <TabsContent value="arbitrage">
            <ArbitragePanel />
          </TabsContent>

          {/* Actions Web Tab */}
          <TabsContent value="actions">
            <ActionEnginePanel />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <ReporterPanel />
          </TabsContent>

          {/* Renaissance Tab */}
          <TabsContent value="renaissance">
            <RenaissancePanel />
          </TabsContent>

          {/* Communication Tab */}
          <TabsContent value="comms">
            <CommunicationPanel />
          </TabsContent>

          {/* Optimizer Tab */}
          <TabsContent value="optimizer">
            <OptimizerPanel />
          </TabsContent>

          <TabsContent value="security">
            <SecurityPanel />
          </TabsContent>

          {/* Evolution Tab */}
          <TabsContent value="evolution">
            <EvolutionPanel />
          </TabsContent>

          {/* Memory Sync Tab */}
          <TabsContent value="memory">
            <MemorySyncPanel />
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Journal d'Audit Complet
                </CardTitle>
                <CardDescription>
                  Historique complet de toutes les actions administratives
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {dashboardData?.recentAuditLog?.map((log) => (
                      <div 
                        key={log.id} 
                        className="p-4 border rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{log.action}</Badge>
                            <Badge variant="secondary">{log.resourceType}</Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm">
                          <p><strong>Admin ID:</strong> {log.adminId}</p>
                          <p><strong>Resource ID:</strong> {log.resourceId || "N/A"}</p>
                          {log.changes && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-muted-foreground">
                                Détails des changements
                              </summary>
                              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                                {JSON.stringify(log.changes, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// Memory Sync Panel Component
function MemorySyncPanel() {
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    priority: "H2" as "H0" | "H1" | "H2" | "H3",
    category: "",
    tags: ""
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Queries
  const { data: documents, refetch: refetchDocs } = trpc.memorySync.list.useQuery({});
  const { data: pendingDocs, refetch: refetchPending } = trpc.memorySync.list.useQuery({ status: "pending" });
  const { data: stats } = trpc.memorySync.stats.useQuery();
  const { data: searchResults } = trpc.memorySync.search.useQuery(
    { query: searchQuery, limit: 10 },
    { enabled: searchQuery.length > 2 }
  );

  // Mutations
  const approveMutation = trpc.memorySync.approve.useMutation({
    onSuccess: () => {
      toast.success("Document approuvé");
      refetchDocs();
      refetchPending();
    },
    onError: (e) => toast.error(e.message)
  });

  const rejectMutation = trpc.memorySync.reject.useMutation({
    onSuccess: () => {
      toast.success("Document rejeté");
      refetchDocs();
      refetchPending();
    },
    onError: (e) => toast.error(e.message)
  });

  const extractConceptsMutation = trpc.memorySync.extractConcepts.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.conceptsExtracted} concepts extraits`);
      refetchDocs();
    },
    onError: (e) => toast.error(e.message)
  });

  const priorityColors: Record<string, string> = {
    H0: "bg-red-500",
    H1: "bg-orange-500",
    H2: "bg-yellow-500",
    H3: "bg-green-500"
  };

  const priorityLabels: Record<string, string> = {
    H0: "Critique",
    H1: "Haute",
    H2: "Moyenne",
    H3: "Basse"
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Documents Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalDocuments || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {stats?.byStatus?.pending || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Chunks Indexés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">
              {stats?.totalChunks || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Concepts Extraits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-500">
              {stats?.totalConcepts || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pending Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Documents en Attente d'Approbation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {pendingDocs?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun document en attente
                </p>
              ) : (
                <div className="space-y-2">
                  {pendingDocs?.map((doc: any) => (
                    <div key={doc.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={priorityColors[doc.priority]}>
                            {priorityLabels[doc.priority]}
                          </Badge>
                          <span className="font-medium">{doc.title}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-500"
                            onClick={() => approveMutation.mutate({ documentId: doc.id })}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-500"
                            onClick={() => rejectMutation.mutate({ documentId: doc.id })}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {doc.description && (
                        <p className="text-sm text-muted-foreground">{doc.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {doc.fileName} - {doc.category || "Sans catégorie"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Search Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Recherche dans la Base de Connaissances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Rechercher dans les documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
              <ScrollArea className="h-[250px]">
                {searchResults && searchResults.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.map((result: any, idx: number) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={priorityColors[result.priority]}>
                            {result.priority}
                          </Badge>
                          <span className="font-medium text-sm">{result.title}</span>
                          <span className="text-xs text-muted-foreground">
                            Score: {(result.relevanceScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {result.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : searchQuery.length > 2 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Aucun résultat trouvé
                  </p>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Entrez au moins 3 caractères pour rechercher
                  </p>
                )}
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Tous les Documents
          </CardTitle>
          <CardDescription>
            Documents de référence indexés par priorité (H0-H3)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {documents?.map((doc: any) => (
                <div key={doc.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={priorityColors[doc.priority]}>
                        {priorityLabels[doc.priority]}
                      </Badge>
                      <span className="font-medium">{doc.title}</span>
                      <Badge variant={doc.status === "approved" ? "default" : "secondary"}>
                        {doc.status}
                      </Badge>
                      {doc.isIndexed && (
                        <Badge variant="outline" className="text-purple-500">
                          <Database className="w-3 h-3 mr-1" />
                          Indexé
                        </Badge>
                      )}
                    </div>
                    {doc.status === "approved" && !doc.isIndexed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => extractConceptsMutation.mutate({ documentId: doc.id })}
                      >
                        <BookOpen className="w-4 h-4 mr-1" />
                        Extraire Concepts
                      </Button>
                    )}
                  </div>
                  {doc.description && (
                    <p className="text-sm text-muted-foreground mb-2">{doc.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{doc.fileName}</span>
                    <span>{doc.category || "Sans catégorie"}</span>
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex gap-1">
                        {doc.tags.map((tag: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// Arbitrage Panel Component
function ArbitragePanel() {
  const [overrideForm, setOverrideForm] = useState({
    conflictId: "",
    selectedOptionId: "",
    justification: ""
  });
  const [rollbackForm, setRollbackForm] = useState({
    conflictId: "",
    reason: ""
  });
  const [evaluateAction, setEvaluateAction] = useState("");

  // Queries
  const { data: stats, refetch: refetchStats } = trpc.arbitrage.stats.useQuery();
  const { data: decisionLog, refetch: refetchLog } = trpc.arbitrage.decisionLog.useQuery({ limit: 50 });
  const { data: axioms } = trpc.arbitrage.axioms.useQuery();
  const { data: priorityWeights } = trpc.arbitrage.priorityWeights.useQuery();
  const { data: evaluation } = trpc.arbitrage.evaluate.useQuery(
    { action: evaluateAction },
    { enabled: evaluateAction.length > 3 }
  );

  // Mutations
  const overrideMutation = trpc.arbitrage.override.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchStats();
      refetchLog();
      setOverrideForm({ conflictId: "", selectedOptionId: "", justification: "" });
    },
    onError: (e) => toast.error(e.message)
  });

  const rollbackMutation = trpc.arbitrage.rollback.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchStats();
      refetchLog();
      setRollbackForm({ conflictId: "", reason: "" });
    },
    onError: (e) => toast.error(e.message)
  });

  const priorityColors: Record<string, string> = {
    H0: "bg-red-500",
    H1: "bg-orange-500",
    H2: "bg-yellow-500",
    H3: "bg-green-500"
  };

  const priorityLabels: Record<string, string> = {
    H0: "Critique",
    H1: "Haute",
    H2: "Moyenne",
    H3: "Basse"
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Conflits Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalConflicts || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Résolus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {stats?.resolvedConflicts || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bloqués
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {stats?.blockedConflicts || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {stats?.pendingApprovals || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rollbacks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">
              {stats?.rollbacks || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Axioms Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5" />
              16 Axiomes de Référence
            </CardTitle>
            <CardDescription>
              Hiérarchie des axiomes utilisés pour l'arbitrage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {axioms && Object.entries(axioms).map(([id, axiom]: [string, any]) => (
                  <div key={id} className="p-2 border rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={priorityColors[axiom.priority]}>
                        {axiom.priority}
                      </Badge>
                      <span className="font-medium text-sm">{id}: {axiom.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Poids: {priorityWeights?.[axiom.priority as keyof typeof priorityWeights] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Action Evaluator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertOctagon className="w-5 h-5" />
              Évaluateur d'Actions
            </CardTitle>
            <CardDescription>
              Testez une action contre les 16 axiomes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Décrivez l'action à évaluer..."
                value={evaluateAction}
                onChange={(e) => setEvaluateAction(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
              {evaluation && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={evaluation.canProceed ? "default" : "destructive"}>
                      {evaluation.canProceed ? "Peut procéder" : "Bloqué"}
                    </Badge>
                    <span className="text-sm">
                      Score de risque: {(evaluation.riskScore * 100).toFixed(1)}%
                    </span>
                  </div>
                  {evaluation.violations.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Violations détectées:</p>
                      {evaluation.violations.map((v: any, i: number) => (
                        <div key={i} className="p-2 bg-red-500/10 rounded text-sm">
                          <Badge className={priorityColors[v.priority]} variant="outline">
                            {v.priority}
                          </Badge>
                          <span className="ml-2">{v.axiomName}: {v.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Override */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Unlock className="w-5 h-5" />
              Override Admin
            </CardTitle>
            <CardDescription>
              Passer outre un conflit bloqué (réservé Admin)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="ID du conflit (ARB-...)"
                value={overrideForm.conflictId}
                onChange={(e) => setOverrideForm({ ...overrideForm, conflictId: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
              <input
                type="text"
                placeholder="ID de l'option sélectionnée"
                value={overrideForm.selectedOptionId}
                onChange={(e) => setOverrideForm({ ...overrideForm, selectedOptionId: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
              <textarea
                placeholder="Justification de l'override..."
                value={overrideForm.justification}
                onChange={(e) => setOverrideForm({ ...overrideForm, justification: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px]"
              />
              <Button
                onClick={() => overrideMutation.mutate(overrideForm)}
                disabled={!overrideForm.conflictId || !overrideForm.justification || overrideMutation.isPending}
                className="w-full"
              >
                {overrideMutation.isPending ? "Traitement..." : "Appliquer Override"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rollback */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Undo2 className="w-5 h-5" />
              Protocole Renaissance (Rollback)
            </CardTitle>
            <CardDescription>
              Retour à l'état stable précédent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="ID du conflit (ARB-...)"
                value={rollbackForm.conflictId}
                onChange={(e) => setRollbackForm({ ...rollbackForm, conflictId: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
              <textarea
                placeholder="Raison du rollback..."
                value={rollbackForm.reason}
                onChange={(e) => setRollbackForm({ ...rollbackForm, reason: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px]"
              />
              <Button
                variant="destructive"
                onClick={() => rollbackMutation.mutate(rollbackForm)}
                disabled={!rollbackForm.conflictId || !rollbackForm.reason || rollbackMutation.isPending}
                className="w-full"
              >
                {rollbackMutation.isPending ? "Traitement..." : "Initier Rollback"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Decision Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Journal des Décisions d'Arbitrage
          </CardTitle>
          <CardDescription>
            Historique des conflits et résolutions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {decisionLog && decisionLog.length > 0 ? (
              <div className="space-y-2">
                {decisionLog.map((entry: any, idx: number) => (
                  <div key={idx} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge className={priorityColors[entry.priority]}>
                          {entry.priority}
                        </Badge>
                        <span className="font-medium text-sm">{entry.action}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Aucune décision d'arbitrage enregistrée
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}


// ==================== ACTION ENGINE PANEL ====================
function ActionEnginePanel() {
  const [taskForm, setTaskForm] = useState({
    description: "",
    taskType: "search" as "search" | "extract" | "navigate" | "interact" | "monitor",
    targetUrl: "",
    priority: "medium" as "low" | "medium" | "high" | "critical"
  });
  const [securityCheckContent, setSecurityCheckContent] = useState("");
  const [domainToValidate, setDomainToValidate] = useState("");

  const { data: stats, refetch: refetchStats } = trpc.actionEngine.getStats.useQuery();
  const { data: userTasks, refetch: refetchTasks } = trpc.actionEngine.getUserTasks.useQuery();
  const { data: securityFilters } = trpc.actionEngine.getSecurityFilters.useQuery();
  const { data: trustedDomains } = trpc.actionEngine.getTrustedDomains.useQuery();

  const createTaskMutation = trpc.actionEngine.createTask.useMutation({
    onSuccess: () => {
      toast.success("Tâche créée avec succès");
      refetchTasks();
      refetchStats();
      setTaskForm({ description: "", taskType: "search", targetUrl: "", priority: "medium" });
    },
    onError: (error) => toast.error(error.message)
  });

  const executeTaskMutation = trpc.actionEngine.executeTask.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Tâche exécutée avec succès");
      } else {
        toast.error(result.error || "Échec de l'exécution");
      }
      refetchTasks();
      refetchStats();
    },
    onError: (error) => toast.error(error.message)
  });

  const cancelTaskMutation = trpc.actionEngine.cancelTask.useMutation({
    onSuccess: () => {
      toast.success("Tâche annulée");
      refetchTasks();
      refetchStats();
    },
    onError: (error) => toast.error(error.message)
  });

  const { data: securityCheckResult } = trpc.actionEngine.checkSecurity.useQuery(
    { content: securityCheckContent },
    { enabled: securityCheckContent.length > 0 }
  );

  const { data: domainValidation } = trpc.actionEngine.validateDomain.useQuery(
    { url: domainToValidate },
    { enabled: domainToValidate.length > 0 }
  );

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500",
    validating: "bg-blue-500",
    executing: "bg-purple-500",
    completed: "bg-green-500",
    blocked: "bg-red-500",
    failed: "bg-gray-500"
  };

  const priorityColors: Record<string, string> = {
    low: "bg-gray-500",
    medium: "bg-blue-500",
    high: "bg-orange-500",
    critical: "bg-red-500"
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.totalTasks || 0}</div>
            <p className="text-xs text-muted-foreground">Total Tâches</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">{stats?.completedTasks || 0}</div>
            <p className="text-xs text-muted-foreground">Complétées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-500">{stats?.blockedTasks || 0}</div>
            <p className="text-xs text-muted-foreground">Bloquées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-500">{stats?.pendingTasks || 0}</div>
            <p className="text-xs text-muted-foreground">En attente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-500">{stats?.securityBlocksCount || 0}</div>
            <p className="text-xs text-muted-foreground">Blocages Sécurité</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create Task */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Créer une Tâche Web
            </CardTitle>
            <CardDescription>
              Soumettre une nouvelle action web à l'arbitrage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Description de la tâche..."
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
              <select
                value={taskForm.taskType}
                onChange={(e) => setTaskForm({ ...taskForm, taskType: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="search">Recherche</option>
                <option value="extract">Extraction</option>
                <option value="navigate">Navigation</option>
                <option value="interact">Interaction</option>
                <option value="monitor">Surveillance</option>
              </select>
              <input
                type="text"
                placeholder="URL cible (optionnel)"
                value={taskForm.targetUrl}
                onChange={(e) => setTaskForm({ ...taskForm, targetUrl: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="low">Basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="critical">Critique</option>
              </select>
              <Button
                onClick={() => createTaskMutation.mutate(taskForm)}
                disabled={!taskForm.description || createTaskMutation.isPending}
                className="w-full"
              >
                {createTaskMutation.isPending ? "Création..." : "Créer la Tâche"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Check */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Vérification de Sécurité
            </CardTitle>
            <CardDescription>
              Tester le contenu contre les filtres de sécurité
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <textarea
                placeholder="Contenu à vérifier..."
                value={securityCheckContent}
                onChange={(e) => setSecurityCheckContent(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background min-h-[100px]"
              />
              {securityCheckResult && (
                <div className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    {securityCheckResult.blocked ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : securityCheckResult.redacted ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    <span className="font-medium">
                      {securityCheckResult.blocked ? "Bloqué" : 
                       securityCheckResult.redacted ? "Expurgé" : "Sûr"}
                    </span>
                  </div>
                  {securityCheckResult.triggeredFilters.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {securityCheckResult.triggeredFilters.map((filter, idx) => (
                        <Badge key={idx} variant="outline">{filter}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Domain Validation & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Validation de Domaine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="https://example.com"
                value={domainToValidate}
                onChange={(e) => setDomainToValidate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
              {domainValidation && (
                <div className="flex items-center gap-2 p-3 border rounded-lg">
                  {domainValidation.trusted ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  )}
                  <span>
                    {domainValidation.domain}: {domainValidation.trusted ? "Domaine de confiance" : "Domaine externe"}
                  </span>
                </div>
              )}
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Domaines de confiance:</p>
                <div className="flex flex-wrap gap-1">
                  {trustedDomains?.map((domain, idx) => (
                    <Badge key={idx} variant="secondary">{domain}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Filtres de Sécurité Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {securityFilters?.map((filter, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{filter.name}</span>
                    <div className="flex gap-2">
                      <Badge className={priorityColors[filter.priority.toLowerCase()] || "bg-gray-500"}>
                        {filter.priority}
                      </Badge>
                      <Badge variant={filter.action === "block" ? "destructive" : "outline"}>
                        {filter.action}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Tâches Web Récentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {userTasks && userTasks.length > 0 ? (
              <div className="space-y-2">
                {userTasks.map((task: any) => (
                  <div key={task.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[task.status]}>{task.status}</Badge>
                        <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                        <span className="font-medium text-sm">{task.taskType}</span>
                      </div>
                      <div className="flex gap-2">
                        {(task.status === "pending" || task.status === "validating") && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => executeTaskMutation.mutate({ taskId: task.id })}
                              disabled={executeTaskMutation.isPending}
                            >
                              <Play className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => cancelTaskMutation.mutate({ taskId: task.id })}
                              disabled={cancelTaskMutation.isPending}
                            >
                              <Square className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-sm">{task.description}</p>
                    {task.targetUrl && (
                      <p className="text-xs text-muted-foreground mt-1">{task.targetUrl}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(task.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Aucune tâche web enregistrée
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== REPORTER PANEL ====================
function ReporterPanel() {
  const [reportPeriod, setReportPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  const { data: quickSummary, refetch: refetchSummary } = trpc.reporter.getQuickSummary.useQuery();
  const { data: reportHistory } = trpc.reporter.getReportHistory.useQuery({ limit: 10 });
  const { data: unresolvedAlerts, refetch: refetchAlerts } = trpc.reporter.getUnresolvedAlerts.useQuery();
  const { data: integrityTrend } = trpc.reporter.getIntegrityTrend.useQuery({ days: 30 });

  const generateReportMutation = trpc.reporter.generateReport.useMutation({
    onSuccess: (report) => {
      toast.success(`Rapport généré: ${report.title}`);
      refetchSummary();
    },
    onError: (error) => toast.error(error.message)
  });

  const resolveAlertMutation = trpc.reporter.resolveAlert.useMutation({
    onSuccess: () => {
      toast.success("Alerte résolue");
      refetchAlerts();
      refetchSummary();
    },
    onError: (error) => toast.error(error.message)
  });

  const trendIcon = quickSummary?.trend === "improving" ? (
    <TrendingUp className="w-5 h-5 text-green-500" />
  ) : quickSummary?.trend === "declining" ? (
    <TrendingDown className="w-5 h-5 text-red-500" />
  ) : (
    <Activity className="w-5 h-5 text-blue-500" />
  );

  const severityColors: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-green-500"
  };

  return (
    <div className="space-y-6">
      {/* Quick Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{quickSummary?.integrityScore?.toFixed(1) || 0}%</div>
                <p className="text-xs text-muted-foreground">Score d'Intégrité</p>
              </div>
              {trendIcon}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-500">{quickSummary?.unresolvedAlerts || 0}</div>
            <p className="text-xs text-muted-foreground">Alertes Non Résolues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{quickSummary?.recentActions || 0}</div>
            <p className="text-xs text-muted-foreground">Actions Récentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm">
              {quickSummary?.lastReportDate 
                ? new Date(quickSummary.lastReportDate).toLocaleDateString()
                : "Aucun"}
            </div>
            <p className="text-xs text-muted-foreground">Dernier Rapport</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Generate Report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileBarChart className="w-5 h-5" />
              Générer un Rapport
            </CardTitle>
            <CardDescription>
              Créer un rapport d'intégrité Phoenix
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <select
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="daily">Quotidien</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuel</option>
              </select>
              <Button
                onClick={() => generateReportMutation.mutate({ period: reportPeriod })}
                disabled={generateReportMutation.isPending}
                className="w-full"
              >
                {generateReportMutation.isPending ? "Génération..." : "Générer le Rapport"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Unresolved Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Alertes Critiques
            </CardTitle>
            <CardDescription>
              Alertes nécessitant une attention immédiate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {unresolvedAlerts && unresolvedAlerts.length > 0 ? (
                <div className="space-y-2">
                  {unresolvedAlerts.map((alert: any) => (
                    <div key={alert.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <Badge className={severityColors[alert.severity]}>{alert.severity}</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveAlertMutation.mutate({ alertId: alert.id })}
                          disabled={resolveAlertMutation.isPending}
                        >
                          Résoudre
                        </Button>
                      </div>
                      <p className="text-sm">{alert.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Aucune alerte non résolue
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Report History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Historique des Rapports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {reportHistory?.reports && reportHistory.reports.length > 0 ? (
              <div className="space-y-2">
                {reportHistory.reports.map((report: any) => (
                  <div key={report.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{report.title}</span>
                      <Badge variant="outline">{report.period}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Intégrité: </span>
                        <span className="font-medium">{report.integrityScore?.overall?.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Actions: </span>
                        <span className="font-medium">{report.actionSummary?.totalActions || 0}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Alertes: </span>
                        <span className="font-medium">{report.criticalAlerts?.length || 0}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Généré le {new Date(report.generatedAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Aucun rapport généré
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Integrity Trend */}
      {integrityTrend && integrityTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Tendance d'Intégrité (30 jours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[100px] flex items-end gap-1">
              {integrityTrend.map((point: any, idx: number) => (
                <div
                  key={idx}
                  className="flex-1 bg-primary rounded-t"
                  style={{ height: `${point.score}%` }}
                  title={`${point.score.toFixed(1)}% - ${new Date(point.timestamp).toLocaleDateString()}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


/**
 * Renaissance Panel - Module 06: Auto-Correction & Résilience
 */
function RenaissancePanel() {
  const utils = trpc.useUtils();
  const { data: healthReport } = trpc.renaissance.getHealthReport.useQuery();
  const { data: stats } = trpc.renaissance.getStats.useQuery();
  const { data: errors } = trpc.renaissance.getErrors.useQuery({ includeResolved: false });
  const { data: cycles } = trpc.renaissance.getCycles.useQuery({ limit: 10 });

  const adminValidate = trpc.renaissance.adminValidate.useMutation({
    onSuccess: () => {
      utils.renaissance.getHealthReport.invalidate();
      utils.renaissance.getStats.invalidate();
    }
  });

  const forceRenaissance = trpc.renaissance.forceRenaissance.useMutation({
    onSuccess: () => {
      utils.renaissance.getHealthReport.invalidate();
      utils.renaissance.getStats.invalidate();
      utils.renaissance.getCycles.invalidate();
    }
  });

  const resolveError = trpc.renaissance.resolveError.useMutation({
    onSuccess: () => {
      utils.renaissance.getErrors.invalidate();
      utils.renaissance.getStats.invalidate();
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      case 'recovering': return 'bg-blue-500';
      case 'locked': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'healthy': return 'Sain';
      case 'degraded': return 'Dégradé';
      case 'critical': return 'Critique';
      case 'recovering': return 'Récupération';
      case 'locked': return 'Verrouillé';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'H0': return 'bg-red-500';
      case 'H1': return 'bg-orange-500';
      case 'H2': return 'bg-yellow-500';
      case 'H3': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">État du Système</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(healthReport?.status || 'healthy')}`} />
                  <span className="text-2xl font-bold">{getStatusLabel(healthReport?.status || 'healthy')}</span>
                </div>
              </div>
              <Heart className={`w-8 h-8 ${healthReport?.status === 'healthy' ? 'text-green-500' : 'text-red-500'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Erreurs Non Résolues</p>
                <p className="text-2xl font-bold">{stats?.unresolvedErrors || 0}</p>
              </div>
              <AlertTriangle className={`w-8 h-8 ${(stats?.unresolvedErrors || 0) > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cycles Renaissance</p>
                <p className="text-2xl font-bold">{stats?.renaissanceCycles || 0}</p>
              </div>
              <Flame className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Échecs Consécutifs</p>
                <p className="text-2xl font-bold">{stats?.consecutiveFailures || 0}</p>
              </div>
              <Zap className={`w-8 h-8 ${(stats?.consecutiveFailures || 0) > 2 ? 'text-red-500' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Lock Warning */}
      {stats?.systemLocked && (
        <Card className="border-purple-500 bg-purple-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-8 h-8 text-purple-500" />
                <div>
                  <h3 className="font-bold text-lg">Système Verrouillé</h3>
                  <p className="text-sm text-muted-foreground">
                    Le système a atteint la limite de 3 cycles Renaissance sans validation Admin.
                    Validation requise pour déverrouiller.
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => adminValidate.mutate()}
                disabled={adminValidate.isPending}
                className="bg-purple-500 hover:bg-purple-600"
              >
                {adminValidate.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Unlock className="w-4 h-4 mr-2" />
                )}
                Valider & Déverrouiller
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Santé des Modules
            </CardTitle>
            <CardDescription>État de chaque module Phoenix</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {healthReport?.moduleHealth && Object.entries(healthReport.moduleHealth).map(([name, health]: [string, any]) => (
                  <div key={name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        health.status === 'operational' ? 'bg-green-500' :
                        health.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className="font-medium">{name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={health.status === 'operational' ? 'default' : 'destructive'}>
                        {health.status === 'operational' ? 'Opérationnel' :
                         health.status === 'degraded' ? 'Dégradé' : 'Échec'}
                      </Badge>
                      {health.errorCount > 0 && (
                        <Badge variant="outline">{health.errorCount} erreurs</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Active Errors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertOctagon className="w-5 h-5" />
              Erreurs Actives
            </CardTitle>
            <CardDescription>Erreurs nécessitant une attention</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {errors && errors.length > 0 ? (
                <div className="space-y-3">
                  {errors.map((error: any) => (
                    <div key={error.id} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={getPriorityColor(error.priority)}>{error.priority}</Badge>
                          <span className="font-medium">{error.module}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveError.mutate({ errorId: error.id })}
                          disabled={resolveError.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Résoudre
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Sévérité: {error.severity}</span>
                        <span>{new Date(error.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>Aucune erreur active</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Renaissance Cycles History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Flame className="w-5 h-5" />
                Historique des Cycles Renaissance
              </CardTitle>
              <CardDescription>Réinitialisations système passées</CardDescription>
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                const reason = prompt("Raison de la Renaissance forcée:");
                if (reason) {
                  forceRenaissance.mutate({ reason });
                }
              }}
              disabled={forceRenaissance.isPending}
            >
              {forceRenaissance.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Flame className="w-4 h-4 mr-2" />
              )}
              Forcer Renaissance
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {cycles && cycles.length > 0 ? (
              <div className="space-y-3">
                {cycles.map((cycle: any) => (
                  <div key={cycle.id} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={cycle.status === 'completed' ? 'default' : 
                                         cycle.status === 'failed' ? 'destructive' : 'secondary'}>
                            {cycle.status === 'completed' ? 'Complété' :
                             cycle.status === 'failed' ? 'Échoué' :
                             cycle.status === 'blocked' ? 'Bloqué' : 'En cours'}
                          </Badge>
                          {cycle.adminValidated && (
                            <Badge variant="outline" className="text-green-500 border-green-500">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Validé Admin
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium mt-2">{cycle.reason}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {cycle.id}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Erreurs nettoyées: </span>
                        <span className="font-medium">{cycle.errorsCleared}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Modules réinitialisés: </span>
                        <span className="font-medium">{cycle.modulesReset?.length || 0}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Déclenché: </span>
                        <span className="font-medium">{new Date(cycle.triggeredAt).toLocaleString()}</span>
                      </div>
                    </div>
                    {cycle.modulesReset && cycle.modulesReset.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {cycle.modulesReset.map((module: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {module}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Flame className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucun cycle Renaissance enregistré</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}


/**
 * Communication Panel - Module 07: Communication & Interface
 */
function CommunicationPanel() {
  const utils = trpc.useUtils();
  const [newNotification, setNewNotification] = useState({
    type: 'info' as 'alert' | 'info' | 'warning' | 'approval_request',
    message: '',
    priority: 'H3' as 'H0' | 'H1' | 'H2' | 'H3',
    targetRole: 'all' as 'admin' | 'user' | 'viewer' | 'all'
  });

  const { data: stats } = trpc.communication.getStats.useQuery();
  const { data: notifications } = trpc.communication.getNotifications.useQuery({ includeRead: true });
  const { data: alertLevel } = trpc.communication.getAlertLevel.useQuery();
  const { data: messageHistory } = trpc.communication.getMessageHistory.useQuery({ limit: 50 });
  const { data: axiomDescriptions } = trpc.communication.getAxiomDescriptions.useQuery();

  const sendNotification = trpc.communication.sendNotification.useMutation({
    onSuccess: () => {
      utils.communication.getNotifications.invalidate();
      utils.communication.getStats.invalidate();
      setNewNotification({
        type: 'info',
        message: '',
        priority: 'H3',
        targetRole: 'all'
      });
    }
  });

  const markAsRead = trpc.communication.markAsRead.useMutation({
    onSuccess: () => {
      utils.communication.getNotifications.invalidate();
      utils.communication.getStats.invalidate();
    }
  });

  const markAllAsRead = trpc.communication.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.communication.getNotifications.invalidate();
      utils.communication.getStats.invalidate();
    }
  });

  const resetAlertLevel = trpc.communication.resetAlertLevel.useMutation({
    onSuccess: () => {
      utils.communication.getAlertLevel.invalidate();
    }
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'H0': return 'bg-red-500';
      case 'H1': return 'bg-orange-500';
      case 'H2': return 'bg-yellow-500';
      case 'H3': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="w-4 h-4" />;
      case 'warning': return <AlertOctagon className="w-4 h-4" />;
      case 'approval_request': return <CheckCircle className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getAlertLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-500';
      case 'elevated': return 'text-orange-500';
      default: return 'text-green-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Messages Total</p>
                <p className="text-2xl font-bold">{stats?.totalMessages || 0}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertes Admin</p>
                <p className="text-2xl font-bold">{stats?.adminAlerts || 0}</p>
              </div>
              <Shield className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Notifications</p>
                <p className="text-2xl font-bold">{stats?.pendingNotifications || 0}</p>
              </div>
              <BellRing className={`w-8 h-8 ${(stats?.pendingNotifications || 0) > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertes Critiques</p>
                <p className="text-2xl font-bold">{stats?.criticalAlerts || 0}</p>
              </div>
              <AlertTriangle className={`w-8 h-8 ${(stats?.criticalAlerts || 0) > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Niveau d'Alerte</p>
                <p className={`text-2xl font-bold capitalize ${getAlertLevelColor(alertLevel || 'standard')}`}>
                  {alertLevel === 'critical' ? 'Critique' : 
                   alertLevel === 'elevated' ? 'Élevé' : 'Standard'}
                </p>
              </div>
              {alertLevel !== 'standard' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resetAlertLevel.mutate()}
                >
                  Réinitialiser
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send Notification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Envoyer une Notification
            </CardTitle>
            <CardDescription>Créer une notification pour les utilisateurs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  className="w-full mt-1 p-2 rounded-md border bg-background"
                  value={newNotification.type}
                  onChange={(e) => setNewNotification({
                    ...newNotification,
                    type: e.target.value as any
                  })}
                >
                  <option value="info">Information</option>
                  <option value="warning">Avertissement</option>
                  <option value="alert">Alerte</option>
                  <option value="approval_request">Demande d'approbation</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Priorité</label>
                <select
                  className="w-full mt-1 p-2 rounded-md border bg-background"
                  value={newNotification.priority}
                  onChange={(e) => setNewNotification({
                    ...newNotification,
                    priority: e.target.value as any
                  })}
                >
                  <option value="H3">H3 - Basse</option>
                  <option value="H2">H2 - Moyenne</option>
                  <option value="H1">H1 - Haute</option>
                  <option value="H0">H0 - Critique</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Destinataire</label>
              <select
                className="w-full mt-1 p-2 rounded-md border bg-background"
                value={newNotification.targetRole}
                onChange={(e) => setNewNotification({
                  ...newNotification,
                  targetRole: e.target.value as any
                })}
              >
                <option value="all">Tous</option>
                <option value="admin">Admin uniquement</option>
                <option value="user">Utilisateurs</option>
                <option value="viewer">Viewers</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Message</label>
              <textarea
                className="w-full mt-1 p-2 rounded-md border bg-background min-h-[100px]"
                placeholder="Contenu de la notification..."
                value={newNotification.message}
                onChange={(e) => setNewNotification({
                  ...newNotification,
                  message: e.target.value
                })}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => sendNotification.mutate(newNotification)}
              disabled={!newNotification.message || sendNotification.isPending}
            >
              {sendNotification.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Envoyer
            </Button>
          </CardContent>
        </Card>

        {/* Active Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BellRing className="w-5 h-5" />
                  Notifications Actives
                </CardTitle>
                <CardDescription>Notifications en attente de lecture</CardDescription>
              </div>
              {notifications && notifications.filter((n: any) => !n.read).length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markAllAsRead.mutate()}
                >
                  Tout marquer lu
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {notifications && notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((notif: any) => (
                    <div
                      key={notif.id}
                      className={`p-3 rounded-lg border ${notif.read ? 'opacity-60' : 'bg-card'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(notif.type)}
                          <Badge className={getPriorityColor(notif.priority)}>
                            {notif.priority}
                          </Badge>
                          <Badge variant="outline">{notif.targetRole}</Badge>
                        </div>
                        {!notif.read && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markAsRead.mutate({ notificationId: notif.id })}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm mt-2">{notif.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{new Date(notif.createdAt).toLocaleString()}</span>
                        {notif.actionRequired && (
                          <Badge variant="destructive" className="text-xs">Action requise</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BellRing className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Aucune notification</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Axiom Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Référence des 16 Axiomes
          </CardTitle>
          <CardDescription>Axiomes utilisés pour justifier les décisions Phoenix</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {axiomDescriptions && Object.entries(axiomDescriptions).map(([key, desc]) => (
              <div key={key} className="p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="font-mono">{key}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{desc as string}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Message History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Historique des Messages
          </CardTitle>
          <CardDescription>Derniers messages formatés par Phoenix</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {messageHistory && messageHistory.length > 0 ? (
              <div className="space-y-3">
                {messageHistory.map((msg: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getPriorityColor(msg.priority)}>{msg.priority}</Badge>
                      <Badge variant="outline">{msg.role}</Badge>
                      {msg.axiomReference && (
                        <Badge variant="secondary">{msg.axiomReference}</Badge>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{new Date(msg.timestamp).toLocaleString()}</span>
                      {msg.confidenceScore !== undefined && (
                        <span>Confiance: {(msg.confidenceScore * 100).toFixed(1)}%</span>
                      )}
                      {msg.tormentScore !== undefined && (
                        <span>Tourment: {(msg.tormentScore * 100).toFixed(1)}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucun message dans l'historique</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}


// ==================== Module 08: Optimizer Panel ====================
function OptimizerPanel() {
  const [resourceLimit, setResourceLimit] = useState(0.85);
  const [newTaskPriority, setNewTaskPriority] = useState<'H0' | 'H1' | 'H2' | 'H3'>('H2');
  const [newTaskDescription, setNewTaskDescription] = useState('');

  // Queries
  const { data: resourceMetrics, refetch: refetchMetrics } = trpc.optimizer.getResourceMetrics.useQuery();
  const { data: efficiencyMetrics, refetch: refetchEfficiency } = trpc.optimizer.getEfficiencyMetrics.useQuery();
  const { data: optimizationStats, refetch: refetchStats } = trpc.optimizer.getOptimizationStats.useQuery();
  const { data: queuedTasks, refetch: refetchQueued } = trpc.optimizer.getQueuedTasks.useQuery();
  const { data: runningTasks, refetch: refetchRunning } = trpc.optimizer.getRunningTasks.useQuery();
  const { data: recentTasks, refetch: refetchRecent } = trpc.optimizer.getRecentCompletedTasks.useQuery({ limit: 20 });
  const { data: loadHistory } = trpc.optimizer.getLoadHistory.useQuery({ samples: 50 });
  const { data: currentLimit } = trpc.optimizer.getResourceLimit.useQuery();

  // Mutations
  const allocateTask = trpc.optimizer.allocateTask.useMutation({
    onSuccess: () => {
      toast.success("Tâche allouée avec succès");
      refetchAll();
      setNewTaskDescription('');
    },
    onError: (err) => toast.error(err.message)
  });

  const cancelTask = trpc.optimizer.cancelTask.useMutation({
    onSuccess: () => {
      toast.success("Tâche annulée");
      refetchAll();
    },
    onError: (err) => toast.error(err.message)
  });

  const setLimit = trpc.optimizer.setResourceLimit.useMutation({
    onSuccess: () => {
      toast.success("Limite de ressources mise à jour");
      refetchAll();
    },
    onError: (err) => toast.error(err.message)
  });

  const forceProcess = trpc.optimizer.forceProcessQueue.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.processed} tâches traitées`);
      refetchAll();
    },
    onError: (err) => toast.error(err.message)
  });

  const clearQueues = trpc.optimizer.clearQueues.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.cleared} tâches supprimées des files d'attente`);
      refetchAll();
    },
    onError: (err) => toast.error(err.message)
  });

  const refetchAll = () => {
    refetchMetrics();
    refetchEfficiency();
    refetchStats();
    refetchQueued();
    refetchRunning();
    refetchRecent();
  };

  useEffect(() => {
    if (currentLimit) {
      setResourceLimit(currentLimit.limit);
    }
  }, [currentLimit]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'H0': return 'bg-red-500/20 text-red-500 border-red-500/50';
      case 'H1': return 'bg-orange-500/20 text-orange-500 border-orange-500/50';
      case 'H2': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
      case 'H3': return 'bg-green-500/20 text-green-500 border-green-500/50';
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500/20 text-blue-500';
      case 'completed': return 'bg-green-500/20 text-green-500';
      case 'failed': return 'bg-red-500/20 text-red-500';
      case 'cancelled': return 'bg-gray-500/20 text-gray-500';
      case 'queued': return 'bg-yellow-500/20 text-yellow-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Resource Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Charge Actuelle</p>
                <p className="text-2xl font-bold">
                  {resourceMetrics ? `${(resourceMetrics.currentLoad * 100).toFixed(1)}%` : '0%'}
                </p>
              </div>
              <Gauge className={`w-8 h-8 ${
                resourceMetrics && resourceMetrics.currentLoad > 0.85 
                  ? 'text-red-500' 
                  : resourceMetrics && resourceMetrics.currentLoad > 0.6 
                    ? 'text-yellow-500' 
                    : 'text-green-500'
              }`} />
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  resourceMetrics && resourceMetrics.currentLoad > 0.85 
                    ? 'bg-red-500' 
                    : resourceMetrics && resourceMetrics.currentLoad > 0.6 
                      ? 'bg-yellow-500' 
                      : 'bg-green-500'
                }`}
                style={{ width: `${(resourceMetrics?.currentLoad || 0) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Performance</p>
                <p className="text-2xl font-bold">
                  {efficiencyMetrics ? `${efficiencyMetrics.performanceIndex}/100` : '0/100'}
                </p>
              </div>
              <Activity className="w-8 h-8 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Débit: {efficiencyMetrics?.throughput.toFixed(2) || 0} tâches/min
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">File d'Attente</p>
                <p className="text-2xl font-bold">{queuedTasks?.length || 0}</p>
              </div>
              <ListOrdered className="w-8 h-8 text-yellow-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Temps moyen: {efficiencyMetrics?.queueWaitTime.toFixed(1) || 0}s
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Cours</p>
                <p className="text-2xl font-bold">{runningTasks?.length || 0}</p>
              </div>
              <Cpu className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Traitées: {resourceMetrics?.totalTasksProcessed || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Efficiency Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Métriques d'Efficacité
          </CardTitle>
          <CardDescription>Performance et optimisation du système</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Efficacité Ressources</p>
              <p className="text-xl font-bold">
                {efficiencyMetrics ? `${(efficiencyMetrics.resourceEfficiency * 100).toFixed(1)}%` : '0%'}
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Réduction Tourment</p>
              <p className="text-xl font-bold">
                {efficiencyMetrics ? `${(efficiencyMetrics.tormentReduction * 100).toFixed(1)}%` : '0%'}
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Conformité Priorité</p>
              <p className="text-xl font-bold">
                {efficiencyMetrics ? `${(efficiencyMetrics.priorityCompliance * 100).toFixed(1)}%` : '0%'}
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Latence Moyenne</p>
              <p className="text-xl font-bold">
                {efficiencyMetrics ? `${efficiencyMetrics.averageLatency.toFixed(2)}s` : '0s'}
              </p>
            </div>
          </div>

          {/* Load History Chart (simplified) */}
          {loadHistory && loadHistory.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium mb-2">Historique de Charge</p>
              <div className="h-20 flex items-end gap-0.5">
                {loadHistory.map((load: number, idx: number) => (
                  <div
                    key={idx}
                    className={`flex-1 rounded-t transition-all ${
                      load > 0.85 ? 'bg-red-500' : load > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ height: `${load * 100}%` }}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Priority Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5" />
            Statistiques par Priorité
          </CardTitle>
          <CardDescription>Répartition des tâches selon les niveaux H0-H3</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['H0', 'H1', 'H2', 'H3'] as const).map((priority) => {
              const stats = optimizationStats?.byPriority[priority];
              return (
                <div key={priority} className={`p-4 rounded-lg border ${getPriorityColor(priority)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getPriorityColor(priority)}>{priority}</Badge>
                    <span className="text-xs">
                      {priority === 'H0' ? 'Critique' : priority === 'H1' ? 'Haute' : priority === 'H2' ? 'Normale' : 'Basse'}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>En attente:</span>
                      <span className="font-medium">{stats?.queued || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>En cours:</span>
                      <span className="font-medium">{stats?.running || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Terminées:</span>
                      <span className="font-medium">{stats?.completed || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Échouées:</span>
                      <span className="font-medium">{stats?.failed || 0}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Attente moy.:</span>
                      <span>{stats?.averageWaitTime.toFixed(1) || 0}s</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Resource Limit Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuration des Ressources
          </CardTitle>
          <CardDescription>Ajuster la limite de ressources et gérer les files d'attente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Limite de Ressources</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={resourceLimit * 100}
                  onChange={(e) => setResourceLimit(parseInt(e.target.value) / 100)}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-16">{(resourceLimit * 100).toFixed(0)}%</span>
              </div>
            </div>
            <Button
              onClick={() => setLimit.mutate({ limit: resourceLimit })}
              disabled={setLimit.isPending}
            >
              Appliquer
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => forceProcess.mutate()}
              disabled={forceProcess.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              Forcer le Traitement
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm("Êtes-vous sûr de vouloir vider toutes les files d'attente ?")) {
                  clearQueues.mutate();
                }
              }}
              disabled={clearQueues.isPending}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Vider les Files
            </Button>
            <Button variant="outline" onClick={refetchAll}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Task Allocation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Tester l'Allocation
          </CardTitle>
          <CardDescription>Créer une tâche de test pour vérifier le système d'allocation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <select
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value as any)}
              className="px-3 py-2 rounded-md border bg-background"
            >
              <option value="H0">H0 - Critique</option>
              <option value="H1">H1 - Haute</option>
              <option value="H2">H2 - Normale</option>
              <option value="H3">H3 - Basse</option>
            </select>
            <input
              type="text"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              placeholder="Description de la tâche..."
              className="flex-1 px-3 py-2 rounded-md border bg-background"
            />
            <Button
              onClick={() => allocateTask.mutate({
                priority: newTaskPriority,
                description: newTaskDescription || 'Tâche de test',
                estimatedDuration: 30
              })}
              disabled={allocateTask.isPending}
            >
              Allouer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Running Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5" />
            Tâches en Cours ({runningTasks?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {runningTasks && runningTasks.length > 0 ? (
              <div className="space-y-2">
                {runningTasks.map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                      <div>
                        <p className="text-sm font-medium">{task.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Démarré: {new Date(task.startedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => cancelTask.mutate({ taskId: task.id })}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Cpu className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucune tâche en cours</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Queued Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="w-5 h-5" />
            File d'Attente ({queuedTasks?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {queuedTasks && queuedTasks.length > 0 ? (
              <div className="space-y-2">
                {queuedTasks.map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                      <div>
                        <p className="text-sm font-medium">{task.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Créé: {new Date(task.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => cancelTask.mutate({ taskId: task.id })}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ListOrdered className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>File d'attente vide</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recent Completed Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="w-5 h-5" />
            Tâches Récentes
          </CardTitle>
          <CardDescription>Dernières tâches traitées</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {recentTasks && recentTasks.length > 0 ? (
              <div className="space-y-2">
                {recentTasks.map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                      <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                      <div>
                        <p className="text-sm font-medium">{task.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Durée: {task.actualDuration?.toFixed(2) || 0}s
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(task.completedAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Timer className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucune tâche récente</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}


// ==================== SECURITY PANEL ====================
function SecurityPanel() {
  const { data: status, refetch: refetchStatus } = trpc.security.getStatus.useQuery();
  const { data: metrics, refetch: refetchMetrics } = trpc.security.getMetrics.useQuery();
  const { data: auditLog, refetch: refetchAudit } = trpc.security.getAuditLog.useQuery({ limit: 50 });
  const { data: violations } = trpc.security.getViolations.useQuery({ limit: 20 });
  const { data: integrity } = trpc.security.verifyIntegrity.useQuery();

  const unlockMutation = trpc.security.unlock.useMutation({
    onSuccess: () => {
      refetchStatus();
      refetchMetrics();
    },
  });

  const setEncryptionMutation = trpc.security.setEncryption.useMutation({
    onSuccess: () => refetchStatus(),
  });

  const setFilterMutation = trpc.security.setFilter.useMutation({
    onSuccess: () => refetchStatus(),
  });

  const resetMetricsMutation = trpc.security.resetMetrics.useMutation({
    onSuccess: () => refetchMetrics(),
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'warning': return 'bg-yellow-500 text-white';
      default: return 'bg-blue-500 text-white';
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'access': return <Key className="w-4 h-4" />;
      case 'encryption': return <FileKey className="w-4 h-4" />;
      case 'filter': return <Eye className="w-4 h-4" />;
      case 'violation': return <AlertTriangle className="w-4 h-4" />;
      case 'lockdown': return <Lock className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={status?.isLocked ? 'border-red-500' : 'border-green-500'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {status?.isLocked ? <Lock className="w-4 h-4 text-red-500" /> : <Unlock className="w-4 h-4 text-green-500" />}
              État du Système
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.isLocked ? 'VERROUILLÉ' : 'ACTIF'}
            </div>
            {status?.isLocked && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">{status.lockReason}</p>
                <Button 
                  size="sm" 
                  className="mt-2"
                  onClick={() => unlockMutation.mutate()}
                  disabled={unlockMutation.isPending}
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  Déverrouiller
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Score d'Intégrité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.integrityScore || 100}%</div>
            <p className="text-xs text-muted-foreground">
              Basé sur les violations détectées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Violations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.violationCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Seuil de verrouillage: 5
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Opérations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalEvents || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.blockedAttempts || 0} bloquées
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Security Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Contrôles de Sécurité
          </CardTitle>
          <CardDescription>Configuration des protections du système</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <FileKey className="w-5 h-5 text-blue-500" />
              <div>
                <p className="font-medium">Chiffrement des Données</p>
                <p className="text-sm text-muted-foreground">
                  Chiffre les données sensibles avant stockage (AES-256-GCM)
                </p>
              </div>
            </div>
            <Switch
              checked={status?.encryptionEnabled || false}
              onCheckedChange={(checked) => setEncryptionMutation.mutate({ enabled: checked })}
              disabled={setEncryptionMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-purple-500" />
              <div>
                <p className="font-medium">Filtrage de Sortie</p>
                <p className="text-sm text-muted-foreground">
                  Filtre les données sensibles (API keys, credentials, tokens)
                </p>
              </div>
            </div>
            <Switch
              checked={status?.filterEnabled || false}
              onCheckedChange={(checked) => setFilterMutation.mutate({ enabled: checked })}
              disabled={setFilterMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium">Audit Immuable</p>
                <p className="text-sm text-muted-foreground">
                  Journal d'audit avec chaîne de hachage SHA-256
                </p>
              </div>
            </div>
            <Badge className={integrity?.valid ? 'bg-green-500' : 'bg-red-500'}>
              {integrity?.valid ? 'Intègre' : 'Compromis'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Métriques de Sécurité
              </CardTitle>
              <CardDescription>Statistiques des opérations de sécurité</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetMetricsMutation.mutate()}
              disabled={resetMetricsMutation.isPending}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Réinitialiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{metrics?.encryptionOperations || 0}</p>
              <p className="text-sm text-muted-foreground">Chiffrements</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{metrics?.filterOperations || 0}</p>
              <p className="text-sm text-muted-foreground">Filtrages</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{metrics?.violationsDetected || 0}</p>
              <p className="text-sm text-muted-foreground">Violations</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{metrics?.lockdownsTriggered || 0}</p>
              <p className="text-sm text-muted-foreground">Verrouillages</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Violations */}
      {violations && violations.length > 0 && (
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <AlertOctagon className="w-5 h-5" />
              Violations Récentes
            </CardTitle>
            <CardDescription>Tentatives d'accès non autorisées</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {violations.map((violation: any) => (
                  <div key={violation.id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <div>
                        <p className="text-sm font-medium">{violation.action}</p>
                        <p className="text-xs text-muted-foreground">{violation.details}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(violation.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Journal d'Audit Sécurité
              </CardTitle>
              <CardDescription>Historique des événements de sécurité</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchAudit()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {auditLog && auditLog.length > 0 ? (
              <div className="space-y-2">
                {auditLog.map((event: any) => (
                  <div key={event.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      {getEventTypeIcon(event.type)}
                      <Badge className={getSeverityColor(event.severity)}>{event.severity}</Badge>
                      <div>
                        <p className="text-sm font-medium">{event.action}</p>
                        <p className="text-xs text-muted-foreground">{event.details}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.blocked && (
                        <Badge variant="destructive">Bloqué</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucun événement de sécurité</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}


// ==================== EVOLUTION PANEL ====================
function EvolutionPanel() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newExtension, setNewExtension] = useState({
    name: '',
    description: '',
    category: 'tool' as 'ai_model' | 'data_source' | 'api_integration' | 'tool' | 'visualization' | 'automation',
    version: '1.0.0',
    author: '',
    dependencies: [] as string[],
    capabilities: [] as string[],
    config: {} as Record<string, any>
  });
  const [showNewExtensionForm, setShowNewExtensionForm] = useState(false);

  // Queries
  const { data: version, refetch: refetchVersion } = trpc.evolution.getVersion.useQuery();
  const { data: metrics, refetch: refetchMetrics } = trpc.evolution.getMetrics.useQuery();
  const { data: modules, refetch: refetchModules } = trpc.evolution.listModules.useQuery();
  const { data: extensions, refetch: refetchExtensions } = trpc.evolution.listExtensions.useQuery(
    selectedCategory === 'all' ? undefined : { category: selectedCategory as any }
  );
  const { data: eventLog, refetch: refetchEvents } = trpc.evolution.getEventLog.useQuery({ limit: 50 });

  // Mutations
  const enableModule = trpc.evolution.enableModule.useMutation({
    onSuccess: () => {
      toast.success("Module activé");
      refetchModules();
      refetchEvents();
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`)
  });

  const disableModule = trpc.evolution.disableModule.useMutation({
    onSuccess: () => {
      toast.success("Module désactivé");
      refetchModules();
      refetchEvents();
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`)
  });

  const registerExtension = trpc.evolution.registerExtension.useMutation({
    onSuccess: () => {
      toast.success("Extension enregistrée");
      refetchExtensions();
      refetchEvents();
      setShowNewExtensionForm(false);
      setNewExtension({
        name: '',
        description: '',
        category: 'tool',
        version: '1.0.0',
        author: '',
        dependencies: [],
        capabilities: [],
        config: {}
      });
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`)
  });

  const approveExtension = trpc.evolution.approveExtension.useMutation({
    onSuccess: () => {
      toast.success("Extension approuvée");
      refetchExtensions();
      refetchEvents();
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`)
  });

  const activateExtension = trpc.evolution.activateExtension.useMutation({
    onSuccess: () => {
      toast.success("Extension activée");
      refetchExtensions();
      refetchEvents();
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`)
  });

  const deactivateExtension = trpc.evolution.deactivateExtension.useMutation({
    onSuccess: () => {
      toast.success("Extension désactivée");
      refetchExtensions();
      refetchEvents();
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`)
  });

  const removeExtension = trpc.evolution.removeExtension.useMutation({
    onSuccess: () => {
      toast.success("Extension supprimée");
      refetchExtensions();
      refetchEvents();
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`)
  });

  const optimizeResources = trpc.evolution.optimizeResources.useMutation({
    onSuccess: () => {
      toast.success("Ressources optimisées");
      refetchMetrics();
      refetchEvents();
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`)
  });

  const refetchAll = () => {
    refetchVersion();
    refetchMetrics();
    refetchModules();
    refetchExtensions();
    refetchEvents();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'approved': return 'bg-blue-500';
      case 'pending': return 'bg-yellow-500';
      case 'disabled': return 'bg-gray-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ai_model': return <Cpu className="w-4 h-4" />;
      case 'data_source': return <Database className="w-4 h-4" />;
      case 'api_integration': return <Globe className="w-4 h-4" />;
      case 'tool': return <Settings className="w-4 h-4" />;
      case 'visualization': return <BarChart3 className="w-4 h-4" />;
      case 'automation': return <Zap className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'module_enabled':
      case 'module_disabled':
        return <Settings className="w-4 h-4 text-blue-500" />;
      case 'extension_registered':
      case 'extension_approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'extension_activated':
        return <Play className="w-4 h-4 text-green-500" />;
      case 'extension_deactivated':
        return <Square className="w-4 h-4 text-yellow-500" />;
      case 'extension_removed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'security_scan':
        return <Shield className="w-4 h-4 text-purple-500" />;
      case 'resources_optimized':
        return <TrendingUp className="w-4 h-4 text-cyan-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Version Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Module 10: Évolution & Extension
              </CardTitle>
              <CardDescription>
                Gestion de la scalabilité, des extensions et du contrôle de version
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-lg px-4 py-2">
                Version: v{version?.major || 1}.{version?.minor || 0}.{version?.patch || 0}
              </Badge>
              <Button variant="outline" onClick={refetchAll}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualiser
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Scalability Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Modules Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.activeModules || 0}
              <span className="text-muted-foreground text-sm font-normal">
                /{metrics?.totalModules || 10}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Extensions Actives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {metrics?.activeExtensions || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Attente d'Approbation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {metrics?.pendingExtensions || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Utilisation Ressources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((metrics?.resourceUsage || 0) * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modules Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Gestion des 10 Modules Phoenix
          </CardTitle>
          <CardDescription>
            Activez ou désactivez les modules de l'architecture Phoenix via le système d'évolution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modules?.map((module) => (
              <div
                key={module.id}
                className={`p-4 rounded-lg border ${module.enabled ? 'border-primary bg-primary/5' : 'border-muted bg-muted/20'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${module.enabled ? 'bg-primary/20' : 'bg-muted'}`}>
                      <Settings className={`w-5 h-5 ${module.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <h4 className="font-medium">{module.name}</h4>
                      <p className="text-xs text-muted-foreground">{module.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={module.enabled ? "default" : "secondary"}>
                      {module.enabled ? "Actif" : "Inactif"}
                    </Badge>
                    <Switch
                      checked={module.enabled}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          enableModule.mutate({ moduleId: module.id });
                        } else {
                          disableModule.mutate({ moduleId: module.id });
                        }
                      }}
                      disabled={module.id === 'evolution'} // Can't disable self
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Extensions Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Gestion des Extensions
              </CardTitle>
              <CardDescription>
                Enregistrez, approuvez et gérez les extensions du système
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 rounded-md border bg-background"
              >
                <option value="all">Toutes les catégories</option>
                <option value="ai_model">Modèles IA</option>
                <option value="data_source">Sources de données</option>
                <option value="api_integration">Intégrations API</option>
                <option value="tool">Outils</option>
                <option value="visualization">Visualisation</option>
                <option value="automation">Automatisation</option>
              </select>
              <Button onClick={() => setShowNewExtensionForm(!showNewExtensionForm)}>
                {showNewExtensionForm ? 'Annuler' : 'Nouvelle Extension'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* New Extension Form */}
          {showNewExtensionForm && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-lg">Enregistrer une Nouvelle Extension</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Nom</label>
                    <input
                      type="text"
                      value={newExtension.name}
                      onChange={(e) => setNewExtension({ ...newExtension, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border bg-background mt-1"
                      placeholder="Nom de l'extension"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Catégorie</label>
                    <select
                      value={newExtension.category}
                      onChange={(e) => setNewExtension({ ...newExtension, category: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-md border bg-background mt-1"
                    >
                      <option value="ai_model">Modèle IA</option>
                      <option value="data_source">Source de données</option>
                      <option value="api_integration">Intégration API</option>
                      <option value="tool">Outil</option>
                      <option value="visualization">Visualisation</option>
                      <option value="automation">Automatisation</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={newExtension.description}
                    onChange={(e) => setNewExtension({ ...newExtension, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background mt-1"
                    rows={2}
                    placeholder="Description de l'extension"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Version</label>
                    <input
                      type="text"
                      value={newExtension.version}
                      onChange={(e) => setNewExtension({ ...newExtension, version: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border bg-background mt-1"
                      placeholder="1.0.0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Auteur</label>
                    <input
                      type="text"
                      value={newExtension.author}
                      onChange={(e) => setNewExtension({ ...newExtension, author: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border bg-background mt-1"
                      placeholder="Nom de l'auteur"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => registerExtension.mutate(newExtension)}
                  disabled={!newExtension.name || !newExtension.description || registerExtension.isPending}
                >
                  Enregistrer l'Extension
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Extensions List */}
          <ScrollArea className="h-[400px]">
            {extensions && extensions.length > 0 ? (
              <div className="space-y-3">
                {extensions.map((ext) => (
                  <div
                    key={ext.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          {getCategoryIcon(ext.category)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{ext.name}</h4>
                            <Badge variant="outline">{ext.version}</Badge>
                            <Badge className={getStatusColor(ext.status)}>{ext.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{ext.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Par {ext.author} • {ext.category}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {ext.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-500"
                            onClick={() => approveExtension.mutate({ extensionId: ext.id })}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approuver
                          </Button>
                        )}
                        {ext.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-500"
                            onClick={() => activateExtension.mutate({ extensionId: ext.id })}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Activer
                          </Button>
                        )}
                        {ext.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-yellow-500"
                            onClick={() => deactivateExtension.mutate({ extensionId: ext.id })}
                          >
                            <Square className="w-4 h-4 mr-1" />
                            Désactiver
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => {
                            if (confirm(`Êtes-vous sûr de vouloir supprimer l'extension "${ext.name}" ?`)) {
                              removeExtension.mutate({ extensionId: ext.id });
                            }
                          }}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucune extension enregistrée</p>
                <p className="text-sm">Cliquez sur "Nouvelle Extension" pour en ajouter une</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Resource Optimization */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="w-5 h-5" />
                Optimisation des Ressources
              </CardTitle>
              <CardDescription>
                Gérez l'allocation des ressources et optimisez les performances
              </CardDescription>
            </div>
            <Button
              onClick={() => optimizeResources.mutate()}
              disabled={optimizeResources.isPending}
            >
              {optimizeResources.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <TrendingUp className="w-4 h-4 mr-2" />
              )}
              Optimiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Mémoire Utilisée</p>
              <p className="text-2xl font-bold">{((metrics?.memoryUsage || 0) * 100).toFixed(1)}%</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">CPU Utilisé</p>
              <p className="text-2xl font-bold">{((metrics?.cpuUsage || 0) * 100).toFixed(1)}%</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Dernière Optimisation</p>
              <p className="text-lg font-medium">
                {metrics?.lastOptimization
                  ? new Date(metrics.lastOptimization).toLocaleString()
                  : 'Jamais'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Journal des Événements
              </CardTitle>
              <CardDescription>Historique des événements du module Évolution</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchEvents()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {eventLog && eventLog.length > 0 ? (
              <div className="space-y-2">
                {eventLog.map((event: any) => (
                  <div key={event.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      {getEventTypeIcon(event.type)}
                      <div>
                        <p className="text-sm font-medium">{event.type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">{event.details}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucun événement enregistré</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
