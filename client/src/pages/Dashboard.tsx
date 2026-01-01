import { useState, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { PhoenixChat } from "@/components/PhoenixChat";
import { TormentGauge } from "@/components/TormentGauge";
import { HypothesesPanel } from "@/components/HypothesesPanel";
import { IssuesPanel, IssueStats } from "@/components/IssuesPanel";
import { AuditLog, CompactAudit } from "@/components/AuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Brain, 
  Activity, 
  AlertTriangle, 
  Database,
  MessageSquare,
  Sparkles,
  Shield,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";


interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  hypotheses?: Array<{
    id: string;
    content: string;
    confidence: number;
    reasoning?: string;
    sources?: string[];
  }>;
  chosenHypothesisId?: string;
  tormentScore?: number;
  tormentChange?: number;
  reasoning?: string;
  timestamp: Date;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [contextId] = useState(() => crypto.randomUUID());
  const [activeTab, setActiveTab] = useState("chat");

  // Queries
  const phoenixState = trpc.phoenix.getState.useQuery(undefined, {
    refetchInterval: 5000 // Refresh every 5 seconds
  });
  
  const auditLog = trpc.audit.list.useQuery({ limit: 50 });
  const criteria = trpc.criteria.list.useQuery();

  // Mutations
  const chatMutation = trpc.phoenix.chat.useMutation({
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        confidence: data.confidence,
        hypotheses: data.hypotheses,
        chosenHypothesisId: data.hypotheses.find(h => h.id === data.hypotheses[0]?.id)?.id,
        tormentScore: data.tormentScore,
        tormentChange: data.tormentChange,
        reasoning: data.rationale,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Invalidate queries to refresh data
      phoenixState.refetch();
      auditLog.refetch();
    },
    onError: (error) => {
      toast.error("Erreur lors de la communication avec Phoenix", {
        description: error.message
      });
    }
  });

  const resolveIssueMutation = trpc.issues.resolve.useMutation({
    onSuccess: () => {
      toast.success("Issue résolue");
      phoenixState.refetch();
    }
  });

  const deferIssueMutation = trpc.issues.defer.useMutation({
    onSuccess: () => {
      toast.info("Issue reportée");
      phoenixState.refetch();
    }
  });

  const handleSendMessage = useCallback(async (content: string) => {
    // Add user message immediately
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Send to Phoenix
    await chatMutation.mutateAsync({
      message: content,
      contextId
    });
  }, [chatMutation, contextId]);

  const handleResolveIssue = useCallback((issueId: number, resolution: string) => {
    resolveIssueMutation.mutate({ issueId, resolution });
  }, [resolveIssueMutation]);

  const handleDeferIssue = useCallback((issueId: number) => {
    deferIssueMutation.mutate({ issueId });
  }, [deferIssueMutation]);

  const state = phoenixState.data;
  const lastHypotheses = messages.filter(m => m.role === "assistant" && m.hypotheses).slice(-1)[0]?.hypotheses || [];

  return (
    <DashboardLayout>
      <div className="h-full flex">
        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="border-b border-border px-4">
              <TabsList className="h-12">
                <TabsTrigger value="chat" className="gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="hypotheses" className="gap-2">
                  <Brain className="w-4 h-4" />
                  Hypothèses
                </TabsTrigger>
                <TabsTrigger value="audit" className="gap-2">
                  <Activity className="w-4 h-4" />
                  Journal
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="chat" className="flex-1 m-0">
              <PhoenixChat
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={chatMutation.isPending}
                currentTorment={state?.tormentScore || 0}
              />
            </TabsContent>

            <TabsContent value="hypotheses" className="flex-1 m-0 p-4 overflow-auto">
              <div className="max-w-4xl mx-auto space-y-4">
                <HypothesesPanel
                  hypotheses={lastHypotheses}
                  chosenId={messages.filter(m => m.role === "assistant").slice(-1)[0]?.chosenHypothesisId}
                  showReasoning
                />
                
                {criteria.data && criteria.data.length > 0 && (
                  <Card className="phoenix-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        Critères de Jugement Actifs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {criteria.data.map((c) => (
                          <div key={c.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant={c.level === "0" ? "destructive" : "secondary"}>
                                N{c.level}
                              </Badge>
                              <span className="text-sm">{c.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Poids: {c.weight}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="audit" className="flex-1 m-0 p-4 overflow-auto">
              <div className="max-w-4xl mx-auto">
                <AuditLog 
                  entries={auditLog.data || []} 
                  maxHeight="calc(100vh - 250px)"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right sidebar - State panel */}
        <div className="w-80 border-l border-border bg-card/50 p-4 overflow-auto hidden lg:block">
          <div className="space-y-6">
            {/* Torment Gauge */}
            <div className="flex flex-col items-center">
              <TormentGauge 
                score={state?.tormentScore || 0} 
                size="lg"
              />
            </div>

            <Separator />

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="phoenix-card">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {state?.totalDecisions || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Décisions</p>
                </CardContent>
              </Card>
              <Card className="phoenix-card">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {state?.totalUtterances || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Énoncés</p>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Issues */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Issues Actives
              </h3>
              {state?.issueStats && (
                <IssueStats {...state.issueStats} />
              )}
              <div className="mt-3">
                <IssuesPanel
                  issues={state?.activeIssues || []}
                  onResolve={handleResolveIssue}
                  onDefer={handleDeferIssue}
                  isLoading={phoenixState.isLoading}
                />
              </div>
            </div>

            <Separator />

            {/* Recent Activity */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Activité Récente
              </h3>
              <CompactAudit entries={auditLog.data || []} limit={5} />
            </div>

            {/* Identity Version */}
            <div className="text-center text-xs text-muted-foreground">
              <p>Version d'identité: {state?.identityVersion || 1}</p>
              {state?.lastConsolidation && (
                <p>Dernière consolidation: {new Date(state.lastConsolidation).toLocaleDateString("fr-FR")}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
