/**
 * Web Generator - Génération de Pages Web pour Phoenix
 * 
 * Ce module permet à Phoenix de générer des pages HTML/CSS/React,
 * similaire à la capacité de Manus à créer des sites web.
 */

import { invokeLLM } from '../_core/llm';
import { storagePut } from '../storage';

// Types
export interface WebPage {
  html: string;
  css: string;
  javascript?: string;
  title: string;
  description?: string;
}

export interface ReactComponent {
  name: string;
  code: string;
  props?: Record<string, string>;
  imports?: string[];
}

export interface WebGenerationResult {
  success: boolean;
  type: 'html' | 'react' | 'landing' | 'dashboard';
  content: WebPage | ReactComponent;
  previewUrl?: string;
  error?: string;
}

// Templates de base
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}}</title>
  <style>
{{CSS}}
  </style>
</head>
<body>
{{BODY}}
{{SCRIPT}}
</body>
</html>`;

const CSS_RESET = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  line-height: 1.6;
  color: #333;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}`;

const REACT_COMPONENT_TEMPLATE = `import React from 'react';

interface {{NAME}}Props {
{{PROPS}}
}

export const {{NAME}}: React.FC<{{NAME}}Props> = (props) => {
  return (
{{JSX}}
  );
};

export default {{NAME}};`;

// Templates de pages prédéfinis
const PAGE_TEMPLATES = {
  landing: {
    sections: ['hero', 'features', 'testimonials', 'cta', 'footer'],
    style: 'modern'
  },
  dashboard: {
    sections: ['sidebar', 'header', 'stats', 'charts', 'table'],
    style: 'professional'
  },
  portfolio: {
    sections: ['hero', 'about', 'projects', 'skills', 'contact'],
    style: 'creative'
  },
  blog: {
    sections: ['header', 'featured', 'articles', 'sidebar', 'footer'],
    style: 'minimal'
  }
};

/**
 * Service de génération web
 */
class WebGeneratorService {
  
