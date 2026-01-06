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
  Lock,
  TrendingUp,
  Code2,
  LineChart,
  Target,
  Rocket,
  DollarSign,
  BarChart3
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

            {/* Title - H1 SEO */}
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-5xl md:text-7xl font-bold mb-2"
            >
              <span className="bg-gradient-to-r from-green-500 via-emerald-400 to-blue-500 bg-clip-text text-transparent">
                Phoenix AI
              </span>
              <span className="sr-only"> - Assistant IA Autonome avec Exécution de Code</span>
            </motion.h1>
            
            {/* ADAGA Copyright */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-sm text-gray-400 mb-6"
            >
              Propriété Adaga Veysel Artur
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

      {/* Section Découvrir - Cas d'usage pour Traders Crypto */}
      <section id="use-cases" className="py-24 bg-gradient-to-b from-background to-card/50">
        <div className="container">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                Pour les Traders Crypto
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                L'Assistant IA qui Exécute Vraiment
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Phoenix n'est pas un simple chatbot. C'est un outil d'analyse et d'exécution de code en temps réel pour traders crypto exigeants.
              </p>
            </motion.div>
          </div>

          {/* Proposition de valeur principale */}
          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto mb-16">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <Card className="phoenix-card border-primary/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Analyse Technique Avancée</h3>
                      <p className="text-muted-foreground text-sm">
                        RSI, MACD, Bollinger Bands, Fibonacci, Support/Résistance calculés en temps réel sur n'importe quelle crypto via CoinGecko API.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="phoenix-card border-primary/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Code2 className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Exécution de Code en Direct</h3>
                      <p className="text-muted-foreground text-sm">
                        Python et JavaScript exécutés dans une sandbox sécurisée. Créez vos propres scripts d'analyse, backtests et automatisations.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="phoenix-card border-primary/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                      <LineChart className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Fear & Greed Index</h3>
                      <p className="text-muted-foreground text-sm">
                        Sentiment du marché en temps réel. Identifiez les moments de panique (achat) et d'euphéorie (prudence).
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <Card className="phoenix-card border-primary/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                      <Target className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Stratégies de Trading</h3>
                      <p className="text-muted-foreground text-sm">
                        DCA Calculator, Grid Trading, Swing Trading, Position Sizing. Des outils concrets pour gérer votre risque.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="phoenix-card border-primary/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                      <BarChart3 className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Données Marché Complètes</h3>
                      <p className="text-muted-foreground text-sm">
                        Prix, volumes, market cap, historiques, trending coins. Toutes les données CoinGecko accessibles en conversation.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="phoenix-card border-primary/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                      <Rocket className="w-6 h-6 text-cyan-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Générateur de Sites Web</h3>
                      <p className="text-muted-foreground text-sm">
                        Créez des landing pages, portfolios et applications web directement depuis le chat. Déployez en un clic.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Pourquoi Phoenix */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <Card className="phoenix-card bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <DollarSign className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Pourquoi Payer pour Phoenix ?</h3>
                  <p className="text-muted-foreground">
                    Ce que vous obtenez vs les alternatives gratuites
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      <span className="text-sm">Exécution de code réelle (pas de simulation)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      <span className="text-sm">Données crypto en temps réel (janvier 2026)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      <span className="text-sm">Indicateurs techniques calculés automatiquement</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      <span className="text-sm">IA proactive qui prend l'initiative</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      <span className="text-sm">16 axiomes de conscience fonctionnelle</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      <span className="text-sm">Génération de sites web intégrée</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      <span className="text-sm">Interface francophone native</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      <span className="text-sm">Support et évolutions continues</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
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
                Prêt à trader plus intelligemment ?
              </h2>
              <p className="text-muted-foreground mb-8">
                Rejoignez les traders qui utilisent Phoenix pour analyser, exécuter et automatiser.
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
