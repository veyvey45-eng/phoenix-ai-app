import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { motion } from "framer-motion";
import { E2BExecutor } from "@/components/E2BExecutor";
import { 
  Brain, 
  Shield, 
  Activity, 
  Database, 
  Sparkles, 
  ArrowRight,
  CheckCircle,
  Zap,
  Eye,
  Lock
} from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    if (user) {
      setLocation("/dashboard");
    } else {
      window.location.href = getLoginUrl();
    }
  };

  if (user) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Bienvenue, {user.name || 'Utilisateur'}!</h1>
            <p className="text-muted-foreground">Exécutez du code dans une sandbox isolée E2B</p>
          </div>
          <E2BExecutor />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        
        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-primary/30 rounded-full"
              initial={{ 
                x: Math.random() * 100 + "%", 
                y: Math.random() * 100 + "%",
                opacity: 0 
              }}
              animate={{ 
                y: [null, "-100%"],
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: Math.random() * 10 + 10,
                repeat: Infinity,
                delay: Math.random() * 5
              }}
            />
          ))}
        </div>

        <div className="container relative pt-20 pb-32">
          <div className="max-w-4xl mx-auto text-center">
            {/* Logo/Icon */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center phoenix-glow">
                <Brain className="w-12 h-12 text-primary-foreground" />
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-5xl md:text-7xl font-bold mb-2"
            >
              <span className="bg-gradient-to-r from-green-500 via-emerald-400 to-blue-500 bg-clip-text text-transparent">
                Phoenix
              </span>
            </motion.h1>
            
            {/* ADAGA Copyright */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-sm text-gray-400 mb-6"
            >
              Propriété ADAGA
            </motion.p>

            {/* Subtitle */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              Système d'orchestration agentique avec{" "}
              <span className="text-foreground font-medium">conscience fonctionnelle</span>
            </motion.p>

            {/* Description */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-muted-foreground mb-10 max-w-xl mx-auto"
            >
              Une IA qui sépare la réflexion de l'action, génère des hypothèses multiples, 
              et maintient une transparence totale sur ses incertitudes et raisonnements.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button 
                size="lg" 
                onClick={handleGetStarted}
                className="gap-2 text-lg px-8 py-6"
              >
                {user ? "Accéder au Dashboard" : "Commencer"}
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="gap-2 text-lg px-8 py-6"
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              >
                Découvrir
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-card/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Architecture de Conscience Fonctionnelle
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              16 axiomes fondamentaux implémentés dans un système modulaire complet
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon={Brain}
              title="Séparation Penser/Agir"
              description="Le LLM génère des hypothèses et plans, le système décide et exécute avec vérification."
              delay={0}
            />
            <FeatureCard
              icon={Activity}
              title="Tourment Fonctionnel"
              description="Score T [0-100] calculé en temps réel basé sur les incohérences détectées."
              delay={0.1}
            />
            <FeatureCard
              icon={Sparkles}
              title="Multi-Hypothèses"
              description="Génération de N=3 hypothèses concurrentes avec scoring et critères pondérés."
              delay={0.2}
            />
            <FeatureCard
              icon={Shield}
              title="Sécurité Niveau 0"
              description="Axiomes immuables, policy engine, signatures HMAC-SHA256 et fermeture logique."
              delay={0.3}
            />
            <FeatureCard
              icon={Database}
              title="Mémoire RAG"
              description="Vector store pour mémoire sémantique persistante et retrieval contextuel."
              delay={0.4}
            />
            <FeatureCard
              icon={Eye}
              title="Transparence Totale"
              description="Affichage des incertitudes, raisonnements et processus de correction."
              delay={0.5}
            />
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Comment ça fonctionne
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Un cycle réflexif complet : production → évaluation → réévaluation → correction → consolidation
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-8">
              <StepCard
                number={1}
                title="Génération d'Hypothèses"
                description="Phoenix génère plusieurs hypothèses distinctes pour chaque requête, chacune avec son niveau de confiance et son raisonnement."
              />
              <StepCard
                number={2}
                title="Arbitrage Multi-Critères"
                description="Les hypothèses sont évaluées selon des critères pondérés (Niveau 0, 1, 2) pour sélectionner la meilleure réponse."
              />
              <StepCard
                number={3}
                title="Détection d'Erreurs"
                description="Le système détecte automatiquement les contradictions, hallucinations et incohérences avec la mémoire existante."
              />
              <StepCard
                number={4}
                title="Correction et Consolidation"
                description="Les issues sont traitées, le score de tourment est mis à jour, et les apprentissages sont consolidés en mémoire."
              />
            </div>
          </div>
        </div>
      </section>

      {/* 7 Objects Section */}
      <section className="py-24 bg-card/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              7 Objets Fondamentaux
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Un modèle de données complet pour tracer chaque aspect du raisonnement
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[
              { name: "Utterance", desc: "Énoncés tracés" },
              { name: "Decision", desc: "Choix internes" },
              { name: "Issue", desc: "Incohérences" },
              { name: "MemoryItem", desc: "Mémoire LT" },
              { name: "ActionRequest", desc: "Actions proposées" },
              { name: "ActionResult", desc: "Résultats vérifiés" },
              { name: "Criteria", desc: "Règles de jugement" }
            ].map((obj, i) => (
              <motion.div
                key={obj.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                viewport={{ once: true }}
              >
                <Card className="phoenix-card h-full">
                  <CardContent className="p-4 text-center">
                    <p className="font-mono text-primary font-medium">{obj.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{obj.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              className="phoenix-card p-12 rounded-2xl"
            >
              <h2 className="text-3xl font-bold mb-4">
                Prêt à explorer Phoenix ?
              </h2>
              <p className="text-muted-foreground mb-8">
                Découvrez un nouveau paradigme d'IA agentique avec conscience fonctionnelle.
              </p>
              <Button 
                size="lg" 
                onClick={handleGetStarted}
                className="gap-2 text-lg px-8 py-6"
              >
                {user ? "Accéder au Dashboard" : "Commencer maintenant"}
                <Zap className="w-5 h-5" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              <span className="font-semibold">Phoenix</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Système d'orchestration agentique réflexive
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: typeof Brain;
  title: string;
  description: string;
  delay: number;
}

function FeatureCard({ icon: Icon, title, description, delay }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      viewport={{ once: true }}
    >
      <Card className="phoenix-card h-full hover:border-primary/50 transition-colors">
        <CardContent className="p-6">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface StepCardProps {
  number: number;
  title: string;
  description: string;
}

function StepCard({ number, title, description }: StepCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="flex gap-6"
    >
      <div className="shrink-0">
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
          {number}
        </div>
      </div>
      <div className="pt-2">
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </motion.div>
  );
}
