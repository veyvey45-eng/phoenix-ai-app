import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, AlertCircle, Info, XCircle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Issue {
  id: number;
  type: "contradiction" | "hallucination" | "mismatch" | "error" | "uncertainty";
  severity: "low" | "medium" | "high" | "critical";
  evidence: string;
  status: "open" | "investigating" | "resolved" | "deferred";
  attempts?: number | null;
  createdAt?: Date;
}

interface IssuesPanelProps {
  issues: Issue[];
  onResolve?: (issueId: number, resolution: string) => void;
  onDefer?: (issueId: number) => void;
  isLoading?: boolean;
}

export function IssuesPanel({ issues, onResolve, onDefer, isLoading }: IssuesPanelProps) {
  const openIssues = issues.filter(i => i.status === "open" || i.status === "investigating");
  
  if (isLoading) {
    return (
      <Card className="phoenix-card">
        <CardContent className="py-8 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement des issues...</p>
        </CardContent>
      </Card>
    );
  }

  if (openIssues.length === 0) {
    return (
      <Card className="phoenix-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
          <p>Aucune incohérence détectée</p>
          <p className="text-xs mt-1">Le système est cohérent</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="phoenix-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          Issues Actives
          <Badge variant="destructive" className="ml-auto">
            {openIssues.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[250px] pr-4">
          <AnimatePresence>
            <div className="space-y-3">
              {openIssues.map((issue, index) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  index={index}
                  onResolve={onResolve}
                  onDefer={onDefer}
                />
              ))}
            </div>
          </AnimatePresence>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface IssueCardProps {
  issue: Issue;
  index: number;
  onResolve?: (issueId: number, resolution: string) => void;
  onDefer?: (issueId: number) => void;
}

function IssueCard({ issue, index, onResolve, onDefer }: IssueCardProps) {
  const severityConfig = {
    low: { color: "text-blue-400", bg: "bg-blue-500/10", icon: Info },
    medium: { color: "text-yellow-400", bg: "bg-yellow-500/10", icon: AlertCircle },
    high: { color: "text-orange-400", bg: "bg-orange-500/10", icon: AlertTriangle },
    critical: { color: "text-red-400", bg: "bg-red-500/10", icon: XCircle }
  };

  const typeLabels = {
    contradiction: "Contradiction",
    hallucination: "Hallucination",
    mismatch: "Mismatch",
    error: "Erreur",
    uncertainty: "Incertitude"
  };

  const config = severityConfig[issue.severity];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "rounded-lg border border-border/50 p-3",
        config.bg
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("w-5 h-5 mt-0.5", config.color)} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className={config.color}>
              {typeLabels[issue.type]}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {issue.severity.toUpperCase()}
            </Badge>
            {issue.status === "investigating" && (
              <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                En cours
              </Badge>
            )}
            {issue.attempts && issue.attempts > 0 && (
              <span className="text-xs text-muted-foreground">
                {issue.attempts} tentative{issue.attempts > 1 ? "s" : ""}
              </span>
            )}
          </div>
          
          <p className="text-sm text-foreground/90 line-clamp-2">
            {issue.evidence}
          </p>
          
          {(onResolve || onDefer) && (
            <div className="flex gap-2 mt-2">
              {onResolve && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => onResolve(issue.id, "Résolu manuellement")}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Résoudre
                </Button>
              )}
              {onDefer && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => onDefer(issue.id)}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  Reporter
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface IssueStatsProps {
  total: number;
  open: number;
  resolved: number;
}

export function IssueStats({ total, open, resolved }: IssueStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="text-center">
        <p className="text-2xl font-bold">{total}</p>
        <p className="text-xs text-muted-foreground">Total</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-orange-400">{open}</p>
        <p className="text-xs text-muted-foreground">Ouvertes</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-green-400">{resolved}</p>
        <p className="text-xs text-muted-foreground">Résolues</p>
      </div>
    </div>
  );
}
