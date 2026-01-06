/**
 * Agent Mode - Interface pour le système d'agent autonome Phoenix
 * Permet à l'utilisateur de donner des tâches complexes que l'agent exécute automatiquement
 */

import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Sparkles,
  Bot,
  Send,
  Code,
  Search,
  Image as ImageIcon,
  FileText,
  Calculator,
  Globe,
  Eye,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Streamdown } from 'streamdown';
import { toast } from 'sonner';

interface AgentStep {
  id: string;
  type: 'think' | 'plan' | 'tool_call' | 'observe' | 'answer';
  content: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolResult?: {
    success: boolean;
    output: string;
    error?: string;
    artifacts?: Array<{
      type: string;
      content: string;
      name?: string;
      mimeType?: string;
    }>;
  };
  startedAt?: string;
  completedAt?: string;
  duration?: number;
}

interface AgentTask {
  id: string;
  goal: string;
  status: 'idle' | 'thinking' | 'planning' | 'executing' | 'observing' | 'completed' | 'failed';
  currentPhase?: string;
  steps: AgentStep[];
  result?: string;
  error?: string;
  artifacts?: Array<{
    type: string;
    content: string;
    name?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export default function AgentMode() {
  const [goal, setGoal] = useState('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  
  const stepsEndRef = useRef<HTMLDivElement>(null);
  
  // Queries
  const { data: tasksData, refetch: refetchTasks } = trpc.agent.listTasks.useQuery();
  const { data: activeTaskData, refetch: refetchActiveTask } = trpc.agent.getTask.useQuery(
    { taskId: activeTaskId || '' },
    { enabled: !!activeTaskId, refetchInterval: activeTaskId ? 1500 : false }
  );
  const { data: toolsData } = trpc.agent.getAvailableTools.useQuery();
  
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
          maxIterations: 15,
          maxToolCalls: 25
        }
      });
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };
  
  const toggleStepExpand = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papiers');
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'executing': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'thinking': return <Brain className="w-4 h-4 text-purple-500 animate-pulse" />;
      case 'observing': return <Eye className="w-4 h-4 text-cyan-500" />;
      case 'pending': 
      case 'idle': return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };
  
  const getStepTypeIcon = (type: string, toolName?: string) => {
    if (type === 'tool_call' && toolName) {
      if (toolName.includes('python') || toolName.includes('javascript')) {
        return <Code className="w-4 h-4 text-blue-500" />;
      }
      if (toolName.includes('search') || toolName.includes('web')) {
        return <Search className="w-4 h-4 text-green-500" />;
      }
      if (toolName.includes('image')) {
        return <ImageIcon className="w-4 h-4 text-pink-500" />;
      }
      if (toolName.includes('calculate') || toolName.includes('data')) {
        return <Calculator className="w-4 h-4 text-orange-500" />;
      }
      return <Zap className="w-4 h-4 text-blue-500" />;
    }
    
    switch (type) {
      case 'think': return <Brain className="w-4 h-4 text-purple-500" />;
      case 'plan': return <Sparkles className="w-4 h-4 text-yellow-500" />;
      case 'tool_call': return <Zap className="w-4 h-4 text-blue-500" />;
      case 'observe': return <Eye className="w-4 h-4 text-cyan-500" />;
      case 'answer': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default: return <ChevronRight className="w-4 h-4" />;
    }
  };
  
  const getStepTypeName = (type: string) => {
    switch (type) {
      case 'think': return 'Réflexion';
      case 'plan': return 'Planification';
      case 'tool_call': return 'Action';
      case 'observe': return 'Observation';
      case 'answer': return 'Réponse';
      default: return type;
    }
  };
  
  const activeTask = activeTaskData?.task as AgentTask | undefined;
  const tasks = tasksData?.tasks || [];
  const tools = toolsData?.tools || [];
  
  const isRunning = activeTask?.status === 'executing' || 
                    activeTask?.status === 'thinking' || 
                    activeTask?.status === 'planning' ||
                    activeTask?.status === 'observing';
  
  return (
    <div className="flex h-full bg-background">
      {/* Sidebar - Liste des tâches */}
      <div className="w-80 border-r border-border bg-card/50 flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Agent Phoenix
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Agent autonome avec {tools.length} outils
          </p>
        </div>
        
        {/* Liste des outils disponibles */}
        <div className="p-3 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Outils disponibles</p>
          <div className="flex flex-wrap gap-1">
            {tools.slice(0, 8).map((tool: any) => (
              <Badge key={tool.name} variant="outline" className="text-xs">
                {tool.name.replace(/_/g, ' ')}
              </Badge>
            ))}
            {tools.length > 8 && (
              <Badge variant="outline" className="text-xs">+{tools.length - 8}</Badge>
            )}
          </div>
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
                  className={`cursor-pointer transition-all hover:bg-accent/50 ${
                    activeTaskId === task.id ? 'ring-2 ring-primary bg-accent/30' : ''
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
                        className="h-6 w-6 shrink-0 opacity-50 hover:opacity-100"
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
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{activeTask.goal}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={
                        activeTask.status === 'completed' ? 'default' :
                        activeTask.status === 'failed' ? 'destructive' :
                        isRunning ? 'secondary' : 'outline'
                      } className="gap-1">
                        {getStatusIcon(activeTask.status)}
                        {activeTask.currentPhase || activeTask.status}
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
                    {activeTask.status === 'idle' && (
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
                <div className="space-y-3 max-w-4xl mx-auto">
                  {activeTask.steps.map((step, index) => {
                    const isExpanded = expandedSteps.has(step.id);
                    const hasDetails = step.toolArgs || step.toolResult;
                    
                    return (
                      <div key={step.id} className="flex gap-3">
                        {/* Timeline line */}
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            step.status === 'completed' ? 'bg-green-500/20' :
                            step.status === 'failed' ? 'bg-red-500/20' :
                            step.status === 'executing' ? 'bg-blue-500/20 animate-pulse' :
                            'bg-muted'
                          }`}>
                            {getStepTypeIcon(step.type, step.toolName)}
                          </div>
                          {index < activeTask.steps.length - 1 && (
                            <div className="w-0.5 flex-1 bg-border mt-2 min-h-[20px]" />
                          )}
                        </div>
                        
                        {/* Step content */}
                        <Card className={`flex-1 ${
                          step.status === 'executing' ? 'ring-1 ring-blue-500/50' : ''
                        }`}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {getStepTypeName(step.type)}
                                  </span>
                                  {step.toolName && (
                                    <Badge variant="outline" className="text-xs">
                                      {step.toolName}
                                    </Badge>
                                  )}
                                  {step.duration && (
                                    <span className="text-xs text-muted-foreground">
                                      {(step.duration / 1000).toFixed(1)}s
                                    </span>
                                  )}
                                </div>
                                
                                {/* Step content */}
                                <div className="text-sm">
                                  {step.type === 'answer' ? (
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                      <Streamdown>{
                                        (() => {
                                          try {
                                            const parsed = JSON.parse(step.content || '');
                                            return parsed.action?.answer || parsed.answer || step.content;
                                          } catch {
                                            return step.content;
                                          }
                                        })()
                                      }</Streamdown>
                                    </div>
                                  ) : step.type === 'think' ? (
                                    <p className="text-foreground/80">{
                                      (() => {
                                        try {
                                          const parsed = JSON.parse(step.content || '');
                                          return parsed.thinking || step.content;
                                        } catch {
                                          return step.content;
                                        }
                                      })()
                                    }</p>
                                  ) : (
                                    <p className="text-foreground/80">{step.content}</p>
                                  )}
                                </div>
                                
                                {/* Tool result */}
                                {step.toolResult && (
                                  <div className={`mt-2 p-2 rounded text-xs ${
                                    step.toolResult.success 
                                      ? 'bg-green-500/10 border border-green-500/20' 
                                      : 'bg-red-500/10 border border-red-500/20'
                                  }`}>
                                    {step.toolResult.success ? (
                                      <pre className="whitespace-pre-wrap font-mono text-xs max-h-40 overflow-auto">
                                        {step.toolResult.output}
                                      </pre>
                                    ) : (
                                      <p className="text-red-500">{step.toolResult.error}</p>
                                    )}
                                    
                                    {/* Artifacts (images, etc.) */}
                                    {step.toolResult.artifacts?.map((artifact, i) => (
                                      <div key={i} className="mt-2">
                                        {artifact.type === 'image' && (
                                          <img 
                                            src={artifact.content} 
                                            alt={artifact.name || 'Generated image'}
                                            className="max-w-full rounded"
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              {/* Expand button */}
                              {hasDetails && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0"
                                  onClick={() => toggleStepExpand(step.id)}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                            
                            {/* Expanded details */}
                            {isExpanded && step.toolArgs && (
                              <div className="mt-3 pt-3 border-t border-border">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-muted-foreground">Arguments</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => copyToClipboard(JSON.stringify(step.toolArgs, null, 2))}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                                <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-40 font-mono">
                                  {JSON.stringify(step.toolArgs, null, 2)}
                                </pre>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                  
                  {/* Final result */}
                  {activeTask.status === 'completed' && activeTask.result && (
                    <Card className="border-green-500/30 bg-green-500/5">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <span className="font-medium">Tâche terminée</span>
                        </div>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <Streamdown>{
                            (() => {
                              try {
                                // Essayer de parser le JSON pour extraire la réponse
                                const parsed = JSON.parse(activeTask.result || '');
                                return parsed.action?.answer || parsed.answer || activeTask.result;
                              } catch {
                                return activeTask.result;
                              }
                            })()
                          }</Streamdown>
                        </div>
                        
                        {/* Display artifacts */}
                        {activeTask.artifacts && activeTask.artifacts.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <p className="text-sm font-medium mb-2">Fichiers générés</p>
                            <div className="grid grid-cols-2 gap-2">
                              {activeTask.artifacts.map((artifact, i) => (
                                <div key={i} className="p-2 bg-muted rounded">
                                  {artifact.type === 'image' ? (
                                    <img 
                                      src={artifact.content} 
                                      alt={artifact.name || 'Image'}
                                      className="w-full rounded"
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4" />
                                      <span className="text-sm truncate">{artifact.name}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Error state */}
                  {activeTask.status === 'failed' && activeTask.error && (
                    <Card className="border-red-500/30 bg-red-500/5">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="w-5 h-5 text-red-500" />
                          <span className="font-medium text-red-500">Erreur</span>
                        </div>
                        <p className="text-sm text-red-500/80">{activeTask.error}</p>
                      </CardContent>
                    </Card>
                  )}
                  
                  <div ref={stepsEndRef} />
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <Bot className="w-16 h-16 mx-auto mb-4 text-primary/50" />
                <h3 className="text-xl font-semibold mb-2">Agent Phoenix</h3>
                <p className="text-muted-foreground mb-4">
                  Donnez une tâche complexe à l'agent. Il planifiera et exécutera automatiquement 
                  les étapes nécessaires en utilisant ses outils.
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm text-left">
                  <div className="p-2 bg-muted rounded flex items-center gap-2">
                    <Code className="w-4 h-4 text-blue-500" />
                    <span>Exécuter du code</span>
                  </div>
                  <div className="p-2 bg-muted rounded flex items-center gap-2">
                    <Search className="w-4 h-4 text-green-500" />
                    <span>Rechercher sur le web</span>
                  </div>
                  <div className="p-2 bg-muted rounded flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-pink-500" />
                    <span>Générer des images</span>
                  </div>
                  <div className="p-2 bg-muted rounded flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-orange-500" />
                    <span>Analyser des données</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Input area */}
        <div className="p-4 border-t border-border bg-card/30">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex gap-2">
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Décrivez la tâche que l'agent doit accomplir..."
                className="min-h-[60px] max-h-[200px] resize-none"
                disabled={createTaskMutation.isPending || runTaskMutation.isPending}
              />
              <Button 
                type="submit" 
                size="lg"
                disabled={!goal.trim() || createTaskMutation.isPending || runTaskMutation.isPending}
                className="px-6"
              >
                {createTaskMutation.isPending || runTaskMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Exemples: "Recherche les dernières actualités sur l'IA et résume-les" • 
              "Calcule la moyenne des nombres 1 à 100 avec Python" • 
              "Génère une image d'un paysage futuriste"
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
