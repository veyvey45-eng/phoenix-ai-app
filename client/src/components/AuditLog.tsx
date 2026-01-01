import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { 
  MessageSquare, 
  Brain, 
  AlertTriangle, 
  CheckCircle, 
  Play, 
  XCircle,
  Database,
  Search,
  Activity,
  Settings,
  Shield,
  Moon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type EventType = 
  | "utterance_created"
  | "decision_made"
  | "issue_detected"
  | "issue_resolved"
  | "action_requested"
  | "action_executed"
  | "action_rejected"
  | "memory_stored"
  | "memory_retrieved"
  | "torment_updated"
  | "criteria_changed"
  | "security_violation"
  | "consolidation_run";

interface AuditEntry {
  id: number;
  eventType: EventType;
  entityType: string;
  entityId: number;
  details?: Record<string, unknown> | null;
  createdAt: Date;
}

interface AuditLogProps {
  entries: AuditEntry[];
  maxHeight?: string;
}

const eventConfig: Record<EventType, { icon: typeof MessageSquare; color: string; label: string }> = {
  utterance_created: { icon: MessageSquare, color: "text-blue-400", label: "Énoncé" },
  decision_made: { icon: Brain, color: "text-purple-400", label: "Décision" },
  issue_detected: { icon: AlertTriangle, color: "text-orange-400", label: "Issue détectée" },
  issue_resolved: { icon: CheckCircle, color: "text-green-400", label: "Issue résolue" },
  action_requested: { icon: Play, color: "text-cyan-400", label: "Action demandée" },
  action_executed: { icon: CheckCircle, color: "text-green-400", label: "Action exécutée" },
  action_rejected: { icon: XCircle, color: "text-red-400", label: "Action rejetée" },
  memory_stored: { icon: Database, color: "text-indigo-400", label: "Mémoire stockée" },
  memory_retrieved: { icon: Search, color: "text-teal-400", label: "Mémoire récupérée" },
  torment_updated: { icon: Activity, color: "text-amber-400", label: "Tourment mis à jour" },
  criteria_changed: { icon: Settings, color: "text-gray-400", label: "Critères modifiés" },
  security_violation: { icon: Shield, color: "text-red-500", label: "Violation sécurité" },
  consolidation_run: { icon: Moon, color: "text-violet-400", label: "Consolidation" }
};

export function AuditLog({ entries, maxHeight = "400px" }: AuditLogProps) {
  if (entries.length === 0) {
    return (
      <Card className="phoenix-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Aucune entrée dans le journal</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="phoenix-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Journal d'Audit
          <Badge variant="secondary" className="ml-auto">
            {entries.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea style={{ height: maxHeight }} className="pr-4">
          <div className="space-y-1">
            {entries.map((entry, index) => (
              <AuditEntry key={entry.id} entry={entry} index={index} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface AuditEntryProps {
  entry: AuditEntry;
  index: number;
}

function AuditEntry({ entry, index }: AuditEntryProps) {
  const config = eventConfig[entry.eventType] || {
    icon: Activity,
    color: "text-gray-400",
    label: entry.eventType
  };
  const Icon = config.icon;

  const formatDetails = (details?: Record<string, unknown>): string => {
    if (!details) return "";
    
    const parts: string[] = [];
    
    if (details.role) parts.push(`role: ${details.role}`);
    if (details.hypothesesCount) parts.push(`${details.hypothesesCount} hypothèses`);
    if (details.tormentChange !== undefined) {
      const change = details.tormentChange as number;
      parts.push(`tourment: ${change > 0 ? "+" : ""}${change.toFixed(1)}`);
    }
    if (details.resultsCount !== undefined) parts.push(`${details.resultsCount} résultats`);
    if (details.salience !== undefined) parts.push(`saillance: ${(details.salience as number).toFixed(2)}`);
    if (details.memoryType) parts.push(`type: ${details.memoryType}`);
    if (details.before !== undefined && details.after !== undefined) {
      parts.push(`${details.before} → ${details.after}`);
    }
    
    return parts.join(" · ");
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className="audit-entry group"
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.color)} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{config.label}</span>
            <span className="text-xs text-muted-foreground">
              #{entry.entityId}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {formatDistanceToNow(new Date(entry.createdAt), { 
                addSuffix: true,
                locale: fr 
              })}
            </span>
          </div>
          
          {entry.details && Object.keys(entry.details).length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {formatDetails(entry.details)}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface CompactAuditProps {
  entries: AuditEntry[];
  limit?: number;
}

export function CompactAudit({ entries, limit = 5 }: CompactAuditProps) {
  const recentEntries = entries.slice(0, limit);
  
  return (
    <div className="space-y-2">
      {recentEntries.map((entry) => {
        const config = eventConfig[entry.eventType];
        const Icon = config?.icon || Activity;
        
        return (
          <div key={entry.id} className="flex items-center gap-2 text-xs">
            <Icon className={cn("w-3 h-3", config?.color || "text-gray-400")} />
            <span className="truncate">{config?.label || entry.eventType}</span>
            <span className="text-muted-foreground ml-auto">
              {formatDistanceToNow(new Date(entry.createdAt), { 
                addSuffix: true,
                locale: fr 
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
