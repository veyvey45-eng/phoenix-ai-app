import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  Play, 
  AlertTriangle, 
  Brain, 
  Database,
  Wrench,
  ChevronRight,
  X,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DemoScenario {
  id: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
  color: string;
  steps: DemoStep[];
  expectedOutcome: string;
}

interface DemoStep {
  type: 'user' | 'system' | 'phoenix';
  content: string;
  highlight?: string;
  delay?: number;
}

interface DemoModeProps {
  onRunDemo: (scenario: DemoScenario) => void;
  isRunning?: boolean;
}

const demoScenarios: DemoScenario[] = [
  {
    id: 'contradiction',
    title: 'Détection de Contradictions',
    description: 'Phoenix détecte et signale une contradiction dans ses propres énoncés',
    icon: AlertTriangle,
    color: 'text-orange-500',
    expectedOutcome: 'Phoenix identifie la contradiction, crée une Issue, et propose une correction avec transparence.',
    steps: [
      { type: 'user', content: 'Quelle est la capitale de l\'Australie?' },
      { type: 'phoenix', content: 'La capitale de l\'Australie est Sydney, la plus grande ville du pays.', highlight: 'Réponse initiale (incorrecte)' },
      { type: 'system', content: '⚠️ Issue détectée: Contradiction factuelle. Sydney n\'est pas la capitale.', highlight: 'Module de Détection' },
      { type: 'phoenix', content: 'Je dois corriger mon énoncé précédent. La capitale de l\'Australie est Canberra, pas Sydney. Sydney est la plus grande ville, mais Canberra a été choisie comme capitale en 1913 comme compromis entre Sydney et Melbourne. Je m\'excuse pour cette erreur.', highlight: 'Auto-correction transparente' },
      { type: 'system', content: '✓ Issue résolue. Score de tourment: 15 → 5', highlight: 'Résolution' }
    ]
  },
  {
    id: 'memory',
    title: 'Mémoire Persistante',
    description: 'Phoenix se souvient d\'informations d\'une conversation précédente',
    icon: Database,
    color: 'text-blue-500',
    expectedOutcome: 'Phoenix utilise sa mémoire vectorielle pour rappeler des informations contextuelles.',
    steps: [
      { type: 'user', content: 'Je m\'appelle Marie et je travaille comme architecte à Lyon.' },
      { type: 'phoenix', content: 'Enchanté Marie! Je note que vous êtes architecte à Lyon. C\'est une belle ville avec une riche histoire architecturale.', highlight: 'Stockage en mémoire' },
      { type: 'system', content: '💾 Mémoire stockée: [fact] "Marie, architecte, Lyon" - Saillance: 0.85', highlight: 'Transpiration' },
      { type: 'user', content: '[Plus tard...] Peux-tu me rappeler ce que je fais dans la vie?' },
      { type: 'system', content: '🔍 Recherche mémoire: "profession utilisateur"', highlight: 'Retrieval RAG' },
      { type: 'phoenix', content: 'Bien sûr Marie! Vous m\'avez dit que vous êtes architecte et que vous travaillez à Lyon. Est-ce que vous travaillez sur des projets intéressants en ce moment?', highlight: 'Rappel contextuel' }
    ]
  },
  {
    id: 'tools',
    title: 'Utilisation d\'Outils',
    description: 'Phoenix utilise des outils pour accomplir des tâches concrètes',
    icon: Wrench,
    color: 'text-yellow-500',
    expectedOutcome: 'Phoenix sélectionne et utilise les outils appropriés avec vérification des résultats.',
    steps: [
      { type: 'user', content: 'Combien font 15% de 847.50€?' },
      { type: 'system', content: '🔧 Sélection d\'outil: calculator', highlight: 'Module Initiative' },
      { type: 'system', content: '⚙️ Exécution: calculator({expression: "847.50 * 0.15"})', highlight: 'Appel d\'outil' },
      { type: 'system', content: '✓ Résultat: 127.125 (temps: 2ms)', highlight: 'Vérification' },
      { type: 'phoenix', content: '15% de 847,50€ = **127,13€** (arrondi au centime).\n\nJ\'ai utilisé l\'outil calculatrice pour garantir la précision du calcul.', highlight: 'Réponse avec transparence' }
    ]
  },
  {
    id: 'hypotheses',
    title: 'Arbitrage Multi-Hypothèses',
    description: 'Phoenix génère et évalue plusieurs hypothèses avant de répondre',
    icon: Brain,
    color: 'text-purple-500',
    expectedOutcome: 'Phoenix montre son processus de réflexion avec plusieurs hypothèses pondérées.',
    steps: [
      { type: 'user', content: 'Devrais-je apprendre Python ou JavaScript en premier?' },
      { type: 'system', content: '🧠 Génération de 3 hypothèses...', highlight: 'Module Arbitrage' },
      { type: 'system', content: 'H1: Python (score: 0.72) - Plus simple, polyvalent\nH2: JavaScript (score: 0.68) - Web omniprésent\nH3: Dépend du contexte (score: 0.85) - Besoin de plus d\'info', highlight: 'Scoring' },
      { type: 'phoenix', content: 'La réponse dépend de vos objectifs:\n\n**Python** (recommandé si): Data science, IA, automatisation, débutant absolu\n**JavaScript** (recommandé si): Développement web, applications interactives\n\nPuis-je vous demander quel domaine vous intéresse le plus?', highlight: 'Réponse nuancée' },
      { type: 'system', content: '📊 Confiance: 0.85 | Incertitude signalée: oui', highlight: 'Transparence' }
    ]
  }
];

