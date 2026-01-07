import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { motion } from "framer-motion";
import { 
  Brain, 
  ArrowRight,
  CheckCircle,
  Zap,
  Code2,
  LineChart,
  Globe,
  Search,
  Image,
  MessageSquare,
  Cpu,
  Shield,
  Clock,
  Users,
  Star,
  Play,
  ChevronRight
} from "lucide-react";
import { Link } from "wouter";

export default function Landing() {
  const handleGetStarted = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">Phoenix AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition">Fonctionnalités</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition">Tarifs</a>
            <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition">Témoignages</a>
            <Link href="/about" className="text-muted-foreground hover:text-foreground transition">À propos</Link>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={handleGetStarted}>Connexion</Button>
            <Button onClick={handleGetStarted} className="gap-2">
              Essai Gratuit <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-background to-blue-500/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-full blur-3xl" />
        
        <div className="container relative">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-sm font-medium mb-8"
            >
              <Zap className="w-4 h-4" />
              L'IA qui exécute vraiment votre code
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
            >
              Votre Assistant IA{" "}
              <span className="bg-gradient-to-r from-green-500 via-emerald-400 to-blue-500 bg-clip-text text-transparent">
                Autonome
              </span>
              <br />
              Qui Passe à l'Action
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              Phoenix AI ne se contente pas de répondre. Il <strong>exécute du code</strong>, 
              <strong> crée des sites web</strong>, <strong>analyse les cryptos</strong> en temps réel, 
              et <strong>navigue le web</strong> pour vous.
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
            >
              <Button size="lg" onClick={handleGetStarted} className="gap-2 text-lg px-8 py-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
                Commencer Gratuitement <ArrowRight className="w-5 h-5" />
              </Button>
              <Button size="lg" variant="outline" className="gap-2 text-lg px-8 py-6">
                <Play className="w-5 h-5" /> Voir la Démo
              </Button>
            </motion.div>

            {/* Social Proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-8 text-sm text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Pas de carte bancaire requise
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                10 messages gratuits/jour
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Annulation à tout moment
              </div>
            </motion.div>
          </div>

          {/* Hero Image/Demo */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-16 max-w-5xl mx-auto"
          >
            <div className="relative rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent z-10" />
              <div className="p-4 border-b border-border flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-4 text-sm text-muted-foreground">Phoenix AI - Dashboard</span>
              </div>
              <div className="p-8 space-y-4">
                {/* Fake chat messages */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm">U</div>
                  <div className="bg-muted rounded-lg p-3 max-w-md">
                    <p className="text-sm">Crée-moi un site web pour mon portfolio avec une section projets</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 max-w-lg">
                    <p className="text-sm mb-2">✅ Site créé avec succès !</p>
                    <p className="text-sm text-muted-foreground">URL publique : <span className="text-green-500">https://8080-xyz.e2b.app</span></p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-card/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Tout ce que ChatGPT ne fait pas,{" "}
              <span className="text-green-500">Phoenix le fait</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Une IA qui passe à l'action au lieu de juste parler
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <FeatureCard
              icon={Code2}
              title="Exécution de Code Réelle"
              description="Python, JavaScript exécutés dans un sandbox sécurisé. Pas de simulation, du vrai code qui tourne."
              highlight
            />
            <FeatureCard
              icon={Globe}
              title="Création de Sites Web"
              description="Demandez un site, obtenez une URL publique en 30 secondes. HTML, React, tout est possible."
              highlight
            />
            <FeatureCard
              icon={LineChart}
              title="Expert Crypto"
              description="Analyse technique en temps réel, RSI, MACD, Bollinger. Données CoinGecko actualisées."
              highlight
            />
            <FeatureCard
              icon={Search}
              title="Recherche Web"
              description="Accès à Internet en temps réel via Serper API. Informations toujours à jour."
            />
            <FeatureCard
              icon={Image}
              title="Génération d'Images"
              description="Créez des images avec l'IA directement depuis le chat."
            />
            <FeatureCard
              icon={Cpu}
              title="Agent Autonome"
              description="Phoenix peut naviguer le web, exécuter des tâches complexes en plusieurs étapes."
            />
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Pourquoi choisir Phoenix AI ?
            </h2>
            <p className="text-xl text-muted-foreground">
              Comparez avec les autres solutions
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-4">Fonctionnalité</th>
                    <th className="text-center py-4 px-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-2">
                          <Brain className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-green-500">Phoenix AI</span>
                      </div>
                    </th>
                    <th className="text-center py-4 px-4 text-muted-foreground">ChatGPT</th>
                    <th className="text-center py-4 px-4 text-muted-foreground">Claude</th>
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow feature="Exécution de code réelle" phoenix={true} chatgpt={false} claude={false} />
                  <ComparisonRow feature="Création de sites web" phoenix={true} chatgpt={false} claude={false} />
                  <ComparisonRow feature="URLs publiques" phoenix={true} chatgpt={false} claude={false} />
                  <ComparisonRow feature="Analyse crypto temps réel" phoenix={true} chatgpt={false} claude={false} />
                  <ComparisonRow feature="Agent autonome" phoenix={true} chatgpt="Limité" claude={false} />
                  <ComparisonRow feature="Recherche web" phoenix={true} chatgpt={true} claude={true} />
                  <ComparisonRow feature="Génération d'images" phoenix={true} chatgpt={true} claude={false} />
                  <ComparisonRow feature="Prix de départ" phoenix="9€/mois" chatgpt="20€/mois" claude="20€/mois" />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-card/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Des tarifs simples et transparents
            </h2>
            <p className="text-xl text-muted-foreground">
              Commencez gratuitement, évoluez selon vos besoins
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <PricingCard
              name="Gratuit"
              price="0€"
              period="pour toujours"
              description="Parfait pour découvrir Phoenix AI"
              features={[
                "10 messages/jour",
                "Chat intelligent",
                "Recherche web basique",
                "Historique 7 jours"
              ]}
              buttonText="Commencer"
              buttonVariant="outline"
            />
            <PricingCard
              name="Starter"
              price="9€"
              period="/mois"
              description="Pour les utilisateurs réguliers"
              features={[
                "100 messages/jour",
                "10 exécutions de code/jour",
                "Création de sites web",
                "Recherche web illimitée",
                "Historique illimité",
                "Support email"
              ]}
              buttonText="Essai Gratuit 7 jours"
              popular
            />
            <PricingCard
              name="Pro"
              price="29€"
              period="/mois"
              description="Pour les professionnels"
              features={[
                "Messages illimités",
                "Exécutions illimitées",
                "Expert Crypto avancé",
                "Agent autonome",
                "Génération d'images",
                "MCP Bridge (contrôle PC)",
                "Support prioritaire"
              ]}
              buttonText="Essai Gratuit 7 jours"
            />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Ce que disent nos utilisateurs
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <TestimonialCard
              quote="Phoenix AI m'a fait gagner des heures sur mes analyses crypto. Les indicateurs techniques en temps réel sont incroyables."
              author="Marc D."
              role="Trader Crypto"
              rating={5}
            />
            <TestimonialCard
              quote="Enfin une IA qui exécute vraiment le code ! Plus besoin de copier-coller dans un terminal."
              author="Sophie L."
              role="Développeuse Freelance"
              rating={5}
            />
            <TestimonialCard
              quote="J'ai créé mon portfolio en 5 minutes avec une URL publique. Impressionnant."
              author="Thomas R."
              role="Étudiant"
              rating={5}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-blue-500/10">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Prêt à passer à l'action ?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Rejoignez les utilisateurs qui ont choisi une IA qui fait plus que parler.
            </p>
            <Button size="lg" onClick={handleGetStarted} className="gap-2 text-lg px-8 py-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
              Commencer Gratuitement <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl">Phoenix AI</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Propriété Adaga Veysel Artur
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition">Tarifs</a></li>
                <li><Link href="/about" className="hover:text-foreground transition">À propos</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Légal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/terms" className="hover:text-foreground transition">Conditions d'utilisation</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground transition">Politique de confidentialité</Link></li>
                <li><Link href="/legal" className="hover:text-foreground transition">Mentions légales</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>contact@phoenix-ai.com</li>
                <li>
                  <a href="https://twitter.com/phoenixai" className="hover:text-foreground transition">Twitter/X</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © 2025 Phoenix AI - Tous droits réservés
          </div>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon: Icon, title, description, highlight = false }: { 
  icon: any; 
  title: string; 
  description: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`relative overflow-hidden ${highlight ? 'border-green-500/50 bg-green-500/5' : ''}`}>
      {highlight && (
        <div className="absolute top-0 right-0 px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-bl">
          Unique
        </div>
      )}
      <CardContent className="p-6">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${highlight ? 'bg-green-500/20' : 'bg-primary/10'}`}>
          <Icon className={`w-6 h-6 ${highlight ? 'text-green-500' : 'text-primary'}`} />
        </div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

// Comparison Row Component
function ComparisonRow({ feature, phoenix, chatgpt, claude }: {
  feature: string;
  phoenix: boolean | string;
  chatgpt: boolean | string;
  claude: boolean | string;
}) {
  const renderValue = (value: boolean | string) => {
    if (typeof value === 'string') return <span className="text-sm">{value}</span>;
    return value ? (
      <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  };

  return (
    <tr className="border-b border-border">
      <td className="py-4 px-4">{feature}</td>
      <td className="text-center py-4 px-4">{renderValue(phoenix)}</td>
      <td className="text-center py-4 px-4">{renderValue(chatgpt)}</td>
      <td className="text-center py-4 px-4">{renderValue(claude)}</td>
    </tr>
  );
}

// Pricing Card Component
function PricingCard({ name, price, period, description, features, buttonText, buttonVariant = "default", popular = false }: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  buttonText: string;
  buttonVariant?: "default" | "outline";
  popular?: boolean;
}) {
  return (
    <Card className={`relative ${popular ? 'border-green-500 shadow-lg shadow-green-500/20' : ''}`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-white text-sm font-medium rounded-full">
          Plus populaire
        </div>
      )}
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-2">{name}</h3>
        <div className="mb-4">
          <span className="text-4xl font-bold">{price}</span>
          <span className="text-muted-foreground">{period}</span>
        </div>
        <p className="text-muted-foreground mb-6">{description}</p>
        <ul className="space-y-3 mb-6">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
        <Button 
          className={`w-full ${popular ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' : ''}`}
          variant={buttonVariant as any}
          onClick={() => window.location.href = getLoginUrl()}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
}

// Testimonial Card Component
function TestimonialCard({ quote, author, role, rating }: {
  quote: string;
  author: string;
  role: string;
  rating: number;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex gap-1 mb-4">
          {[...Array(rating)].map((_, i) => (
            <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
          ))}
        </div>
        <p className="text-muted-foreground mb-4">"{quote}"</p>
        <div>
          <p className="font-semibold">{author}</p>
          <p className="text-sm text-muted-foreground">{role}</p>
        </div>
      </CardContent>
    </Card>
  );
}
