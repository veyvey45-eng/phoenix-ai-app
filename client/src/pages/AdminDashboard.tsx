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
  RefreshCw
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="modules">Modules (10)</TabsTrigger>
            <TabsTrigger value="validations">Axiomes (16)</TabsTrigger>
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
