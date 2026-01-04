/**
 * Project Generator - Génération de projets multi-fichiers complets
 * 
 * Crée des projets web complets avec:
 * - Structure de dossiers
 * - Fichiers de configuration
 * - Code source structuré
 * - Package.json avec dépendances
 * - Scripts de build
 */

import { invokeLLM } from '../_core/llm';
import * as fs from 'fs';
import * as path from 'path';

export interface ProjectGenerationRequest {
  name: string;
  description: string;
  projectType: 'react-app' | 'next-app' | 'express-api' | 'full-stack' | 'static-site';
  features?: string[];
  database?: 'none' | 'postgresql' | 'mongodb' | 'sqlite';
  authentication?: boolean;
  styling?: 'tailwind' | 'bootstrap' | 'material-ui' | 'none';
}

export interface GeneratedProject {
  name: string;
  structure: FileStructure;
  files: Map<string, string>;
  packageJson: PackageJsonContent;
  scripts: Record<string, string>;
  metadata: ProjectMetadata;
}

export interface FileStructure {
  root: string;
  directories: string[];
  files: string[];
}

export interface PackageJsonContent {
  name: string;
  version: string;
  description: string;
  main: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface ProjectMetadata {
  createdAt: number;
  updatedAt: number;
  version: string;
  features: string[];
  database: string;
  authentication: boolean;
  styling: string;
}

/**
 * Génère un projet complet multi-fichiers
 */
export async function generateProject(request: ProjectGenerationRequest): Promise<GeneratedProject> {
  try {
    console.log('[ProjectGenerator] Generating project:', request.name);

    // Générer la structure de dossiers
    const structure = generateProjectStructure(request);

    // Générer les fichiers
    const files = await generateProjectFiles(request, structure);

    // Générer le package.json
    const packageJson = await generatePackageJson(request);

    // Générer les scripts
    const scripts = generateBuildScripts(request);

    // Créer les métadonnées
    const metadata: ProjectMetadata = {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      features: request.features || [],
      database: request.database || 'none',
      authentication: request.authentication || false,
      styling: request.styling || 'tailwind'
    };

    return {
      name: request.name,
      structure,
      files,
      packageJson,
      scripts,
      metadata
    };
  } catch (error) {
    console.error('[ProjectGenerator] Error:', error);
    throw error;
  }
}

/**
 * Génère la structure de dossiers du projet
 */
function generateProjectStructure(request: ProjectGenerationRequest): FileStructure {
  const directories: string[] = [];
  const files: string[] = [];

  // Structure de base
  directories.push(
    'src',
    'public',
    'config',
    '.github/workflows'
  );

  // Ajouter des dossiers selon le type
  if (request.projectType.includes('react') || request.projectType.includes('next')) {
    directories.push(
      'src/components',
      'src/pages',
      'src/hooks',
      'src/utils',
      'src/styles'
    );
  }

  if (request.projectType.includes('express') || request.projectType === 'full-stack') {
    directories.push(
      'src/routes',
      'src/middleware',
      'src/models',
      'src/controllers',
      'src/services'
    );
  }

  if (request.database !== 'none') {
    directories.push('src/database', 'migrations');
  }

  // Fichiers de configuration
  files.push(
    'package.json',
    '.gitignore',
    'README.md',
    'tsconfig.json',
    '.env.example'
  );

  if (request.styling === 'tailwind') {
    files.push('tailwind.config.js', 'postcss.config.js');
  }

  if (request.projectType.includes('next')) {
    files.push('next.config.js');
  }

  return {
    root: request.name,
    directories,
    files
  };
}

/**
 * Génère tous les fichiers du projet
 */
async function generateProjectFiles(
  request: ProjectGenerationRequest,
  structure: FileStructure
): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  try {
    // Générer les fichiers source
    const sourceFiles = await generateSourceFiles(request);
    sourceFiles.forEach((content, filename) => {
      files.set(`src/${filename}`, content);
    });

    // Générer les fichiers de configuration
    const configFiles = await generateConfigFiles(request);
    configFiles.forEach((content, filename) => {
      files.set(filename, content);
    });

    // Générer les fichiers publics
    const publicFiles = generatePublicFiles(request);
    publicFiles.forEach((content, filename) => {
      files.set(`public/${filename}`, content);
    });

    return files;
  } catch (error) {
    console.error('[ProjectGenerator] File generation error:', error);
    throw error;
  }
}

/**
 * Génère les fichiers source (composants, pages, etc.)
 */
async function generateSourceFiles(request: ProjectGenerationRequest): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  try {
    const systemPrompt = `Tu es un expert en développement web.
Tu génères des fichiers de code source pour des projets ${request.projectType}.

RÈGLES:
1. Code production-ready
2. Bien structuré et commenté
3. Suivre les meilleures pratiques
4. TypeScript quand possible
5. Retourne UNIQUEMENT le code`;

    const userPrompt = `Génère les fichiers source pour un projet ${request.projectType}:

Nom: ${request.name}
Description: ${request.description}
Features: ${request.features?.join(', ') || 'aucune'}
Database: ${request.database}
Authentication: ${request.authentication ? 'oui' : 'non'}
Styling: ${request.styling}

Génère les fichiers principaux du projet.`;

    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    let content = typeof response.choices?.[0]?.message?.content === 'string' 
      ? response.choices[0].message.content 
      : '';

    // Parser les fichiers générés
    const fileMatches = content.match(/\/\/ File: (.+?)\n([\s\S]*?)(?=\/\/ File:|$)/g) || [];
    
    fileMatches.forEach(match => {
      const lines = match.split('\n');
      const filename = lines[0].replace('// File: ', '').trim();
      const fileContent = lines.slice(1).join('\n').trim();
      if (filename && fileContent) {
        files.set(filename, fileContent);
      }
    });

    // Fallback: créer des fichiers par défaut
    if (files.size === 0) {
      files.set('index.ts', generateDefaultIndex(request));
      files.set('App.tsx', generateDefaultApp(request));
    }

    return files;
  } catch (error) {
    console.error('[ProjectGenerator] Source file generation error:', error);
    return new Map();
  }
}

