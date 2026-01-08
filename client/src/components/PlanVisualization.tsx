/**
 * PlanVisualization - Composant de visualisation du plan d'exécution
 * 
 * Affiche le plan de tâches de Phoenix AI de manière visuelle,
 * similaire à l'interface de Manus AI.
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Target,
  ListTodo,
  ArrowRight,
  SkipForward
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Types pour le plan
export interface PlanPhase {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  estimatedDuration: number;
  actualDuration?: number;
  dependencies: number[];
  outputs: string[];
  startedAt?: number;
  completedAt?: number;
}

export interface Plan {
  id: string;
  goal: string;
  phases: PlanPhase[];
  currentPhaseId: number;
  status: 'created' | 'in_progress' | 'completed' | 'failed' | 'revised';
  createdAt: number;
  updatedAt: number;
  totalEstimatedDuration: number;
}

interface PlanVisualizationProps {
  plan: Plan | null;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
}

// Icône de statut pour chaque phase
function PhaseStatusIcon({ status }: { status: PlanPhase['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'in_progress':
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case 'failed':
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    case 'skipped':
      return <SkipForward className="w-5 h-5 text-gray-400" />;
    case 'pending':
    default:
      return <Circle className="w-5 h-5 text-gray-300" />;
  }
}

// Badge de statut
function StatusBadge({ status }: { status: PlanPhase['status'] }) {
  const variants: Record<PlanPhase['status'], string> = {
    pending: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    in_progress: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
    completed: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
    failed: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400',
    skipped: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  };

  const labels: Record<PlanPhase['status'], string> = {
    pending: 'En attente',
    in_progress: 'En cours',
    completed: 'Terminé',
    failed: 'Échoué',
    skipped: 'Ignoré',
  };

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", variants[status])}>
      {labels[status]}
    </span>
  );
}

// Composant pour une phase individuelle
function PhaseItem({ phase, isActive, isLast }: { phase: PlanPhase; isActive: boolean; isLast: boolean }) {
  const [isOpen, setIsOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) setIsOpen(true);
  }, [isActive]);

  return (
    <div className="relative">
      {/* Ligne de connexion */}
      {!isLast && (
        <div className={cn(
          "absolute left-[9px] top-8 w-0.5 h-full -translate-x-1/2",
          phase.status === 'completed' ? 'bg-green-300 dark:bg-green-700' : 'bg-gray-200 dark:bg-gray-700'
        )} />
      )}

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className={cn(
            "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
            isActive && "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800",
            !isActive && "hover:bg-gray-50 dark:hover:bg-gray-800/50"
          )}>
            <div className="flex-shrink-0 mt-0.5">
              <PhaseStatusIcon status={phase.status} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className={cn(
                  "font-medium text-sm truncate",
                  phase.status === 'completed' && "text-green-700 dark:text-green-400",
                  phase.status === 'in_progress' && "text-blue-700 dark:text-blue-400",
                  phase.status === 'pending' && "text-gray-600 dark:text-gray-400"
                )}>
                  {phase.id}. {phase.title}
                </h4>
                <div className="flex items-center gap-2">
                  <StatusBadge status={phase.status} />
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="ml-8 pl-3 border-l-2 border-gray-200 dark:border-gray-700 mt-2 mb-3"
          >
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {phase.description}
            </p>
            
            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {phase.actualDuration 
                  ? `${phase.actualDuration}s (estimé: ${phase.estimatedDuration}s)`
                  : `~${phase.estimatedDuration}s`
                }
              </span>
              
              {phase.outputs.length > 0 && (
                <span className="flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  {phase.outputs.join(', ')}
                </span>
              )}
            </div>
          </motion.div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Composant principal
export function PlanVisualization({ 
  plan, 
  isExpanded = true, 
  onToggleExpand,
  className 
}: PlanVisualizationProps) {
  if (!plan) {
    return null;
  }

  const completedPhases = plan.phases.filter(p => p.status === 'completed').length;
  const totalPhases = plan.phases.length;
  const progressPercent = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;
  const currentPhase = plan.phases.find(p => p.id === plan.currentPhaseId);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Plan d'exécution</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {completedPhases}/{totalPhases} phases
            </Badge>
            {onToggleExpand && (
              <Button variant="ghost" size="sm" onClick={onToggleExpand}>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Objectif */}
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
          <span className="font-medium">Objectif:</span> {plan.goal}
        </p>

        {/* Barre de progression */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progression</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Phase actuelle */}
        {currentPhase && (
          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              <span className="font-medium text-blue-700 dark:text-blue-400">
                En cours: {currentPhase.title}
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0">
              <div className="space-y-1">
                {plan.phases.map((phase, index) => (
                  <PhaseItem
                    key={phase.id}
                    phase={phase}
                    isActive={phase.id === plan.currentPhaseId}
                    isLast={index === plan.phases.length - 1}
                  />
                ))}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// Composant compact pour affichage dans le chat
export function CompactPlanVisualization({ plan }: { plan: Plan | null }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!plan) return null;

  const completedPhases = plan.phases.filter(p => p.status === 'completed').length;
  const totalPhases = plan.phases.length;
  const progressPercent = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

  return (
    <div className="border rounded-lg p-3 bg-card">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            Plan: {completedPhases}/{totalPhases} phases ({progressPercent}%)
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3"
          >
            <Progress value={progressPercent} className="h-1.5 mb-3" />
            <div className="space-y-2">
              {plan.phases.map((phase) => (
                <div
                  key={phase.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <PhaseStatusIcon status={phase.status} />
                  <span className={cn(
                    phase.status === 'completed' && "text-green-600 dark:text-green-400 line-through",
                    phase.status === 'in_progress' && "text-blue-600 dark:text-blue-400 font-medium",
                    phase.status === 'pending' && "text-muted-foreground"
                  )}>
                    {phase.title}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PlanVisualization;
