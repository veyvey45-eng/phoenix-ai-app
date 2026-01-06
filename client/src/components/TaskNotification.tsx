/**
 * Task Notification Component
 * Affiche les notifications pour les tâches longues en cours
 */

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X, Loader2, CheckCircle, AlertCircle, Search, FileText, Mail, Image, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TaskNotificationData {
  id: string;
  type: 'research' | 'document' | 'email' | 'image' | 'task';
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  result?: unknown;
  createdAt: Date;
}

interface TaskNotificationProps {
  task: TaskNotificationData;
  onDismiss: (id: string) => void;
  onViewResult?: (task: TaskNotificationData) => void;
}

const typeIcons = {
  research: Search,
  document: FileText,
  email: Mail,
  image: Image,
  task: Workflow,
};

const typeLabels = {
  research: 'Recherche',
  document: 'Document',
  email: 'Email',
  image: 'Image',
  task: 'Tâche',
};

export function TaskNotification({ task, onDismiss, onViewResult }: TaskNotificationProps) {
  const Icon = typeIcons[task.type];
  
  const statusColors = {
    pending: 'text-muted-foreground',
    running: 'text-blue-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
  };

  return (
    <Card className={cn(
      'w-80 shadow-lg border animate-in slide-in-from-right-5 duration-300',
      task.status === 'completed' && 'border-green-500/50',
      task.status === 'failed' && 'border-red-500/50',
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg bg-muted', statusColors[task.status])}>
            {task.status === 'running' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : task.status === 'completed' ? (
              <CheckCircle className="h-4 w-4" />
            ) : task.status === 'failed' ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {typeLabels[task.type]}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-2"
                onClick={() => onDismiss(task.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            
            <p className="font-medium text-sm truncate">{task.title}</p>
            
            {task.message && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {task.message}
              </p>
            )}
            
            {task.status === 'running' && task.progress !== undefined && (
              <Progress value={task.progress} className="h-1 mt-2" />
            )}
            
            {task.status === 'completed' && onViewResult && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 mt-2 text-xs"
                onClick={() => onViewResult(task)}
              >
                Voir le résultat →
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TaskNotificationContainerProps {
  tasks: TaskNotificationData[];
  onDismiss: (id: string) => void;
  onViewResult?: (task: TaskNotificationData) => void;
}

export function TaskNotificationContainer({ tasks, onDismiss, onViewResult }: TaskNotificationContainerProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {tasks.slice(0, 3).map((task) => (
        <TaskNotification
          key={task.id}
          task={task}
          onDismiss={onDismiss}
          onViewResult={onViewResult}
        />
      ))}
      {tasks.length > 3 && (
        <div className="text-center text-xs text-muted-foreground">
          +{tasks.length - 3} autres tâches
        </div>
      )}
    </div>
  );
}

// Hook pour gérer les notifications de tâches
export function useTaskNotifications() {
  const [tasks, setTasks] = useState<TaskNotificationData[]>([]);

  const addTask = (task: Omit<TaskNotificationData, 'id' | 'createdAt'>) => {
    const newTask: TaskNotificationData = {
      ...task,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    setTasks((prev) => [...prev, newTask]);
    return newTask.id;
  };

  const updateTask = (id: string, updates: Partial<TaskNotificationData>) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, ...updates } : task
      )
    );
  };

  const dismissTask = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const clearCompleted = () => {
    setTasks((prev) => prev.filter((task) => task.status !== 'completed'));
  };

  // Auto-dismiss completed tasks after 10 seconds
  useEffect(() => {
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    if (completedTasks.length === 0) return;

    const timeouts = completedTasks.map((task) => {
      const age = Date.now() - task.createdAt.getTime();
      const remainingTime = Math.max(0, 10000 - age);
      return setTimeout(() => dismissTask(task.id), remainingTime);
    });

    return () => timeouts.forEach(clearTimeout);
  }, [tasks]);

  return {
    tasks,
    addTask,
    updateTask,
    dismissTask,
    clearCompleted,
  };
}
