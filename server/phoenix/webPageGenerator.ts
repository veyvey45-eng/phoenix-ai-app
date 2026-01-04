/**
 * Web Page Generator - Génération de pages HTML/CSS/React
 * 
 * Transforme des descriptions en pages web complètes avec:
 * - HTML structuré
 * - Tailwind CSS
 * - Composants React réutilisables
 * - Responsive design
 */

import { invokeLLM } from '../_core/llm';

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

export interface ComponentDefinition {
  name: string;
  props: Record<string, string>;
  jsx: string;
  tailwindClasses: string[];
}

/**
 * Génère une page web complète à partir d'une description
 */
export async function generateWebPage(request: PageGenerationRequest): Promise<GeneratedPage> {
  try {
    console.log('[WebPageGenerator] Generating page:', request.pageType);

    // Générer le JSX React
    const tsx = await generateReactComponent(request);
    if (!tsx) {
      throw new Error('Failed to generate React component');
    }

    // Générer le HTML statique
    const html = await generateHTML(request);
    if (!html) {
      throw new Error('Failed to generate HTML');
    }

    // Générer les styles Tailwind
    const css = await generateTailwindCSS(request);

    // Extraire les métadonnées
    const metadata = extractMetadata(request, tsx);

    return {
      html,
      tsx,
      css,
      metadata
    };
  } catch (error) {
    console.error('[WebPageGenerator] Error:', error);
    throw error;
  }
}

/**
 * Génère un composant React TSX
 */
async function generateReactComponent(request: PageGenerationRequest): Promise<string> {
  try {
    const systemPrompt = `Tu es un expert en React et Tailwind CSS. 
Tu génères des composants React modernes, accessibles et responsifs.

RÈGLES STRICTES:
1. Génère du code TSX VALIDE et COMPLET
2. Utilise Tailwind CSS pour tous les styles
3. Inclus les imports nécessaires
4. Ajoute les props TypeScript
5. Assure la responsivité mobile
6. Utilise des composants shadcn/ui si approprié
7. Retourne UNIQUEMENT le code TSX entre balises \`\`\`tsx\`\`\`
8. PAS d'explications en dehors du code`;

    const userPrompt = `Génère un composant React TSX pour une page ${request.pageType}:

Description: ${request.description}

Type de page: ${request.pageType}
Thème: ${request.colorScheme || 'auto'}
${request.components ? `Composants à inclure: ${request.components.join(', ')}` : ''}
${request.sections ? `Sections: ${request.sections.join(', ')}` : ''}

Génère un composant React complet et fonctionnel.
Retourne UNIQUEMENT le code TSX entre balises \`\`\`tsx\`\`\`.`;

    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    let content = typeof response.choices?.[0]?.message?.content === 'string' 
      ? response.choices[0].message.content 
      : '';

    // Extraire le code TSX
    const match = content.match(/```tsx\n([\s\S]*?)\n```/);
    if (match) {
      return match[1].trim();
    }

    // Fallback: si le contenu ressemble à du TSX
    if (content.includes('export default') || content.includes('function')) {
      return content.trim();
    }

    return null as any;
  } catch (error) {
    console.error('[WebPageGenerator] React generation error:', error);
    throw error;
  }
}

/**
 * Génère du HTML statique
 */
async function generateHTML(request: PageGenerationRequest): Promise<string> {
  try {
    const systemPrompt = `Tu es un expert en HTML et CSS.
Tu génères du HTML5 sémantique avec Tailwind CSS.

RÈGLES:
1. HTML5 valide et sémantique
2. Tailwind CSS pour les styles
3. Responsive design
4. Accessible (ARIA labels, semantic HTML)
5. Retourne UNIQUEMENT le HTML entre balises \`\`\`html\`\`\``;

    const userPrompt = `Génère du HTML5 pour une page ${request.pageType}:

${request.description}

Retourne UNIQUEMENT le HTML complet entre balises \`\`\`html\`\`\`.`;

    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    let content = typeof response.choices?.[0]?.message?.content === 'string' 
      ? response.choices[0].message.content 
      : '';

    const match = content.match(/```html\n([\s\S]*?)\n```/);
    if (match) {
      return match[1].trim();
    }

    if (content.includes('<!DOCTYPE') || content.includes('<html')) {
      return content.trim();
    }

    return null as any;
  } catch (error) {
    console.error('[WebPageGenerator] HTML generation error:', error);
    throw error;
  }
}

/**
 * Génère les styles Tailwind CSS
 */
