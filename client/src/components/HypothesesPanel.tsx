import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Hypothesis {
  id: string;
  content: string;
  confidence: number;
  reasoning?: string;
  sources?: string[];
}

interface HypothesesPanelProps {
  hypotheses: Hypothesis[];
  chosenId?: string;
  showReasoning?: boolean;
}

export function HypothesesPanel({ 
  hypotheses, 
  chosenId,
  showReasoning = false 
}: HypothesesPanelProps) {
  if (hypotheses.length === 0) {
    return (
      <Card className="phoenix-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Aucune hypothèse générée</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="phoenix-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-primary" />
          Hypothèses Concurrentes
          <Badge variant="secondary" className="ml-auto">
            {hypotheses.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <AnimatePresence>
            <div className="space-y-3">
              {hypotheses.map((hyp, index) => (
                <HypothesisCard
                  key={hyp.id}
                  hypothesis={hyp}
                  isChosen={hyp.id === chosenId}
                  index={index}
                  showReasoning={showReasoning}
                />
              ))}
            </div>
          </AnimatePresence>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface HypothesisCardProps {
  hypothesis: Hypothesis;
  isChosen: boolean;
  index: number;
  showReasoning: boolean;
}

function HypothesisCard({ hypothesis, isChosen, index, showReasoning }: HypothesisCardProps) {
  const confidenceColor = hypothesis.confidence >= 0.8 
    ? "confidence-high" 
    : hypothesis.confidence >= 0.5 
      ? "confidence-medium" 
      : "confidence-low";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "rounded-lg border p-3 transition-all",
        isChosen 
          ? "border-primary bg-primary/10 phoenix-glow" 
          : "border-border/50 bg-card/50 hover:bg-card/80"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {isChosen ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : (
            <Circle className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground">
              {hypothesis.id}
            </span>
            <Badge 
              variant="outline" 
              className={cn("text-xs", confidenceColor)}
            >
              {(hypothesis.confidence * 100).toFixed(0)}%
            </Badge>
            {isChosen && (
              <Badge className="bg-primary text-primary-foreground text-xs">
                Choisie
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-foreground line-clamp-3">
            {hypothesis.content.length > 200 
              ? hypothesis.content.substring(0, 200) + "..." 
              : hypothesis.content}
          </p>
          
          {showReasoning && hypothesis.reasoning && (
            <p className="text-xs text-muted-foreground mt-2 italic">
              {hypothesis.reasoning}
            </p>
          )}
          
          {hypothesis.sources && hypothesis.sources.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {hypothesis.sources.map((source, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {source}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface CompactHypothesesProps {
  hypotheses: Hypothesis[];
  chosenId?: string;
}

export function CompactHypotheses({ hypotheses, chosenId }: CompactHypothesesProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {hypotheses.map((hyp) => (
        <Badge
          key={hyp.id}
          variant={hyp.id === chosenId ? "default" : "outline"}
          className={cn(
            "text-xs",
            hyp.id === chosenId && "bg-primary"
          )}
        >
          {hyp.id}: {(hyp.confidence * 100).toFixed(0)}%
        </Badge>
      ))}
    </div>
  );
}