/**
 * Génère les fichiers de configuration
 */
async function generateConfigFiles(request: ProjectGenerationRequest): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  try {
    // .gitignore
    files.set('.gitignore', `node_modules/
dist/
build/
.env
.env.local
.DS_Store
*.log
.next/
out/
.cache/
.parcel-cache/`);

    // README.md
    files.set('README.md', `# ${request.name}

${request.description}

## Installation

\`\`\`bash
npm install
\`\`\`

## Développement

\`\`\`bash
npm run dev
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`

## Features

${request.features?.map(f => `- ${f}`).join('\n') || '- Aucune'}`);

    // tsconfig.json
    files.set('tsconfig.json', JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true,
        strictFunctionTypes: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        baseUrl: '.',
        paths: {
          '@/*': ['src/*']
        }
      },
      include: ['src'],
      exclude: ['node_modules', 'dist']
    }, null, 2));

    // .env.example
    files.set('.env.example', `# API Configuration
VITE_API_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Authentication
AUTH_SECRET=your-secret-key

# Features
ENABLE_ANALYTICS=true
ENABLE_NOTIFICATIONS=false`);

    // Tailwind config si nécessaire
    if (request.styling === 'tailwind') {
      files.set('tailwind.config.js', `export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`);

      files.set('postcss.config.js', `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`);
    }

    return files;
  } catch (error) {
    console.error('[ProjectGenerator] Config file generation error:', error);
    return new Map();
  }
}

/**
 * Génère les fichiers publics
 */
function generatePublicFiles(request: ProjectGenerationRequest): Map<string, string> {
  const files = new Map<string, string>();

  // index.html
  files.set('index.html', `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${request.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`);

  return files;
}

/**
 * Génère le package.json
 */
async function generatePackageJson(request: ProjectGenerationRequest): Promise<PackageJsonContent> {
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {
    'typescript': '^5.0.0',
    'vite': '^5.0.0',
    '@vitejs/plugin-react': '^4.0.0'
  };

  // Ajouter les dépendances selon le type
  if (request.projectType.includes('react')) {
    dependencies['react'] = '^18.0.0';
    dependencies['react-dom'] = '^18.0.0';
  }

  if (request.projectType.includes('next')) {
    dependencies['next'] = '^14.0.0';
    dependencies['react'] = '^18.0.0';
    dependencies['react-dom'] = '^18.0.0';
  }

  if (request.projectType.includes('express')) {
    dependencies['express'] = '^4.18.0';
    devDependencies['@types/express'] = '^4.17.0';
  }

  if (request.styling === 'tailwind') {
    dependencies['tailwindcss'] = '^3.0.0';
    devDependencies['postcss'] = '^8.0.0';
    devDependencies['autoprefixer'] = '^10.0.0';
  }

  if (request.database === 'postgresql') {
    dependencies['pg'] = '^8.0.0';
  } else if (request.database === 'mongodb') {
    dependencies['mongoose'] = '^8.0.0';
  }

  if (request.authentication) {
    dependencies['jsonwebtoken'] = '^9.0.0';
    dependencies['bcryptjs'] = '^2.4.0';
  }

  return {
    name: request.name,
    version: '1.0.0',
    description: request.description,
    main: 'dist/index.js',
    scripts: {
      dev: 'vite',
      build: 'tsc && vite build',
      preview: 'vite preview',
      lint: 'eslint src --ext ts,tsx'
    },
    dependencies,
    devDependencies
  };
}

/**
 * Génère les scripts de build
 */
function generateBuildScripts(request: ProjectGenerationRequest): Record<string, string> {
  return {
    dev: 'vite',
    build: 'tsc && vite build',
    preview: 'vite preview',
    lint: 'eslint src --ext ts,tsx',
    test: 'vitest',
    format: 'prettier --write "src/**/*.{ts,tsx,json,css}"'
  };
}

/**
 * Génère un fichier index par défaut
 */
function generateDefaultIndex(request: ProjectGenerationRequest): string {
  return `export const PROJECT_NAME = '${request.name}';
export const PROJECT_VERSION = '1.0.0';
export const PROJECT_DESCRIPTION = '${request.description}';`;
}

/**
 * Génère un fichier App par défaut
 */
function generateDefaultApp(request: ProjectGenerationRequest): string {
  return `import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          ${request.name}
        </h1>
        <p className="text-xl text-gray-600">
          ${request.description}
        </p>
      </div>
    </div>
  );
}`;
}

/**
 * Singleton global
 */
let instance: typeof ProjectGeneratorModule;

export const ProjectGeneratorModule = {
  generateProject,
  generateProjectStructure
};

export function getProjectGenerator() {
  if (!instance) {
    instance = ProjectGeneratorModule;
  }
  return instance;
}
