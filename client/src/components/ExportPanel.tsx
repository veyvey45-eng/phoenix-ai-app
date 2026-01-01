import { useState } from "react";
import { 
  Download, 
  FileJson, 
  FileText, 
  Loader2,
  CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  confidence?: number;
  hypotheses?: Array<{ id: string; content: string; confidence: number; score?: number }>;
  issues?: string[];
  toolCalls?: Array<{ name: string; result: unknown }>;
}

interface AuditEntry {
  id: number;
  eventType: string;
  entityType: string;
  entityId: number;
  details?: Record<string, unknown> | null;
  createdAt: Date;
}

interface ExportPanelProps {
  messages: Message[];
  auditLog?: AuditEntry[];
  phoenixState?: {
    tormentScore: number;
    openIssuesCount: number;
    totalDecisions: number;
    totalUtterances: number;
  };
}

export function ExportPanel({ messages, auditLog = [], phoenixState }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const exportAsJSON = async () => {
    setIsExporting('json');
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        phoenixState,
        conversation: {
          messageCount: messages.length,
          messages: messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            confidence: m.confidence,
            hypotheses: m.hypotheses,
            issues: m.issues,
            toolCalls: m.toolCalls
          }))
        },
        auditLog: auditLog.map(entry => ({
          id: entry.id,
          eventType: entry.eventType,
          entityType: entry.entityType,
          entityId: entry.entityId,
          details: entry.details,
          createdAt: entry.createdAt
        }))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `phoenix-export-${formatDate(new Date())}.json`);
      toast.success('Export JSON téléchargé');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    } finally {
      setIsExporting(null);
    }
  };

  const exportAsMarkdown = async () => {
    setIsExporting('md');
    try {
      let markdown = `# Export Phoenix AI\n\n`;
      markdown += `**Date d'export:** ${new Date().toLocaleString('fr-FR')}\n\n`;

      if (phoenixState) {
        markdown += `## État du Système\n\n`;
        markdown += `| Métrique | Valeur |\n`;
        markdown += `|----------|--------|\n`;
        markdown += `| Score de Tourment | ${phoenixState.tormentScore}/100 |\n`;
        markdown += `| Issues Ouvertes | ${phoenixState.openIssuesCount} |\n`;
        markdown += `| Décisions Totales | ${phoenixState.totalDecisions} |\n`;
        markdown += `| Énoncés Totaux | ${phoenixState.totalUtterances} |\n\n`;
      }

      markdown += `## Conversation\n\n`;
      markdown += `*${messages.length} messages*\n\n`;

      for (const msg of messages) {
        const roleLabel = msg.role === 'user' ? '👤 Utilisateur' : 
                         msg.role === 'assistant' ? '🔥 Phoenix' : '⚙️ Système';
        const time = new Date(msg.timestamp).toLocaleTimeString('fr-FR');
        
        markdown += `### ${roleLabel} (${time})\n\n`;
        markdown += `${msg.content}\n\n`;

        if (msg.confidence !== undefined) {
          markdown += `> Confiance: ${(msg.confidence * 100).toFixed(0)}%\n\n`;
        }

        if (msg.hypotheses && msg.hypotheses.length > 0) {
          markdown += `**Hypothèses considérées:**\n`;
          for (const h of msg.hypotheses) {
            markdown += `- ${h.content} (score: ${(h.score ?? h.confidence).toFixed(2)})\n`;
          }
          markdown += `\n`;
        }

        if (msg.issues && msg.issues.length > 0) {
          markdown += `**Issues détectées:**\n`;
          for (const issue of msg.issues) {
            markdown += `- ⚠️ ${issue}\n`;
          }
          markdown += `\n`;
        }

        if (msg.toolCalls && msg.toolCalls.length > 0) {
          markdown += `**Outils utilisés:**\n`;
          for (const tool of msg.toolCalls) {
            markdown += `- 🔧 ${tool.name}\n`;
          }
          markdown += `\n`;
        }

        markdown += `---\n\n`;
      }

      if (auditLog.length > 0) {
        markdown += `## Journal d'Audit\n\n`;
        markdown += `*${auditLog.length} entrées*\n\n`;
        markdown += `| Heure | Type | Entité | Détails |\n`;
        markdown += `|-------|------|--------|----------|\n`;

        for (const entry of auditLog.slice(0, 50)) {
          const time = new Date(entry.createdAt).toLocaleTimeString('fr-FR');
          const details = entry.details ? JSON.stringify(entry.details).slice(0, 50) : '-';
          markdown += `| ${time} | ${entry.eventType} | ${entry.entityType} | ${details} |\n`;
        }

        if (auditLog.length > 50) {
          markdown += `\n*... et ${auditLog.length - 50} entrées supplémentaires*\n`;
        }
      }

      const blob = new Blob([markdown], { type: 'text/markdown' });
      downloadBlob(blob, `phoenix-export-${formatDate(new Date())}.md`);
      toast.success('Export Markdown téléchargé');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    } finally {
      setIsExporting(null);
    }
  };

  const exportAuditOnly = async () => {
    setIsExporting('audit');
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        entryCount: auditLog.length,
        entries: auditLog
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `phoenix-audit-${formatDate(new Date())}.json`);
      toast.success('Journal d\'audit téléchargé');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    } finally {
      setIsExporting(null);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exporter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Format d'export</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={exportAsJSON}
          disabled={!!isExporting}
          className="gap-2"
        >
          <FileJson className="h-4 w-4" />
          <div className="flex flex-col">
            <span>Export complet (JSON)</span>
            <span className="text-xs text-muted-foreground">
              Conversation + Audit + État
            </span>
          </div>
          {isExporting === 'json' && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={exportAsMarkdown}
          disabled={!!isExporting}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          <div className="flex flex-col">
            <span>Rapport lisible (Markdown)</span>
            <span className="text-xs text-muted-foreground">
              Format documentaire
            </span>
          </div>
          {isExporting === 'md' && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem 
          onClick={exportAuditOnly}
          disabled={!!isExporting || auditLog.length === 0}
          className="gap-2"
        >
          <FileJson className="h-4 w-4" />
          <div className="flex flex-col">
            <span>Journal d'audit seul</span>
            <span className="text-xs text-muted-foreground">
              {auditLog.length} entrées
            </span>
          </div>
          {isExporting === 'audit' && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ExportPanel;
