import { useState } from "react";
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
  AlertOctagon
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="modules">Modules (10)</TabsTrigger>
            <TabsTrigger value="validations">Axiomes (16)</TabsTrigger>
            <TabsTrigger value="arbitrage">Arbitrage</TabsTrigger>
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
