/**
 * Web Page Generator Simple - Version fonctionnelle et testée
 * 
 * Génère des pages web complètes avec templates prédéfinis
 * Pas de dépendance LLM - Utilise des templates optimisés
 */

export interface PageGenerationRequest {
  description: string;
  pageType: 'landing' | 'dashboard' | 'blog' | 'ecommerce' | 'portfolio' | 'custom';
  colorScheme?: 'light' | 'dark' | 'auto';
  components?: string[];
  sections?: string[];
}

export interface GeneratedPage {
  html: string;
  tsx: string;
  css: string;
  metadata: {
    title: string;
    description: string;
    components: string[];
    sections: string[];
    responsive: boolean;
  };
}

/**
 * Génère une page web complète
 */
export async function generateWebPageSimple(request: PageGenerationRequest): Promise<GeneratedPage> {
  console.log('[WebPageGeneratorSimple] Generating page:', request.pageType);

  const title = extractTitle(request.description);
  const description = request.description;
  const components = request.components || getDefaultComponents(request.pageType);
  const sections = request.sections || getDefaultSections(request.pageType);
  const isDark = request.colorScheme === 'dark' || (request.colorScheme === 'auto' && Math.random() > 0.5);

  // Générer le TSX
  const tsx = generateTSX(title, description, request.pageType, components, sections, isDark);

  // Générer le HTML
  const html = generateHTML(title, description, request.pageType, components, sections, isDark);

  // Générer le CSS
  const css = generateCSS(isDark);

  return {
    html,
    tsx,
    css,
    metadata: {
      title,
      description,
      components,
      sections,
      responsive: true
    }
  };
}

/**
 * Extrait le titre de la description
 */
function extractTitle(description: string): string {
  const words = description.split(' ').slice(0, 5).join(' ');
  return words.length > 0 ? words : 'Generated Page';
}

/**
 * Obtient les composants par défaut selon le type de page
 */
function getDefaultComponents(pageType: string): string[] {
  const defaults: Record<string, string[]> = {
    landing: ['Hero', 'Features', 'Pricing', 'CTA', 'Footer'],
    dashboard: ['Sidebar', 'Header', 'Cards', 'Charts', 'Tables'],
    blog: ['Header', 'ArticleList', 'Sidebar', 'Comments', 'Footer'],
    ecommerce: ['Header', 'ProductGrid', 'Filter', 'Cart', 'Checkout'],
    portfolio: ['Header', 'Projects', 'Skills', 'Contact', 'Footer'],
    custom: ['Header', 'Content', 'Footer']
  };
  return defaults[pageType] || defaults.custom;
}

/**
 * Obtient les sections par défaut selon le type de page
 */
function getDefaultSections(pageType: string): string[] {
  const defaults: Record<string, string[]> = {
    landing: ['header', 'hero', 'features', 'pricing', 'cta', 'footer'],
    dashboard: ['sidebar', 'header', 'main', 'footer'],
    blog: ['header', 'articles', 'sidebar', 'footer'],
    ecommerce: ['header', 'products', 'cart', 'checkout', 'footer'],
    portfolio: ['header', 'projects', 'about', 'contact', 'footer'],
    custom: ['header', 'main', 'footer']
  };
  return defaults[pageType] || defaults.custom;
}

/**
 * Génère un composant React TSX
 */
function generateTSX(title: string, description: string, pageType: string, components: string[], sections: string[], isDark: boolean): string {
  const bgClass = isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900';
  const accentClass = isDark ? 'from-blue-600 to-purple-600' : 'from-blue-500 to-purple-500';

  return `import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Star, Check } from 'lucide-react';

export default function ${title.replace(/\s+/g, '')}() {
  return (
    <div className="${bgClass} min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">${title}</h1>
          <nav className="hidden md:flex gap-4">
            ${sections.map((s, i) => `<a href="#${s}" className="hover:text-blue-500">${s}</a>`).join('\n            ')}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-br ${accentClass}">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">${title}</h2>
          <p className="text-lg mb-8">${description}</p>
          <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
            Get Started <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold mb-12 text-center">Key Features</h3>
          <div className="grid md:grid-cols-3 gap-8">
            ${['Feature 1', 'Feature 2', 'Feature 3'].map((f, i) => `
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Check className="h-5 w-5 text-green-500" />
                <h4 className="font-semibold">${f}</h4>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Powerful feature that helps you achieve your goals efficiently.
              </p>
            </Card>
            `).join('\n            ')}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-slate-100 dark:bg-slate-800">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-3xl font-bold mb-4">Ready to get started?</h3>
          <p className="text-lg mb-8 text-slate-600 dark:text-slate-400">
            Join thousands of users who are already using our platform.
          </p>
          <Button size="lg">Start Free Trial</Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-slate-600 dark:text-slate-400">
          <p>&copy; 2024 ${title}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}`;
}

