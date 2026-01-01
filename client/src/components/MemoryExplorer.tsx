import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, 
  Search, 
  Database, 
  Lightbulb, 
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Moon,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

type MemoryType = 'utterance' | 'decision' | 'fact' | 'correction' | 'insight';

interface Memory {
  id: string;
  content: string;
  type: MemoryType;
  timestamp: number;
  salience: number;
  score?: number;
  contextId?: string;
}

const typeConfig: Record<MemoryType, { icon: typeof Brain; color: string; label: string }> = {
  utterance: { icon: MessageSquare, color: "text-blue-400", label: "Énoncé" },
  decision: { icon: Brain, color: "text-purple-400", label: "Décision" },
  fact: { icon: Database, color: "text-green-400", label: "Fait" },
  correction: { icon: AlertTriangle, color: "text-orange-400", label: "Correction" },
  insight: { icon: Lightbulb, color: "text-yellow-400", label: "Insight" }
};

export function MemoryExplorer() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<MemoryType | "all">("all");
  const [expandedMemory, setExpandedMemory] = useState<string | null>(null);

  // Recherche de mémoires
  const searchMutation = trpc.vectraMemory.search.useQuery(
    { 
      query: searchQuery || "recent memories",
      limit: 50,
      types: selectedType === "all" ? undefined : [selectedType]
    },
    { enabled: searchQuery.length > 0 || selectedType !== "all" }
  );

  // Stats de la mémoire
  const statsQuery = trpc.vectraMemory.stats.useQuery();
  
  // Stats du module sommeil
  const sleepStatsQuery = trpc.vectraMemory.sleepStats.useQuery();

  // Consolidation
  const consolidateMutation = trpc.vectraMemory.consolidate.useMutation({
    onSuccess: (data) => {
      toast.success(`Consolidation terminée: ${data.merged} fusionnées, ${data.insightsGenerated} insights générés`);
      searchMutation.refetch();
      sleepStatsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Erreur de consolidation: ${error.message}`);
    }
  });

  const memories = searchMutation.data || [];

  return (
    <div className="space-y-4">
      {/* Header avec stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Database className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Mémoires totales</p>
                <p className="text-2xl font-bold text-white">
                  {statsQuery.data?.totalMemories || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Moon className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Consolidations</p>
                <p className="text-2xl font-bold text-white">
                  {sleepStatsQuery.data?.totalConsolidations || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Lightbulb className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Insights générés</p>
                <p className="text-2xl font-bold text-white">
                  {sleepStatsQuery.data?.totalInsights || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barre de recherche et actions */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Brain className="h-5 w-5 text-orange-400" />
              Explorateur de Mémoire
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => consolidateMutation.mutate()}
              disabled={consolidateMutation.isPending}
              className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20"
            >
              {consolidateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Moon className="h-4 w-4 mr-2" />
              )}
              Consolider
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recherche */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Rechercher dans les mémoires..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => searchMutation.refetch()}
              disabled={searchMutation.isFetching}
              className="border-slate-600"
            >
              {searchMutation.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Filtres par type */}
          <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as MemoryType | "all")}>
            <TabsList className="bg-slate-900/50">
              <TabsTrigger value="all" className="data-[state=active]:bg-slate-700">
                Tous
              </TabsTrigger>
              {Object.entries(typeConfig).map(([type, config]) => (
                <TabsTrigger 
                  key={type} 
                  value={type}
                  className="data-[state=active]:bg-slate-700"
                >
                  <config.icon className={`h-3 w-3 mr-1 ${config.color}`} />
                  {config.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Liste des mémoires */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-4">
          <ScrollArea className="h-[400px]">
            <AnimatePresence mode="popLayout">
              {memories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Database className="h-12 w-12 mb-4 opacity-50" />
                  <p>Aucune mémoire trouvée</p>
                  <p className="text-sm">Commencez une conversation pour créer des mémoires</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {memories.map((memory, index) => (
                    <MemoryCard
                      key={memory.id}
                      memory={memory}
                      index={index}
                      isExpanded={expandedMemory === memory.id}
                      onToggle={() => setExpandedMemory(
                        expandedMemory === memory.id ? null : memory.id
                      )}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

interface MemoryCardProps {
  memory: Memory;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function MemoryCard({ memory, index, isExpanded, onToggle }: MemoryCardProps) {
  const config = typeConfig[memory.type] || typeConfig.utterance;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.05 }}
      className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden"
    >
      <div 
        className="p-3 cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-slate-800 ${config.color}`}>
            <Icon className="h-4 w-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={`text-xs ${config.color} border-current`}>
                {config.label}
              </Badge>
              {memory.score !== undefined && (
                <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-400/50">
                  {(memory.score * 100).toFixed(0)}% match
                </Badge>
              )}
              <span className="text-xs text-slate-500">
                {formatDistanceToNow(new Date(memory.timestamp), { 
                  addSuffix: true, 
                  locale: fr 
                })}
              </span>
            </div>
            
            <p className={`text-sm text-slate-300 ${isExpanded ? '' : 'line-clamp-2'}`}>
              {memory.content}
            </p>

            {/* Barre de saillance */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">Saillance:</span>
              <Progress 
                value={memory.salience * 100} 
                className="h-1.5 flex-1 max-w-[100px] bg-slate-700"
              />
              <span className="text-xs text-slate-400">
                {(memory.salience * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <button className="text-slate-400 hover:text-white transition-colors">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-700"
          >
            <div className="p-3 bg-slate-900/30 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">ID:</span>
                  <span className="ml-2 text-slate-300 font-mono">{memory.id.slice(0, 8)}...</span>
                </div>
                {memory.contextId && (
                  <div>
                    <span className="text-slate-500">Contexte:</span>
                    <span className="ml-2 text-slate-300 font-mono">{memory.contextId.slice(0, 8)}...</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Timestamp:</span>
                  <span className="ml-2 text-slate-300">
                    {new Date(memory.timestamp).toLocaleString('fr-FR')}
                  </span>
                </div>
              </div>
              
              <div className="pt-2">
                <span className="text-xs text-slate-500">Contenu complet:</span>
                <p className="mt-1 text-sm text-slate-300 bg-slate-800/50 p-2 rounded">
                  {memory.content}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default MemoryExplorer;
