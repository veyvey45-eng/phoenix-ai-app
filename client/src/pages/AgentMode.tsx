/**
 * Agent Mode - Interface pour le système d'agent autonome
 * Permet à l'utilisateur de donner des tâches complexes que l'agent exécute automatiquement
 */

import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Square, 
  Trash2, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  Brain,
  Zap,
  Shield,
  AlertTriangle,
  Sparkles,
  Bot,
  Send
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AgentStep {
  id: string;
  type: 'think' | 'plan' | 'action' | 'observe' | 'confirm';
  description: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  toolName?: string;
  toolArgs?: Record<string, any>;
  output?: any;
  securityAnalysis?: { riskLevel: string; warnings: string[] };
  startedAt?: string;
  completedAt?: string;
}

interface AgentTask {
  id: string;
  goal: string;
  status: 'pending' | 'planning' | 'executing' | 'waiting_confirmation' | 'completed' | 'failed';
  steps: AgentStep[];
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AgentMode() {
  const [goal, setGoal] = useState('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    taskId: string;
    stepId: string;
    step: AgentStep | null;
  }>({ open: false, taskId: '', stepId: '', step: null });
  
  const stepsEndRef = useRef<HTMLDivElement>(null);
  
  // Queries
  const { data: tasksData, refetch: refetchTasks } = trpc.agent.listTasks.useQuery();
  const { data: activeTaskData, refetch: refetchActiveTask } = trpc.agent.getTask.useQuery(
    { taskId: activeTaskId || '' },
    { enabled: !!activeTaskId, refetchInterval: activeTaskId ? 2000 : false }
  );
  
  // Mutations
  const createTaskMutation = trpc.agent.createTask.useMutation({
    onSuccess: (data) => {
      if (data.success && data.task) {
        setActiveTaskId(data.task.id);
        refetchTasks();
      }
    }
  });
  
  const runTaskMutation = trpc.agent.runTask.useMutation({
    onSuccess: () => {
      refetchActiveTask();
      refetchTasks();
    }
  });
  
  const quickTaskMutation = trpc.agent.quickTask.useMutation({
    onSuccess: () => {
      refetchTasks();
    }
  });
  
  const confirmActionMutation = trpc.agent.confirmAction.useMutation({
    onSuccess: () => {
      setConfirmDialog({ open: false, taskId: '', stepId: '', step: null });
      refetchActiveTask();
    }
  });
  
  const cancelTaskMutation = trpc.agent.cancelTask.useMutation({
    onSuccess: () => {
      refetchActiveTask();
      refetchTasks();
    }
  });
  
  const deleteTaskMutation = trpc.agent.deleteTask.useMutation({
    onSuccess: () => {
      if (activeTaskId) {
        setActiveTaskId(null);
      }
      refetchTasks();
    }
  });
  
  // Auto-scroll to bottom when new steps are added
  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTaskData?.task?.steps?.length]);
  
  // Check for confirmation needed
  useEffect(() => {
    if (activeTaskData?.task) {
      const task = activeTaskData.task as unknown as AgentTask;
      if (task.status === 'waiting_confirmation') {
        const pendingStep = task.steps.find(s => s.type === 'confirm' && s.status === 'pending');
        if (pendingStep) {
          setConfirmDialog({
            open: true,
            taskId: task.id,
            stepId: pendingStep.id,
            step: pendingStep
          });
        }
      }
    }
  }, [activeTaskData?.task?.status]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    
    // Créer et exécuter la tâche
    const result = await createTaskMutation.mutateAsync({ goal: goal.trim() });
    if (result.success && result.task) {
      setGoal('');
      // Lancer automatiquement l'exécution
      runTaskMutation.mutate({ 
        taskId: result.task.id,
        config: {
          maxIterations: 10,
          requireConfirmationForHighRisk: true,
          autoExecuteLowRisk: true
        }
      });
    }
  };
  
  const handleQuickTask = async () => {
    if (!goal.trim()) return;
    const taskGoal = goal.trim();
    setGoal('');
    await quickTaskMutation.mutateAsync({ goal: taskGoal });
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'executing': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'skipped': return <ChevronRight className="w-4 h-4 text-gray-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };
  
  const getStepTypeIcon = (type: string) => {
    switch (type) {
      case 'think': return <Brain className="w-4 h-4 text-purple-500" />;
      case 'plan': return <Sparkles className="w-4 h-4 text-yellow-500" />;
      case 'action': return <Zap className="w-4 h-4 text-blue-500" />;
      case 'observe': return <Bot className="w-4 h-4 text-green-500" />;
      case 'confirm': return <Shield className="w-4 h-4 text-orange-500" />;
      default: return <ChevronRight className="w-4 h-4" />;
    }
  };
  
  const getRiskBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">Faible</Badge>;
      case 'medium': return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Moyen</Badge>;
      case 'high': return <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">Élevé</Badge>;
      case 'critical': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">Critique</Badge>;
      default: return null;
    }
  };
  
  const activeTask = activeTaskData?.task as AgentTask | undefined;
  const tasks = tasksData?.tasks || [];
  
  const isRunning = activeTask?.status === 'executing' || activeTask?.status === 'planning';
  
  return (
    <div className="flex h-full">
      {/* Sidebar - Liste des tâches */}
      <div className="w-80 border-r border-border bg-card/50 flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Agent Autonome
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Donnez une tâche, l'agent l'exécute
          </p>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucune tâche</p>
                <p className="text-xs">Créez votre première tâche ci-dessous</p>
              </div>
            ) : (
              tasks.map((task: any) => (
                <Card 
                  key={task.id}
                  className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                    activeTaskId === task.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setActiveTaskId(task.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.goal}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusIcon(task.status)}
                          <span className="text-xs text-muted-foreground">
                            {task.stepsCount} étapes
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTaskMutation.mutate({ taskId: task.id });
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Task details */}
        <div className="flex-1 overflow-hidden">
          {activeTask ? (
            <div className="h-full flex flex-col">
              {/* Task header */}
              <div className="p-4 border-b border-border bg-card/30">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{activeTask.goal}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={
                        activeTask.status === 'completed' ? 'default' :
                        activeTask.status === 'failed' ? 'destructive' :
                        activeTask.status === 'executing' ? 'secondary' : 'outline'
                      }>
                        {activeTask.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {activeTask.steps.length} étapes
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isRunning && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => cancelTaskMutation.mutate({ taskId: activeTask.id })}
                      >
                        <Square className="w-4 h-4 mr-1" />
                        Arrêter
                      </Button>
                    )}
                    {activeTask.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => runTaskMutation.mutate({ taskId: activeTask.id })}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Démarrer
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Steps timeline */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {activeTask.steps.map((step, index) => (
                    <div key={step.id} className="flex gap-3">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          step.status === 'completed' ? 'bg-green-500/20' :
                          step.status === 'failed' ? 'bg-red-500/20' :
                          step.status === 'executing' ? 'bg-blue-500/20' :
                          'bg-muted'
                        }`}>
                          {getStepTypeIcon(step.type)}
                        </div>
                        {index < activeTask.steps.length - 1 && (
                          <div className="w-0.5 flex-1 bg-border mt-2" />
                        )}
                      </div>
                      
                      {/* Step content */}
                      <Card className="flex-1">
                        <CardHeader className="p-3 pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-sm font-medium">
                                {step.type === 'think' ? 'Réflexion' :
                                 step.type === 'plan' ? 'Planification' :
                                 step.type === 'action' ? 'Action' :
                                 step.type === 'observe' ? 'Observation' :
                                 'Confirmation'}
                              </CardTitle>
                              {step.toolName && (
                                <Badge variant="outline" className="text-xs">
                                  {step.toolName}
                                </Badge>
                              )}
                              {step.securityAnalysis && getRiskBadge(step.securityAnalysis.riskLevel)}
                            </div>
                            {getStatusIcon(step.status)}
                          </div>
                          <CardDescription className="text-xs mt-1">
                            {step.description}
                          </CardDescription>
                        </CardHeader>
                        
                        {(step.output || step.toolArgs) && (
                          <CardContent className="p-3 pt-0">
                            {step.toolArgs && (
                              <div className="text-xs bg-muted/50 rounded p-2 mb-2">
                                <span className="text-muted-foreground">Arguments: </span>
                                <code className="text-foreground">
                                  {JSON.stringify(step.toolArgs, null, 2)}
                                </code>
                              </div>
                            )}
                            {step.output && (
                              <div className="text-xs bg-muted/50 rounded p-2">
                                <span className="text-muted-foreground">Résultat: </span>
                                <code className="text-foreground whitespace-pre-wrap">
                                  {typeof step.output === 'string' 
                                    ? step.output 
                                    : JSON.stringify(step.output, null, 2)}
                                </code>
                              </div>
                            )}
                            {step.securityAnalysis?.warnings && step.securityAnalysis.warnings.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {step.securityAnalysis.warnings.map((warning, i) => (
                                  <div key={i} className="flex items-center gap-1 text-xs text-orange-500">
                                    <AlertTriangle className="w-3 h-3" />
                                    {warning}
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    </div>
                  ))}
                  
                  {/* Result */}
                  {activeTask.result && (
                    <Card className="border-green-500/30 bg-green-500/5">
                      <CardHeader className="p-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Résultat final
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <p className="text-sm whitespace-pre-wrap">{activeTask.result}</p>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Error */}
                  {activeTask.error && (
                    <Card className="border-red-500/30 bg-red-500/5">
                      <CardHeader className="p-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-500" />
                          Erreur
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <p className="text-sm text-red-500">{activeTask.error}</p>
                      </CardContent>
                    </Card>
                  )}
                  
                  <div ref={stepsEndRef} />
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Bot className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-2">Mode Agent Autonome</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Décrivez une tâche complexe et l'agent la décomposera en étapes,
                  exécutera les actions nécessaires et vous montrera sa progression en temps réel.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Input area */}
        <div className="p-4 border-t border-border bg-card/30">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Décrivez la tâche que l'agent doit accomplir..."
              className="flex-1"
              disabled={createTaskMutation.isPending || runTaskMutation.isPending}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="submit"
                    disabled={!goal.trim() || createTaskMutation.isPending || runTaskMutation.isPending}
                  >
                    {(createTaskMutation.isPending || runTaskMutation.isPending) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Créer et exécuter la tâche</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            L'agent utilisera les outils MCP disponibles pour accomplir la tâche.
            Les actions à haut risque nécessiteront votre confirmation.
          </p>
        </div>
      </div>
      
      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ ...confirmDialog, open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-500" />
              Confirmation requise
            </DialogTitle>
            <DialogDescription>
              L'agent souhaite exécuter une action qui nécessite votre approbation.
            </DialogDescription>
          </DialogHeader>
          
          {confirmDialog.step && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-1">Action</h4>
                <p className="text-sm text-muted-foreground">{confirmDialog.step.description}</p>
              </div>
              
              {confirmDialog.step.toolName && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Outil</h4>
                  <Badge variant="outline">{confirmDialog.step.toolName}</Badge>
                </div>
              )}
              
              {confirmDialog.step.toolArgs && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Arguments</h4>
                  <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-32">
                    {JSON.stringify(confirmDialog.step.toolArgs, null, 2)}
                  </pre>
                </div>
              )}
              
              {confirmDialog.step.securityAnalysis && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Analyse de sécurité</h4>
                  <div className="flex items-center gap-2">
                    {getRiskBadge(confirmDialog.step.securityAnalysis.riskLevel)}
                  </div>
                  {confirmDialog.step.securityAnalysis.warnings?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {confirmDialog.step.securityAnalysis.warnings.map((warning, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs text-orange-500">
                          <AlertTriangle className="w-3 h-3" />
                          {warning}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => confirmActionMutation.mutate({
                taskId: confirmDialog.taskId,
                stepId: confirmDialog.stepId,
                confirmed: false
              })}
              disabled={confirmActionMutation.isPending}
            >
              Refuser
            </Button>
            <Button
              onClick={() => confirmActionMutation.mutate({
                taskId: confirmDialog.taskId,
                stepId: confirmDialog.stepId,
                confirmed: true
              })}
              disabled={confirmActionMutation.isPending}
            >
              {confirmActionMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1" />
              )}
              Approuver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
