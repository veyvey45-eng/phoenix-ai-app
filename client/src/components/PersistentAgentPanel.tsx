/**
 * PersistentAgentPanel - Interface pour l'agent persistant
 * 
 * Ce composant affiche:
 * - L'état actuel de l'agent
 * - Les étapes en cours et terminées
 * - Les contrôles (pause, resume, cancel)
 * - Le streaming en temps réel via WebSocket
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Zap,
  Brain,
  Wrench,
  Eye,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';

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

interface Task {
  id: string;
  goal: string;
  status: string;
  currentPhase: string | null;
  currentIteration: number | null;
  totalToolCalls: number | null;
  result: string | null;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

interface PersistentAgentPanelProps {
  taskId?: string;
  onTaskCreated?: (taskId: string) => void;
}

export function PersistentAgentPanel({ taskId: initialTaskId, onTaskCreated }: PersistentAgentPanelProps) {
  const [taskId, setTaskId] = useState<string | null>(initialTaskId || null);
  const [goal, setGoal] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState<Array<{ type: string; data: any; timestamp: string }>>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Queries
  const taskQuery = trpc.persistentAgent.getTask.useQuery(
    { taskId: taskId! },
    { enabled: !!taskId, refetchInterval: taskId ? 2000 : false }
  );

  const stepsQuery = trpc.persistentAgent.getTaskSteps.useQuery(
    { taskId: taskId!, limit: 50 },
    { enabled: !!taskId, refetchInterval: taskId ? 3000 : false }
  );

  const workerStatus = trpc.persistentAgent.getWorkerStatus.useQuery(undefined, {
    refetchInterval: 5000
  });

  // Mutations
  const createTask = trpc.persistentAgent.createTask.useMutation({
    onSuccess: (data) => {
      setTaskId(data.taskId);
      onTaskCreated?.(data.taskId);
      toast.success('Tâche créée et mise en file d\'attente');
      setGoal('');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    }
  });

  const pauseTask = trpc.persistentAgent.pauseTask.useMutation({
    onSuccess: () => {
      toast.success('Tâche mise en pause');
      taskQuery.refetch();
    }
  });

  const resumeTask = trpc.persistentAgent.resumeTask.useMutation({
    onSuccess: () => {
      toast.success('Tâche reprise');
      taskQuery.refetch();
    }
  });

  const cancelTask = trpc.persistentAgent.cancelTask.useMutation({
    onSuccess: () => {
      toast.success('Tâche annulée');
      taskQuery.refetch();
    }
  });

  // WebSocket connection
  useEffect(() => {
    if (!taskId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/agent?userId=current`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      // Subscribe to task events
      ws.send(JSON.stringify({ type: 'subscribe', taskId }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'event' && message.taskId === taskId) {
          setLiveEvents(prev => [...prev.slice(-50), {
            type: message.data.eventType,
            data: message.data,
            timestamp: message.data.timestamp || new Date().toISOString()
          }]);
          
          // Refresh queries on important events
          if (['task_completed', 'task_failed', 'step_completed'].includes(message.data.eventType)) {
            taskQuery.refetch();
            stepsQuery.refetch();
          }
        }
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', taskId }));
        ws.close();
      }
    };
  }, [taskId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [liveEvents, stepsQuery.data]);

  const handleCreateTask = async () => {
    if (!goal.trim()) {
      toast.error('Veuillez entrer un objectif');
      return;
    }
    setIsCreating(true);
    try {
      await createTask.mutateAsync({ goal: goal.trim() });
    } finally {
      setIsCreating(false);
    }
  };

  const task = taskQuery.data as Task | undefined;
  const steps = (stepsQuery.data || []) as Step[];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      pending: { variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
      running: { variant: 'default', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
      paused: { variant: 'outline', icon: <Pause className="w-3 h-3" /> },
      completed: { variant: 'default', icon: <CheckCircle2 className="w-3 h-3" /> },
      failed: { variant: 'destructive', icon: <XCircle className="w-3 h-3" /> },
      cancelled: { variant: 'secondary', icon: <Square className="w-3 h-3" /> }
    };
    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
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
      case 'answer': return <MessageSquare className="w-4 h-4 text-orange-500" />;
      default: return <Zap className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Worker Status */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Agent Persistant</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={workerStatus.data?.running ? 'default' : 'secondary'}>
                Worker: {workerStatus.data?.running ? 'Actif' : 'Arrêté'}
              </Badge>
              <Badge variant={wsConnected ? 'default' : 'outline'}>
                WS: {wsConnected ? 'Connecté' : 'Déconnecté'}
              </Badge>
            </div>
          </div>
          <CardDescription>
            Exécution de tâches complexes avec 100+ actions
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Task Creation */}
      {!taskId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nouvelle Tâche</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Décrivez votre objectif en détail..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <Button 
              onClick={handleCreateTask} 
              disabled={isCreating || !goal.trim()}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Démarrer la Tâche
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Task Status */}
      {task && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  Tâche en cours
                  {getStatusBadge(task.status)}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {task.goal}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {task.status === 'running' && (
                  <Button variant="outline" size="sm" onClick={() => pauseTask.mutate({ taskId: task.id })}>
                    <Pause className="w-4 h-4" />
                  </Button>
                )}
                {task.status === 'paused' && (
                  <Button variant="outline" size="sm" onClick={() => resumeTask.mutate({ taskId: task.id })}>
                    <Play className="w-4 h-4" />
                  </Button>
                )}
                {['running', 'paused', 'pending'].includes(task.status) && (
                  <Button variant="destructive" size="sm" onClick={() => cancelTask.mutate({ taskId: task.id })}>
                    <Square className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => {
                  setTaskId(null);
                  setLiveEvents([]);
                }}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Itération: {task.currentIteration || 0}</span>
                <span>Outils: {task.totalToolCalls || 0}</span>
                <span>Phase: {task.currentPhase || 'N/A'}</span>
              </div>
              <Progress value={Math.min((task.currentIteration || 0), 100)} />
            </div>

            {/* Result or Error */}
            {task.result && (
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">Résultat:</p>
                <p className="text-sm text-green-700 dark:text-green-300 whitespace-pre-wrap">{task.result}</p>
              </div>
            )}
            {task.error && (
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">Erreur:</p>
                <p className="text-sm text-red-700 dark:text-red-300">{task.error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Steps */}
      {taskId && steps.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Étapes ({steps.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]" ref={scrollRef}>
              <div className="space-y-2">
                {steps.map((step) => (
                  <div 
                    key={step.id} 
                    className="flex items-start gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="mt-1">
                      {getStepIcon(step.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          #{step.stepNumber} - {step.type}
                        </span>
                        {step.toolName && (
                          <Badge variant="outline" className="text-xs">
                            {step.toolName}
                          </Badge>
                        )}
                      </div>
                      {step.content && (
                        <p className="text-sm mt-1 line-clamp-2">{step.content}</p>
                      )}
                      {step.toolResult && (
                        <div className="mt-1">
                          <Badge variant={step.toolResult.success ? 'default' : 'destructive'} className="text-xs">
                            {step.toolResult.success ? 'Succès' : 'Échec'}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Live Events */}
      {taskId && liveEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              Événements en direct
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px]">
              <div className="space-y-1 font-mono text-xs">
                {liveEvents.slice(-20).map((event, i) => (
                  <div key={i} className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-[10px]">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {event.type}
                    </Badge>
                    {event.data.message && (
                      <span className="truncate">{event.data.message}</span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PersistentAgentPanel;
