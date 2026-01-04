/**
 * Project Analyzer Module
 * Accède au système de fichiers réel et analyse le projet
 * Solution #1: Intégrer l'accès au projet réel
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, relative } from 'path';

export interface ProjectFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  content?: string;
  language?: string;
}

export interface ProjectStructure {
  rootPath: string;
  totalFiles: number;
  totalDirectories: number;
  files: ProjectFile[];
  summary: string;
}

/**
 * Analyse la structure complète du projet
 */
export async function analyzeProjectStructure(projectPath: string): Promise<ProjectStructure> {
  console.log(`[ProjectAnalyzer] Analyzing project at: ${projectPath}`);

  const files: ProjectFile[] = [];
  let totalFiles = 0;
  let totalDirectories = 0;

  try {
    // Récursif: lire tous les fichiers
    await walkDirectory(projectPath, projectPath, files, (f, d) => {
      totalFiles += f;
      totalDirectories += d;
    });

    console.log(`[ProjectAnalyzer] Found ${totalFiles} files and ${totalDirectories} directories`);

    // Créer un résumé
    const summary = createProjectSummary(files);

    return {
      rootPath: projectPath,
      totalFiles,
      totalDirectories,
      files,
      summary
    };
  } catch (error) {
    console.error('[ProjectAnalyzer] Error analyzing project:', error);
    throw error;
  }
}

/**
 * Parcourt récursivement le répertoire
 */
async function walkDirectory(
  currentPath: string,
  rootPath: string,
  files: ProjectFile[],
  onCount: (fileCount: number, dirCount: number) => void,
  maxDepth: number = 5,
  currentDepth: number = 0
): Promise<void> {
  if (currentDepth > maxDepth) {
    console.log(`[ProjectAnalyzer] Max depth reached at ${currentPath}`);
    return;
  }

  // Ignorer les répertoires sensibles
  const ignoreDirs = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.venv',
    '__pycache__',
    '.env',
    'coverage'
  ];

  try {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      // Ignorer les fichiers cachés sauf .env et .gitignore
      if (entry.name.startsWith('.') && !['env', 'gitignore', 'eslintrc'].some(n => entry.name.includes(n))) {
        continue;
      }

      // Ignorer les répertoires sensibles
      if (ignoreDirs.some(dir => entry.name === dir)) {
        continue;
      }

      const fullPath = join(currentPath, entry.name);
      const relativePath = relative(rootPath, fullPath);

      if (entry.isDirectory()) {
        files.push({
          path: relativePath,
          name: entry.name,
          type: 'directory'
        });

        onCount(0, 1);

        // Récursif
        await walkDirectory(fullPath, rootPath, files, onCount, maxDepth, currentDepth + 1);
      } else {
        const fileSize = (await stat(fullPath)).size;
        const language = detectLanguage(entry.name);

        // Lire le contenu des fichiers importants
        let content: string | undefined;
        if (shouldReadFile(entry.name, fileSize)) {
          try {
            content = await readFile(fullPath, 'utf-8');
          } catch (e) {
            console.log(`[ProjectAnalyzer] Could not read ${entry.name}`);
          }
        }

        files.push({
          path: relativePath,
          name: entry.name,
          type: 'file',
          size: fileSize,
          content,
          language
        });

        onCount(1, 0);
      }
    }
  } catch (error) {
    console.error(`[ProjectAnalyzer] Error reading directory ${currentPath}:`, error);
  }
}

/**
 * Détecte le langage du fichier
 */
function detectLanguage(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript React',
    js: 'JavaScript',
    jsx: 'JavaScript React',
    py: 'Python',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    go: 'Go',
    rs: 'Rust',
    rb: 'Ruby',
    php: 'PHP',
    sql: 'SQL',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    md: 'Markdown',
    css: 'CSS',
    scss: 'SCSS',
    html: 'HTML',
    xml: 'XML'
  };

  return languageMap[ext || ''];
}

/**
 * Détermine si un fichier doit être lu
 */
function shouldReadFile(filename: string, size: number): boolean {
  // Ne pas lire les fichiers > 100KB
  if (size > 100 * 1024) {
    return false;
  }

  // Lire les fichiers importants
  const importantFiles = [
    'package.json',
    'tsconfig.json',
    'README.md',
    '.env.example',
    'todo.md',
    'drizzle.config.ts',
    'schema.ts',
    'routers.ts',
    'App.tsx',
    'main.tsx'
  ];

  if (importantFiles.includes(filename)) {
    return true;
  }

  // Lire les fichiers de configuration
  if (filename.startsWith('.') && filename.endsWith('rc')) {
    return true;
  }

  // Lire les fichiers de test
  if (filename.endsWith('.test.ts') || filename.endsWith('.test.tsx')) {
    return true;
  }

  return false;
}

/**
 * Crée un résumé du projet
 */
function createProjectSummary(files: ProjectFile[]): string {
  const filesByType: Record<string, number> = {};
  const filesByLanguage: Record<string, number> = {};
  let totalSize = 0;

  files.forEach(file => {
    if (file.type === 'file') {
      const ext = file.name.split('.').pop() || 'unknown';
      filesByType[ext] = (filesByType[ext] || 0) + 1;

      if (file.language) {
        filesByLanguage[file.language] = (filesByLanguage[file.language] || 0) + 1;
      }

      if (file.size) {
        totalSize += file.size;
      }
    }
  });

  const summary = `
## Project Summary

**Total Files:** ${files.filter(f => f.type === 'file').length}
**Total Directories:** ${files.filter(f => f.type === 'directory').length}
**Total Size:** ${formatBytes(totalSize)}

### File Types
${Object.entries(filesByType)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([ext, count]) => `- .${ext}: ${count} files`)
  .join('\n')}

### Languages
${Object.entries(filesByLanguage)
  .sort((a, b) => b[1] - a[1])
  .map(([lang, count]) => `- ${lang}: ${count} files`)
  .join('\n')}
`;

  return summary;
}

/**
 * Formate les bytes en taille lisible
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Obtient les fichiers importants du projet
 */
export function getImportantFiles(structure: ProjectStructure): ProjectFile[] {
  return structure.files.filter(f => {
    if (f.type === 'directory') return false;

    const importantPatterns = [
      /package\.json/,
      /tsconfig/,
      /README/,
      /todo\.md/,
      /schema\.ts/,
      /routers\.ts/,
      /App\.tsx/,
      /main\.tsx/,
      /\.test\.ts/,
      /\.test\.tsx/
    ];

    return importantPatterns.some(p => p.test(f.name));
  });
}

/**
 * Crée un contexte pour l'analyse LLM
 */
export function createProjectContext(structure: ProjectStructure): string {
  const importantFiles = getImportantFiles(structure);

  let context = `# Project Analysis Context\n\n${structure.summary}\n\n`;

  context += '## Important Files Content\n\n';

  importantFiles.forEach(file => {
    if (file.content) {
      context += `### ${file.path}\n\`\`\`${file.language || 'text'}\n${file.content.substring(0, 500)}\n...\n\`\`\`\n\n`;
    }
  });

  return context;
}

/**
 * Analyse le projet et retourne un rapport
 */
export async function generateProjectReport(projectPath: string): Promise<string> {
  console.log('[ProjectAnalyzer] Generating project report...');

  const structure = await analyzeProjectStructure(projectPath);
  const context = createProjectContext(structure);

  return `# Project Analysis Report\n\n${context}`;
}
