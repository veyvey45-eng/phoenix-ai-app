/**
 * About Page - Présentation de Phoenix AI
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  Code2, 
  Globe, 
  Zap, 
  Shield, 
  Sparkles,
  MessageSquare,
  FileSearch,
  Cpu,
  Database,
  ArrowRight,
  TrendingUp,
  LineChart,
  Target,
  BarChart3,
  CheckCircle,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { getLoginUrl } from '@/const';

const features = [
  {
    icon: MessageSquare,
    title: "Conversation Intelligente",
    description: "Dialoguez naturellement avec Phoenix. Il comprend le contexte et répond de manière pertinente."
  },
  {
    icon: Code2,
    title: "Exécution de Code",
    description: "Exécutez du code Python et JavaScript en temps réel dans un environnement sécurisé."
  },
  {
    icon: Globe,
    title: "Recherche Web",
    description: "Accédez aux informations en temps réel grâce à la recherche web intégrée."
  },
  {
    icon: Sparkles,
    title: "Génération Web",
    description: "Créez des pages web complètes à partir d'une simple description textuelle."
  },
  {
    icon: FileSearch,
    title: "Analyse de Documents",
    description: "Uploadez et analysez des PDFs pour en extraire les informations clés."
  },
  {
    icon: Shield,
    title: "Sécurité Intégrée",
    description: "Exécution sandboxée et validation des entrées pour une utilisation sécurisée."
  }
];

const cryptoFeatures = [
  {
    icon: TrendingUp,
    title: "Analyse Technique Avancée",
    description: "RSI, MACD, Bollinger Bands, Fibonacci, Support/Résistance calculés en temps réel.",
    color: "text-green-500",
    bgColor: "bg-green-500/10"
  },
  {
    icon: Code2,
    title: "Exécution de Code en Direct",
    description: "Python et JavaScript dans une sandbox sécurisée pour vos scripts d'analyse.",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  {
    icon: LineChart,
    title: "Fear & Greed Index",
    description: "Sentiment du marché en temps réel pour identifier les opportunités.",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10"
  },
  {
    icon: Target,
    title: "Stratégies de Trading",
    description: "DCA Calculator, Grid Trading, Swing Trading, Position Sizing.",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10"
  },
  {
    icon: BarChart3,
    title: "Données Marché Complètes",
    description: "Prix, volumes, market cap, historiques via CoinGecko API.",
    color: "text-red-500",
    bgColor: "bg-red-500/10"
  },
  {
    icon: Sparkles,
    title: "Générateur de Sites Web",
    description: "Créez des landing pages et applications directement depuis le chat.",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10"
  }
];

const stats = [
  { value: "16", label: "Axiomes Fondamentaux" },
  { value: "7", label: "Objets de Conscience" },
  { value: "∞", label: "Possibilités" }
];

const benefits = [
  "Exécution de code réelle (pas de simulation)",
  "Données crypto en temps réel (janvier 2026)",
  "Indicateurs techniques calculés automatiquement",
  "IA proactive qui prend l'initiative",
  "16 axiomes de conscience fonctionnelle",
  "Génération de sites web intégrée",
  "Interface francophone native",
  "Support et évolutions continues"
];

export default function About() {
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-2">
              <span className="gradient-text">Phoenix AI</span>
            </h1>
            
            <p className="text-sm text-muted-foreground mb-6">
              Propriété Adaga Veysel Artur
            </p>
            
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              L'assistant IA qui exécute vraiment. Analyse crypto en temps réel, 
              exécution de code et génération de contenu dans une seule interface.
            </p>

            <Button 
              size="lg" 
              onClick={handleGetStarted}
              className="gap-2"
            >
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-card/50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-bold gradient-text mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Crypto Expert Section - Marketing pour traders */}
      <section className="py-20 px-4 bg-gradient-to-b from-background to-card/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
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
                Phoenix n'est pas un simple chatbot. C'est un outil d'analyse et d'exécution de code en temps réel.
              </p>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cryptoFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full border-border/50 hover:border-primary/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg ${feature.bgColor} flex items-center justify-center shrink-0`}>
                        <feature.icon className={`w-5 h-5 ${feature.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pourquoi Phoenix - Value Proposition */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <DollarSign className="w-10 h-10 text-primary mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Pourquoi Phoenix ?</h3>
                  <p className="text-muted-foreground">
                    Ce que vous obtenez vs les alternatives
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      <span className="text-sm">{benefit}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-card/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Capacités Complètes
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Au-delà de la crypto, Phoenix est un assistant IA polyvalent.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                viewport={{ once: true }}
              >
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Section - Simplified */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2">Architecture Moderne</h2>
            <p className="text-sm text-muted-foreground">
              React 19 • TypeScript • tRPC • E2B Sandbox • MySQL
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4">
              <Cpu className="w-8 h-8 mx-auto text-primary mb-2" />
              <p className="text-sm font-medium">Frontend</p>
            </div>
            <div className="p-4">
              <Zap className="w-8 h-8 mx-auto text-primary mb-2" />
              <p className="text-sm font-medium">Backend</p>
            </div>
            <div className="p-4">
              <Database className="w-8 h-8 mx-auto text-primary mb-2" />
              <p className="text-sm font-medium">Data</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-card/50">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold mb-4">
              Prêt à commencer ?
            </h2>
            <p className="text-muted-foreground mb-8">
              Rejoignez les utilisateurs qui utilisent Phoenix pour analyser, exécuter et automatiser.
            </p>
            <Button 
              size="lg" 
              onClick={handleGetStarted}
              className="gap-2"
            >
              Lancer Phoenix <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p>Phoenix AI - Propriété Adaga Veysel Artur</p>
        </div>
      </footer>
    </div>
  );
}