async function generateTailwindCSS(request: PageGenerationRequest): Promise<string> {
  try {
    const systemPrompt = `Tu es un expert en Tailwind CSS.
Tu génères des configurations Tailwind CSS personnalisées.

RÈGLES:
1. Configuration Tailwind valide
2. Couleurs cohérentes
3. Espacements harmonieux
4. Animations fluides
5. Support dark mode
6. Retourne UNIQUEMENT la config entre balises \`\`\`css\`\`\``;

    const userPrompt = `Génère une configuration Tailwind CSS pour:
${request.description}

Thème: ${request.colorScheme || 'auto'}

Retourne UNIQUEMENT le CSS entre balises \`\`\`css\`\`\`.`;

    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    let content = typeof response.choices?.[0]?.message?.content === 'string' 
      ? response.choices[0].message.content 
      : '';

    const match = content.match(/```css\n([\s\S]*?)\n```/);
    if (match) {
      return match[1].trim();
    }

    return content.trim();
  } catch (error) {
    console.error('[WebPageGenerator] CSS generation error:', error);
    return '';
  }
}

/**
 * Extrait les métadonnées de la page générée
 */
function extractMetadata(request: PageGenerationRequest, tsx: string): GeneratedPage['metadata'] {
  const components = extractComponentNames(tsx);
  const sections = extractSectionNames(tsx);

  return {
    title: extractTitle(request.description),
    description: request.description,
    components,
    sections,
    responsive: tsx.includes('md:') || tsx.includes('lg:') || tsx.includes('sm:')
  };
}

/**
 * Extrait les noms des composants utilisés
 */
function extractComponentNames(tsx: string): string[] {
  const componentPattern = /<([A-Z][a-zA-Z0-9]*)/g;
  const matches = tsx.match(componentPattern) || [];
  const components = matches.map(m => m.slice(1));
  const unique: string[] = [];
  const seen = new Set<string>();
  components.forEach(c => {
    if (!seen.has(c)) {
      unique.push(c);
      seen.add(c);
    }
  });
  return unique;
}

/**
 * Extrait les sections de la page
 */
function extractSectionNames(tsx: string): string[] {
  const sectionPattern = /<section[^>]*className="[^"]*"[^>]*>/g;
  const matches = tsx.match(sectionPattern) || [];
  return matches.map((_, i) => `section-${i + 1}`);
}

/**
 * Extrait le titre de la description
 */
function extractTitle(description: string): string {
  const words = description.split(' ').slice(0, 5).join(' ');
  return words.length > 0 ? words : 'Generated Page';
}

/**
 * Génère une bibliothèque de composants réutilisables
 */
export async function generateComponentLibrary(components: string[]): Promise<Record<string, ComponentDefinition>> {
  try {
    console.log('[WebPageGenerator] Generating component library:', components.length, 'components');

    const library: Record<string, ComponentDefinition> = {};

    for (const componentName of components) {
      const definition = await generateComponentDefinition(componentName);
      if (definition) {
        library[componentName] = definition;
      }
    }

    return library;
  } catch (error) {
    console.error('[WebPageGenerator] Component library error:', error);
    return {};
  }
}

/**
 * Génère la définition d'un composant
 */
async function generateComponentDefinition(componentName: string): Promise<ComponentDefinition | null> {
  try {
    const systemPrompt = `Tu es un expert en React et Tailwind CSS.
Tu génères des définitions de composants réutilisables.

RÈGLES:
1. Composant React fonctionnel
2. Props TypeScript
3. Tailwind CSS
4. Accessible
5. Retourne UNIQUEMENT le JSX entre balises \`\`\`jsx\`\`\``;

    const userPrompt = `Génère un composant React réutilisable appelé "${componentName}".

Retourne UNIQUEMENT le JSX entre balises \`\`\`jsx\`\`\`.`;

    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    let content = typeof response.choices?.[0]?.message?.content === 'string' 
      ? response.choices[0].message.content 
      : '';

    const match = content.match(/```jsx\n([\s\S]*?)\n```/);
    const jsx = match ? match[1].trim() : content.trim();

    return {
      name: componentName,
      props: {},
      jsx,
      tailwindClasses: extractTailwindClasses(jsx)
    };
  } catch (error) {
    console.error('[WebPageGenerator] Component definition error:', error);
    return null;
  }
}

/**
 * Extrait les classes Tailwind utilisées
 */
function extractTailwindClasses(jsx: string): string[] {
  const classPattern = /className="([^"]*)"/g;
  const classes: string[] = [];
  const seen = new Set<string>();
  let match;

  while ((match = classPattern.exec(jsx)) !== null) {
    const classList = match[1].split(' ');
    classList.forEach(cls => {
      if (!seen.has(cls)) {
        classes.push(cls);
        seen.add(cls);
      }
    });
  }

  return classes;
}

/**
 * Singleton global
 */
let instance: typeof WebPageGeneratorModule;

export const WebPageGeneratorModule = {
  generateWebPage,
  generateComponentLibrary,
  generateComponentDefinition
};

export function getWebPageGenerator() {
  if (!instance) {
    instance = WebPageGeneratorModule;
  }
  return instance;
}