/**
 * Génère du HTML statique
 */
function generateHTML(title: string, description: string, pageType: string, components: string[], sections: string[], isDark: boolean): string {
  const bgClass = isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900';
  const accentGradient = isDark 
    ? 'from-blue-600 to-purple-600' 
    : 'from-blue-500 to-purple-500';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .gradient-accent {
            background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%);
        }
        .dark .gradient-accent {
            background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
        }
    </style>
</head>
<body class="${bgClass}">
    <!-- Header -->
    <header class="border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}">
        <div class="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 class="text-2xl font-bold">${title}</h1>
            <nav class="hidden md:flex gap-4">
                ${sections.map((s, i) => `<a href="#${s}" class="hover:text-blue-500 transition">${s}</a>`).join('\n                ')}
            </nav>
        </div>
    </header>

    <!-- Hero Section -->
    <section class="py-20 px-4 gradient-accent text-white">
        <div class="max-w-4xl mx-auto text-center">
            <h2 class="text-4xl md:text-5xl font-bold mb-4">${title}</h2>
            <p class="text-lg mb-8">${description}</p>
            <button class="bg-white text-slate-900 px-8 py-3 rounded-lg font-semibold hover:bg-slate-100 transition">
                Get Started →
            </button>
        </div>
    </section>

    <!-- Features Section -->
    <section class="py-20 px-4">
        <div class="max-w-6xl mx-auto">
            <h3 class="text-3xl font-bold mb-12 text-center">Key Features</h3>
            <div class="grid md:grid-cols-3 gap-8">
                ${['Feature 1', 'Feature 2', 'Feature 3'].map((f, i) => `
                <div class="p-6 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}">
                    <div class="flex items-center gap-2 mb-4">
                        <svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        <h4 class="font-semibold">${f}</h4>
                    </div>
                    <p class="${isDark ? 'text-slate-400' : 'text-slate-600'}">
                        Powerful feature that helps you achieve your goals efficiently.
                    </p>
                </div>
                `).join('\n                ')}
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section class="py-20 px-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}">
        <div class="max-w-2xl mx-auto text-center">
            <h3 class="text-3xl font-bold mb-4">Ready to get started?</h3>
            <p class="text-lg mb-8 ${isDark ? 'text-slate-400' : 'text-slate-600'}">
                Join thousands of users who are already using our platform.
            </p>
            <button class="bg-blue-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-600 transition">
                Start Free Trial
            </button>
        </div>
    </section>

    <!-- Footer -->
    <footer class="border-t ${isDark ? 'border-slate-700' : 'border-slate-200'} py-8 px-4">
        <div class="max-w-6xl mx-auto text-center ${isDark ? 'text-slate-400' : 'text-slate-600'}">
            <p>&copy; 2024 ${title}. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>`;
}

/**
 * Génère les styles Tailwind CSS
 */
function generateCSS(isDark: boolean): string {
  return `/* Tailwind CSS Configuration */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom Styles */
:root {
  --primary: ${isDark ? '#3b82f6' : '#2563eb'};
  --secondary: ${isDark ? '#9333ea' : '#7c3aed'};
  --background: ${isDark ? '#0f172a' : '#ffffff'};
  --foreground: ${isDark ? '#ffffff' : '#0f172a'};
}

body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.gradient-accent {
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
}

/* Responsive Design */
@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }
}`;
}

// Singleton
let instance: any = null;

export function getWebPageGeneratorSimple() {
  if (!instance) {
    instance = {
      generateWebPage: generateWebPageSimple
    };
  }
  return instance;
}
