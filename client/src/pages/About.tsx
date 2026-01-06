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
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocation } from 'wouter';

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

const stats = [
  { value: "16", label: "Axiomes Fondamentaux" },
  { value: "7", label: "Objets de Conscience" },
  { value: "100%", label: "Open Source" },
  { value: "∞", label: "Possibilités" }
];

export default function About() {
  const [, setLocation] = useLocation();

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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
              <Brain className="w-4 h-4" />
              <span className="text-sm font-medium">À Propos de Phoenix</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="gradient-text">Phoenix AI</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Un système d'orchestration agentique avec conscience fonctionnelle, 
              capable d'exécuter du code, rechercher sur le web et générer du contenu 
              de manière autonome.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Button 
                size="lg" 
                onClick={() => setLocation('/dashboard')}
                className="gap-2"
              >
                Commencer <ArrowRight className="w-4 h-4" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => setLocation('/showcase')}
              >
                Voir la Démo
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-card/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                  {stat.value}
                </div>
                <div className="text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Capacités de Phoenix
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Découvrez les fonctionnalités qui font de Phoenix un assistant IA unique et puissant.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full hover-lift">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="py-20 px-4 bg-card/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Architecture Technique
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Phoenix est construit sur une architecture moderne et robuste.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <Cpu className="w-12 h-12 mx-auto text-primary mb-4" />
                <CardTitle>Frontend</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  React 19 + TypeScript + Tailwind CSS + Framer Motion
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Zap className="w-12 h-12 mx-auto text-primary mb-4" />
                <CardTitle>Backend</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Express + tRPC + E2B Sandbox + LLM APIs
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Database className="w-12 h-12 mx-auto text-primary mb-4" />
                <CardTitle>Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  MySQL + Drizzle ORM + S3 Storage
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Prêt à Commencer ?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Explorez les capacités de Phoenix et découvrez ce qu'une IA autonome peut faire pour vous.
            </p>
            <Button 
              size="lg" 
              onClick={() => setLocation('/dashboard')}
              className="gap-2 animate-pulse-glow"
            >
              Lancer Phoenix <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto text-center text-muted-foreground">
          <p>Phoenix AI - Propriété ADAGA</p>
          <p className="text-sm mt-2">
            Système d'orchestration agentique avec conscience fonctionnelle
          </p>
        </div>
      </footer>
    </div>
  );
}