  /**
   * Génère une page HTML complète
   */
  async generateHTML(
    description: string,
    options: {
      style?: 'modern' | 'minimal' | 'creative' | 'professional';
      includeJS?: boolean;
      responsive?: boolean;
    } = {}
  ): Promise<WebGenerationResult> {
    const { style = 'modern', includeJS = false, responsive = true } = options;

    const systemPrompt = `Tu es un expert en développement web frontend.
Tu dois générer une page HTML/CSS complète basée sur la description.

RÈGLES:
1. Utilise du HTML5 sémantique
2. CSS moderne avec Flexbox/Grid
3. Design ${style} et ${responsive ? 'responsive' : 'fixe'}
4. Couleurs harmonieuses et typographie lisible
5. Pas de frameworks externes (CSS pur)

RETOURNE UN JSON avec cette structure exacte:
{
  "title": "Titre de la page",
  "html": "<!-- HTML du body uniquement -->",
  "css": "/* CSS complet */",
  "javascript": "// JS optionnel"
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Génère une page web: ${description}` }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'web_page',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                html: { type: 'string' },
                css: { type: 'string' },
                javascript: { type: 'string' }
              },
              required: ['title', 'html', 'css'],
              additionalProperties: false
            }
          }
        }
      });

      const rawContent = response.choices[0]?.message?.content || '{}';
      const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
      const pageData = JSON.parse(content);

      // Assembler la page complète
      const fullCSS = CSS_RESET + '\n\n' + pageData.css;
      const scriptTag = includeJS && pageData.javascript 
        ? `<script>\n${pageData.javascript}\n</script>` 
        : '';

      const fullHTML = HTML_TEMPLATE
        .replace('{{TITLE}}', pageData.title)
        .replace('{{CSS}}', fullCSS)
        .replace('{{BODY}}', pageData.html)
        .replace('{{SCRIPT}}', scriptTag);

      return {
        success: true,
        type: 'html',
        content: {
          html: fullHTML,
          css: fullCSS,
          javascript: pageData.javascript,
          title: pageData.title
        }
      };
    } catch (error: any) {
      console.error('[WebGenerator] Erreur génération HTML:', error);
      return {
        success: false,
        type: 'html',
        content: { html: '', css: '', title: '' },
        error: error.message
      };
    }
  }

  /**
   * Génère un composant React
   */
  async generateReactComponent(
    description: string,
    componentName: string,
    options: {
      withTailwind?: boolean;
      withTypeScript?: boolean;
      withProps?: string[];
    } = {}
  ): Promise<WebGenerationResult> {
    const { withTailwind = true, withTypeScript = true, withProps = [] } = options;

    const systemPrompt = `Tu es un expert React/TypeScript.
Tu dois générer un composant React basé sur la description.

RÈGLES:
1. ${withTypeScript ? 'TypeScript avec types stricts' : 'JavaScript'}
2. ${withTailwind ? 'Tailwind CSS pour le styling' : 'CSS-in-JS ou classes CSS'}
3. Composant fonctionnel avec hooks si nécessaire
4. Code propre et bien commenté
5. Props typées si TypeScript

RETOURNE UN JSON avec cette structure exacte:
{
  "name": "${componentName}",
  "code": "// Code complet du composant",
  "imports": ["react", "autres imports"],
  "props": {"prop1": "type1"}
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Génère un composant React "${componentName}": ${description}` }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'react_component',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                code: { type: 'string' },
                imports: { type: 'array', items: { type: 'string' } },
                props: { type: 'object', additionalProperties: { type: 'string' } }
              },
              required: ['name', 'code'],
              additionalProperties: false
            }
          }
        }
      });

      const rawContent = response.choices[0]?.message?.content || '{}';
      const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
      const componentData = JSON.parse(content);

      return {
        success: true,
        type: 'react',
        content: {
          name: componentData.name,
          code: componentData.code,
          imports: componentData.imports || [],
          props: componentData.props || {}
        }
      };
    } catch (error: any) {
      console.error('[WebGenerator] Erreur génération React:', error);
      return {
        success: false,
        type: 'react',
        content: { name: componentName, code: '' },
        error: error.message
      };
    }
  }

  /**
   * Génère une landing page complète
   */
  async generateLandingPage(
    businessDescription: string,
    options: {
      colorScheme?: string;
      sections?: string[];
      ctaText?: string;
    } = {}
  ): Promise<WebGenerationResult> {
    const { 
      colorScheme = 'blue', 
      sections = PAGE_TEMPLATES.landing.sections,
      ctaText = 'Commencer maintenant'
    } = options;

    const systemPrompt = `Tu es un expert en design de landing pages.
Tu dois créer une landing page professionnelle et convertissante.

BUSINESS: ${businessDescription}
COULEUR PRINCIPALE: ${colorScheme}
SECTIONS: ${sections.join(', ')}
CTA: ${ctaText}

RÈGLES:
1. Design moderne et professionnel
2. Hero section impactante avec CTA clair
3. Sections bien structurées
4. Responsive design
5. Animations CSS subtiles
6. Typographie lisible

RETOURNE UN JSON avec cette structure exacte:
{
  "title": "Titre de la page",
  "html": "<!-- HTML complet du body -->",
  "css": "/* CSS complet avec animations */",
  "javascript": "// JS pour interactions"
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Crée une landing page pour: ${businessDescription}` }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'landing_page',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                html: { type: 'string' },
                css: { type: 'string' },
                javascript: { type: 'string' }
              },
              required: ['title', 'html', 'css'],
              additionalProperties: false
            }
          }
        }
      });

      const rawContent = response.choices[0]?.message?.content || '{}';
      const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
      const pageData = JSON.parse(content);

      const fullCSS = CSS_RESET + '\n\n' + pageData.css;
      const scriptTag = pageData.javascript 
        ? `<script>\n${pageData.javascript}\n</script>` 
        : '';

      const fullHTML = HTML_TEMPLATE
        .replace('{{TITLE}}', pageData.title)
        .replace('{{CSS}}', fullCSS)
        .replace('{{BODY}}', pageData.html)
        .replace('{{SCRIPT}}', scriptTag);

      return {
        success: true,
        type: 'landing',
        content: {
          html: fullHTML,
          css: fullCSS,
          javascript: pageData.javascript,
          title: pageData.title,
          description: businessDescription
        }
      };
    } catch (error: any) {
      console.error('[WebGenerator] Erreur génération landing:', error);
      return {
        success: false,
        type: 'landing',
        content: { html: '', css: '', title: '' },
        error: error.message
      };
    }
  }

  /**
   * Sauvegarde une page générée et retourne l'URL de prévisualisation
   */
  async saveAndPreview(
    page: WebPage,
    userId: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const timestamp = Date.now();
      const filename = `generated-page-${timestamp}.html`;
      const fileKey = `${userId}/web-pages/${filename}`;

      const { url } = await storagePut(
        fileKey,
        Buffer.from(page.html, 'utf-8'),
        'text/html'
      );

      return { success: true, url };
    } catch (error: any) {
      console.error('[WebGenerator] Erreur sauvegarde:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Génère du CSS Tailwind à partir d'une description
   */
  async generateTailwindClasses(description: string): Promise<string> {
    const systemPrompt = `Tu es un expert Tailwind CSS.
Génère les classes Tailwind pour: ${description}
Retourne UNIQUEMENT les classes, séparées par des espaces.
Exemple: "flex items-center justify-between p-4 bg-white shadow-md"`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: description }
        ]
      });

      const rawContent = response.choices[0]?.message?.content || '';
      return typeof rawContent === 'string' ? rawContent.trim() : '';
    } catch (error) {
      console.error('[WebGenerator] Erreur Tailwind:', error);
      return '';
    }
  }
}

// Export singleton
export const webGenerator = new WebGeneratorService();
