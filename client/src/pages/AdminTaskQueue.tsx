/**
 * AdminTaskQueue - Dashboard admin pour visualiser la file d'attente des tâches
 * 
 * Ce composant affiche:
 * - Statistiques globales du système
 * - Tâches en cours d'exécution
 * - Tâches en attente dans la file
 * - Historique des tâches terminées
 * - Contrôles pour annuler/reprendre des tâches
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Pause, 
  Play, 
  Square,
  RefreshCw,
  Loader2,
  Zap,
  Server,
  Users,
  ListTodo,
  AlertCircle,
  Brain,
  Wrench,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TaskStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

interface Task {
  id: string;
  userId: number;
  goal: string;
  status: string;
  priority?: number;
  currentPhase: string | null;
  currentIteration: number | null;
  totalToolCalls: number | null;
  result: string | null;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

interface Step {
  id: string;
  type: string;
  content: string | null;
  toolName: string | null;
  toolResult: any;
  status: string;
  stepNumber: number;
  startedAt: Date | null;
  completedAt: Date | null;
}

export default function AdminTaskQueue() {
  const { user } = useAuth();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Queries
  const statsQuery = trpc.persistentAgent.getStats.useQuery(undefined, {
    refetchInterval: 5000
  });

  const workerStatusQuery = trpc.persistentAgent.getWorkerStatus.useQuery(undefined, {
    refetchInterval: 3000
  });

  const allTasksQuery = trpc.persistentAgent.getAllTasks.useQuery(
    { limit: 100 },
    { refetchInterval: 5000 }
  );

  const taskStepsQuery = trpc.persistentAgent.getTaskSteps.useQuery(
    { taskId: selectedTaskId!, limit: 50 },
    { enabled: !!selectedTaskId, refetchInterval: 3000 }
  );

  // Mutations
  const pauseTask = trpc.persistentAgent.pauseTask.useMutation({
    onSuccess: () => {
      toast.success('Tâche mise en pause');
      allTasksQuery.refetch();
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`)
  });

  const resumeTask = trpc.persistentAgent.resumeTask.useMutation({
    onSuccess: () => {
      toast.success('Tâche reprise');
      allTasksQuery.refetch();
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`)
  });

  const cancelTask = trpc.persistentAgent.cancelTask.useMutation({
    onSuccess: () => {
      toast.success('Tâche annulée');
      allTasksQuery.refetch();
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`)
  });

  // Filtrer les tâches par statut
  const tasks = allTasksQuery.data || [];
  const pendingTasks = tasks.filter((t: Task) => t.status === 'pending');
  const runningTasks = tasks.filter((t: Task) => t.status === 'running');
  const completedTasks = tasks.filter((t: Task) => t.status === 'completed');
  const failedTasks = tasks.filter((t: Task) => t.status === 'failed' || t.status === 'cancelled');

  const stats: TaskStats = {
    total: tasks.length,
    pending: pendingTasks.length,
    running: runningTasks.length,
    completed: completedTasks.length,
    failed: failedTasks.filter((t: Task) => t.status === 'failed').length,
    cancelled: failedTasks.filter((t: Task) => t.status === 'cancelled').length
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; color: string }> = {
      pending: { variant: 'secondary', icon: <Clock className="w-3 h-3" />, color: 'text-yellow-500' },
      running: { variant: 'default', icon: <Loader2 className="w-3 h-3 animate-spin" />, color: 'text-blue-500' },
      paused: { variant: 'outline', icon: <Pause className="w-3 h-3" />, color: 'text-orange-500' },
      completed: { variant: 'default', icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-500' },
      failed: { variant: 'destructive', icon: <XCircle className="w-3 h-3" />, color: 'text-red-500' },
      cancelled: { variant: 'secondary', icon: <Square className="w-3 h-3" />, color: 'text-gray-500' }
    };
    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${config.color}`}>
        {config.icon}
        {status}
      </Badge>
    );
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'think': return <Brain className="w-4 h-4 text-purple-500" />;
      case 'tool_call': return <Wrench className="w-4 h-4 text-blue-500" />;
      case 'observe': return <Eye className="w-4 h-4 text-green-500" />;
      case 'answer': return <CheckCircle2 className="w-4 h-4 text-orange-500" />;
      default: return <Zap className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
  };

  // Vérifier si l'utilisateur est admin
  if (user?.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Accès refusé
              </CardTitle>
              <CardDescription>
                Cette page est réservée aux administrateurs.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-background/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">File d'Attente des Tâches</h1>
              <p className="text-sm text-muted-foreground">
                Administration du système d'agent persistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={workerStatusQuery.data?.running ? 'default' : 'destructive'} className="px-3 py-1">
              <Activity className="w-3 h-3 mr-1" />
              Worker: {workerStatusQuery.data?.running ? 'Actif' : 'Arrêté'}
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                allTasksQuery.refetch();
                statsQuery.refetch();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <ListTodo className="w-8 h-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">En attente</p>
                  <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">En cours</p>
                  <p className="text-2xl font-bold text-blue-500">{stats.running}</p>
                </div>
                <Loader2 className="w-8 h-8 text-blue-500/50 animate-spin" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Terminées</p>
                  <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Échouées</p>
                  <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Annulées</p>
                  <p className="text-2xl font-bold text-gray-500">{stats.cancelled}</p>
                </div>
                <Square className="w-8 h-8 text-gray-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-6 pb-6 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full max-w-md grid-cols-4">
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="running">En cours ({stats.running})</TabsTrigger>
              <TabsTrigger value="pending">En attente ({stats.pending})</TabsTrigger>
              <TabsTrigger value="history">Historique</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="flex-1 overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                {/* Worker Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Server className="w-5 h-5" />
                      État du Worker
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">ID Worker</p>
                        <p className="font-mono text-sm truncate">{workerStatusQuery.data?.workerId || '-'}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Tâches actives</p>
                        <p className="text-lg font-bold">{workerStatusQuery.data?.activeTasks || 0}</p>
                      </div>
                    </div>
                    {workerStatusQuery.data?.taskIds && workerStatusQuery.data.taskIds.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Tâches en cours d'exécution:</p>
                        <div className="space-y-1">
                          {workerStatusQuery.data.taskIds.map((id: string) => (
                            <div key={id} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                              <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                              <span className="font-mono truncate">{id}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      Activité Récente
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {tasks.slice(0, 10).map((task: Task) => (
                          <div 
                            key={task.id} 
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                            onClick={() => {
                              setSelectedTaskId(task.id);
                              setActiveTab('running');
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{task.goal}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(task.createdAt)}</p>
                            </div>
                            {getStatusBadge(task.status)}
                          </div>
                        ))}
                        {tasks.length === 0 && (
                          <p className="text-center text-muted-foreground py-8">
                            Aucune tâche pour le moment
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Running Tasks Tab */}
            <TabsContent value="running" className="flex-1 overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                {/* Task List */}
                <Card className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-lg">Tâches en cours</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                      <div className="space-y-2">
                        {runningTasks.map((task: Task) => (
                          <div 
                            key={task.id} 
                            className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                              selectedTaskId === task.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                            }`}
                            onClick={() => setSelectedTaskId(task.id)}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-sm font-medium line-clamp-2">{task.goal}</p>
                              {getStatusBadge(task.status)}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Itération: {task.currentIteration || 0}</span>
                              <span>Outils: {task.totalToolCalls || 0}</span>
                            </div>
                            {task.currentPhase && (
                              <div className="mt-2">
                                <Progress value={(task.currentIteration || 0) % 100} className="h-1" />
                                <p className="text-xs text-muted-foreground mt-1">{task.currentPhase}</p>
                              </div>
                            )}
                            <div className="flex gap-2 mt-3">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  pauseTask.mutate({ taskId: task.id });
                                }}
                              >
                                <Pause className="w-3 h-3 mr-1" />
                                Pause
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelTask.mutate({ taskId: task.id });
                                }}
                              >
                                <Square className="w-3 h-3 mr-1" />
                                Annuler
                              </Button>
                            </div>
                          </div>
                        ))}
                        {runningTasks.length === 0 && (
                          <p className="text-center text-muted-foreground py-8">
                            Aucune tâche en cours
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Task Details */}
                <Card className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-lg">Détails de la tâche</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden">
                    {selectedTaskId ? (
                      <ScrollArea className="h-full">
                        <div className="space-y-3">
                          {taskStepsQuery.data?.map((step: Step) => (
                            <div key={step.id} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                              <div className="shrink-0 mt-0.5">
                                {getStepIcon(step.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium uppercase text-muted-foreground">
                                    {step.type}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    #{step.stepNumber}
                                  </span>
                                </div>
                                {step.toolName && (
                                  <p className="text-sm font-medium text-blue-500">{step.toolName}</p>
                                )}
                                {step.content && (
                                  <p className="text-sm text-muted-foreground line-clamp-3">{step.content}</p>
                                )}
                                {step.toolResult && (
                                  <div className={`text-xs mt-1 ${step.toolResult.success ? 'text-green-500' : 'text-red-500'}`}>
                                    {step.toolResult.success ? '✓ Succès' : '✗ Échec'}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {(!taskStepsQuery.data || taskStepsQuery.data.length === 0) && (
                            <p className="text-center text-muted-foreground py-8">
                              Aucune étape pour le moment
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Sélectionnez une tâche pour voir les détails
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Pending Tasks Tab */}
            <TabsContent value="pending" className="flex-1 overflow-hidden">
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg">Tâches en attente</CardTitle>
                  <CardDescription>
                    Ces tâches seront exécutées dans l'ordre de priorité
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="space-y-2">
                      {pendingTasks.map((task: Task, index: number) => (
                        <div 
                          key={task.id} 
                          className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50"
                        >
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.goal}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                              <span>Priorité: {task.priority}</span>
                              <span>Créée: {formatDate(task.createdAt)}</span>
                            </div>
                          </div>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => cancelTask.mutate({ taskId: task.id })}
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Annuler
                          </Button>
                        </div>
                      ))}
                      {pendingTasks.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          Aucune tâche en attente
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="flex-1 overflow-hidden">
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg">Historique des tâches</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="space-y-2">
                      {[...completedTasks, ...failedTasks].sort((a: Task, b: Task) => 
                        new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime()
                      ).map((task: Task) => (
                        <div 
                          key={task.id} 
                          className="p-4 rounded-lg border border-border hover:bg-muted/50"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm font-medium line-clamp-2">{task.goal}</p>
                            {getStatusBadge(task.status)}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Itérations: {task.currentIteration || 0}</span>
                            <span>Outils: {task.totalToolCalls || 0}</span>
                            <span>Terminée: {formatDate(task.completedAt)}</span>
                          </div>
                          {task.error && (
                            <p className="text-xs text-red-500 mt-2 line-clamp-2">{task.error}</p>
                          )}
                          {task.result && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{task.result}</p>
                          )}
                        </div>
                      ))}
                      {completedTasks.length === 0 && failedTasks.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          Aucune tâche dans l'historique
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