export function DemoMode({ onRunDemo, isRunning = false }: DemoModeProps) {
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleRunDemo = (scenario: DemoScenario) => {
    setSelectedScenario(scenario);
    onRunDemo(scenario);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 border-primary/50 hover:bg-primary/10"
          disabled={isRunning}
        >
          <Sparkles className="h-4 w-4 text-primary" />
          Mode Démo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Scénarios de Démonstration
          </DialogTitle>
          <DialogDescription>
            Découvrez les capacités de Phoenix à travers des scénarios interactifs
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {demoScenarios.map((scenario) => {
              const Icon = scenario.icon;
              return (
                <Card 
                  key={scenario.id}
                  className="hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedScenario(
                    selectedScenario?.id === scenario.id ? null : scenario
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-muted ${scenario.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{scenario.title}</CardTitle>
                          <CardDescription className="text-sm">
                            {scenario.description}
                          </CardDescription>
                        </div>
                      </div>
                      <ChevronRight 
                        className={`h-5 w-5 text-muted-foreground transition-transform ${
                          selectedScenario?.id === scenario.id ? 'rotate-90' : ''
                        }`} 
                      />
                    </div>
                  </CardHeader>

                  <AnimatePresence>
                    {selectedScenario?.id === scenario.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CardContent className="pt-0">
                          <div className="border-t pt-4 mt-2 space-y-3">
                            {/* Expected Outcome */}
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                              <Info className="h-4 w-4 text-primary mt-0.5" />
                              <div className="text-sm">
                                <span className="font-medium">Résultat attendu:</span>{' '}
                                {scenario.expectedOutcome}
                              </div>
                            </div>

                            {/* Steps Preview */}
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground uppercase">
                                Aperçu des étapes
                              </p>
                              {scenario.steps.slice(0, 3).map((step, idx) => (
                                <div 
                                  key={idx}
                                  className="flex items-start gap-2 text-sm"
                                >
                                  <Badge 
                                    variant={
                                      step.type === 'user' ? 'default' :
                                      step.type === 'phoenix' ? 'secondary' : 'outline'
                                    }
                                    className="text-xs shrink-0"
                                  >
                                    {step.type === 'user' ? 'Vous' : 
                                     step.type === 'phoenix' ? 'Phoenix' : 'Système'}
                                  </Badge>
                                  <span className="text-muted-foreground line-clamp-1">
                                    {step.content}
                                  </span>
                                </div>
                              ))}
                              {scenario.steps.length > 3 && (
                                <p className="text-xs text-muted-foreground">
                                  +{scenario.steps.length - 3} étapes supplémentaires...
                                </p>
                              )}
                            </div>

                            {/* Run Button */}
                            <Button 
                              className="w-full gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRunDemo(scenario);
                              }}
                              disabled={isRunning}
                            >
                              <Play className="h-4 w-4" />
                              Lancer cette démo
                            </Button>
                          </div>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export type { DemoScenario, DemoStep };
export default DemoMode;
