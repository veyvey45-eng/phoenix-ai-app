/**
 * Real Tools - Outils RÉELS pour Phoenix (pas de simulation)
 * 
 * Ces outils utilisent le vrai système de fichiers E2B
 * et peuvent exposer des URLs publiques
 * 
 * MODIFICATION: Sauvegarde automatique dans hostedSites pour URLs permanentes
 * MODIFICATION 2: Synchronisation avec FileSystemManager pour persistance
 */

import { Tool, ToolContext, ToolResult } from './toolRegistry';
import { realProjectSystem } from './realProjectSystem';
import { createHostedSite } from '../hostedSites';
import { fileSystemManager } from './fileSystemManager';

// ==================== REAL FILE CREATE ====================

export const realFileCreateTool: Tool = {
  name: 'real_file_create',
  description: `Crée un fichier RÉEL et PERSISTANT.
  
Ce fichier est créé dans:
1. Le sandbox E2B (pour exécution immédiate)
2. Le système de fichiers persistant S3 (pour accès permanent)

Les fichiers persistent même après la fin de la session E2B.

Exemple: Créer index.html dans /projects/monsite/`,
  category: 'file',
  parameters: [
    { name: 'path', type: 'string', description: 'Chemin du fichier (ex: /projects/monsite/index.html)', required: true },
    { name: 'content', type: 'string', description: 'Contenu du fichier', required: true }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      // 1. Créer dans E2B pour exécution immédiate
      const e2bResult = await realProjectSystem.createRealFile(
        context.sessionId,
        args.path,
        args.content
      );
      
      // 2. Persister dans le système de fichiers S3
      let persistentFile = null;
      if (context.userId) {
        try {
          const userIdNum = parseInt(context.userId, 10);
          if (!isNaN(userIdNum)) {
            persistentFile = await fileSystemManager.createFile({
              userId: userIdNum,
            path: args.path.startsWith('/') ? args.path : `/${args.path}`,
              content: args.content
            });
            console.log(`[real_file_create] Fichier persisté: ${persistentFile.path}`);
          }
        } catch (persistError) {
          console.warn(`[real_file_create] Erreur persistance (non bloquant):`, persistError);
        }
      }
      
      if (e2bResult.success) {
        return {
          success: true,
          output: `✅ Fichier créé: ${e2bResult.fullPath}${persistentFile ? ' (persisté en S3)' : ''}`,
          metadata: { 
            path: e2bResult.fullPath,
            persistentPath: persistentFile?.path,
            persistentId: persistentFile?.id
          }
        };
      } else {
        return {
          success: false,
          output: '',
          error: e2bResult.error
        };
      }
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== REAL FILE READ ====================

export const realFileReadTool: Tool = {
  name: 'real_file_read',
  description: `Lit un fichier RÉEL.
  
Essaie d'abord de lire depuis le système persistant S3,
puis depuis le sandbox E2B si non trouvé.`,
  category: 'file',
  parameters: [
    { name: 'path', type: 'string', description: 'Chemin du fichier à lire', required: true }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const normalizedPath = args.path.startsWith('/') ? args.path : `/${args.path}`;
      
      // 1. Essayer de lire depuis le système persistant
      if (context.userId) {
        try {
          const userIdNum = parseInt(context.userId, 10);
          if (isNaN(userIdNum)) throw new Error('Invalid userId');
          const persistentFile = await fileSystemManager.readFileByPath(normalizedPath, userIdNum);
          if (persistentFile && persistentFile.content) {
            return {
              success: true,
              output: persistentFile.content,
              metadata: { 
                path: persistentFile.path,
                source: 'persistent',
                version: persistentFile.version
              }
            };
          }
        } catch (persistError) {
          // Fichier non trouvé en persistant, essayer E2B
          console.log(`[real_file_read] Fichier non trouvé en persistant, essai E2B...`);
        }
      }
      
      // 2. Fallback: lire depuis E2B
      const result = await realProjectSystem.readRealFile(context.sessionId, args.path);
      
      if (result.success) {
        return {
          success: true,
          output: result.content || '',
          metadata: { path: args.path, source: 'e2b' }
        };
      } else {
        return { success: false, output: '', error: result.error };
      }
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== REAL PROJECT CREATE ====================
// Stockage temporaire des fichiers du projet pour la sauvegarde permanente
const projectFilesCache: Map<string, { name: string; files: Array<{ path: string; content: string }> }> = new Map();

export const realProjectCreateTool: Tool = {
  name: 'real_project_create',
  description: `Crée un projet COMPLET avec plusieurs fichiers dans le sandbox E2B.

Ce projet est créé dans un vrai système de fichiers.
Après création, tu peux le servir avec 'real_preview_start'.

⚡ NOUVEAU: Le site sera AUTOMATIQUEMENT sauvegardé de façon permanente!
L'utilisateur recevra une URL permanente qui ne disparaîtra jamais.

Exemple de fichiers:
- index.html
- style.css
- script.js
- package.json (pour Node.js)`,
  category: 'code',
  parameters: [
    { name: 'name', type: 'string', description: 'Nom du projet (sera le nom du dossier)', required: true },
    { name: 'files', type: 'array', description: 'Liste des fichiers [{path, content, mimeType}]', required: true }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const files = args.files.map((f: any) => ({
        path: f.path,
        content: f.content,
        mimeType: f.mimeType || 'text/plain'
      }));
      
      const result = await realProjectSystem.createProject(
        context.sessionId,
        args.name,
        files
      );
      
      if (result.success) {
        // Stocker les fichiers pour la sauvegarde permanente lors du preview
        const cacheKey = `${context.sessionId}:${args.name}`;
        projectFilesCache.set(cacheKey, {
          name: args.name,
          files: files.map((f: any) => ({ path: f.path, content: f.content }))
        });
        
        return {
          success: true,
          output: `✅ Projet "${args.name}" créé avec ${result.filesCreated.length} fichiers!\n\nChemin: ${result.projectPath}\n\nFichiers:\n${result.filesCreated.map(f => `- ${f}`).join('\n')}\n\n💡 Utilise 'real_preview_start' pour obtenir une URL publique!`,
          metadata: {
            projectPath: result.projectPath,
            filesCreated: result.filesCreated
          }
        };
      } else {
        return {
          success: false,
          output: `Projet partiellement créé. Fichiers: ${result.filesCreated.length}`,
          error: result.errors.join('\n')
        };
      }
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== REAL PREVIEW START ====================

export const realPreviewStartTool: Tool = {
  name: 'real_preview_start',
  description: `Démarre un serveur HTTP pour servir un projet et retourne une URL PUBLIQUE.

⚡ NOUVEAU: Le site est AUTOMATIQUEMENT sauvegardé de façon PERMANENTE!
L'utilisateur reçoit DEUX URLs:
1. URL E2B temporaire (30 min) pour le preview immédiat
2. URL PERMANENTE qui ne disparaîtra JAMAIS

Types de projets supportés:
- Sites statiques (HTML/CSS/JS) → Serveur Python HTTP
- Applications Node.js → Serveur Node.js avec npm start`,
  category: 'web',
  parameters: [
    { name: 'project_path', type: 'string', description: 'Chemin du projet (ex: projects/monsite)', required: true },
    { name: 'port', type: 'number', description: 'Port à utiliser (défaut: 8080)', required: false },
    { name: 'type', type: 'string', description: 'Type: static (défaut) ou nodejs', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const port = args.port || 8080;
      const type = args.type || 'static';
      
      let result;
      if (type === 'nodejs') {
        result = await realProjectSystem.startNodeServer(
          context.sessionId,
          args.project_path,
          port
        );
      } else {
        result = await realProjectSystem.startPreviewServer(
          context.sessionId,
          args.project_path,
          port
        );
      }
      
      if (result.success && result.publicUrl) {
        // Extraire le nom du projet du chemin
        const projectName = args.project_path.split('/').pop() || args.project_path;
        const cacheKey = `${context.sessionId}:${projectName}`;
        const cachedProject = projectFilesCache.get(cacheKey);
        
        let permanentUrl = '';
        let permanentMessage = '';
        
        // Essayer de sauvegarder le site de façon permanente
        if (cachedProject) {
          try {
            // Trouver les fichiers HTML, CSS et JS
            const htmlFile = cachedProject.files.find(f => f.path === 'index.html' || f.path.endsWith('.html'));
            const cssFile = cachedProject.files.find(f => f.path === 'style.css' || f.path.endsWith('.css'));
            const jsFile = cachedProject.files.find(f => f.path === 'script.js' || f.path.endsWith('.js'));
            
            if (htmlFile) {
              // Extraire l'userId du context (convertir en nombre)
              const userId = parseInt(context.userId, 10) || 1;
              
              // Créer le site hébergé permanent
              const hostedSite = await createHostedSite({
                userId,
                name: cachedProject.name,
                description: `Site généré par Phoenix AI`,
                siteType: 'custom',
                htmlContent: htmlFile.content,
                cssContent: cssFile?.content,
                jsContent: jsFile?.content,
                isPublic: true
              });
              
              if (hostedSite) {
                permanentUrl = `/sites/${hostedSite.slug}`;
                permanentMessage = `\n\n🔗 **URL PERMANENTE:** ${permanentUrl}\n   Cette URL ne disparaîtra JAMAIS!`;
                
                // Nettoyer le cache
                projectFilesCache.delete(cacheKey);
              }
            }
          } catch (saveError: any) {
            console.error('[realPreviewStart] Erreur sauvegarde permanente:', saveError);
            permanentMessage = '\n\n⚠️ Sauvegarde permanente non disponible (erreur interne)';
          }
        } else {
          // Essayer de lire les fichiers directement depuis le sandbox
          try {
            const htmlResult = await realProjectSystem.readRealFile(context.sessionId, `${args.project_path}/index.html`);
            const cssResult = await realProjectSystem.readRealFile(context.sessionId, `${args.project_path}/style.css`);
            const jsResult = await realProjectSystem.readRealFile(context.sessionId, `${args.project_path}/script.js`);
            
            if (htmlResult.success && htmlResult.content) {
              const userId = parseInt(context.userId, 10) || 1;
              
              const hostedSite = await createHostedSite({
                userId,
                name: projectName,
                description: `Site généré par Phoenix AI`,
                siteType: 'custom',
                htmlContent: htmlResult.content,
                cssContent: cssResult.content,
                jsContent: jsResult.content,
                isPublic: true
              });
              
              if (hostedSite) {
                permanentUrl = `/sites/${hostedSite.slug}`;
                permanentMessage = `\n\n🔗 **URL PERMANENTE:** ${permanentUrl}\n   Cette URL ne disparaîtra JAMAIS!`;
              }
            }
          } catch (readError: any) {
            console.error('[realPreviewStart] Erreur lecture fichiers:', readError);
          }
        }
        
        return {
          success: true,
          output: `🚀 Serveur démarré!\n\n🌐 **URL TEMPORAIRE (30 min):** ${result.publicUrl}\n   Pour preview immédiat.${permanentMessage}\n\nLe serveur E2B restera actif pendant 30 minutes.`,
          metadata: {
            publicUrl: result.publicUrl,
            permanentUrl: permanentUrl || undefined,
            port,
            type
          },
          artifacts: [{
            type: 'text',
            content: permanentUrl || result.publicUrl,
            mimeType: 'text/uri-list',
            name: 'URL du projet'
          }]
        };
      } else {
        return { success: false, output: '', error: result.error };
      }
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== REAL EXPOSE PORT ====================

export const realExposePortTool: Tool = {
  name: 'real_expose_port',
  description: `Expose un port du sandbox avec une URL PUBLIQUE.

Utilise cette fonction quand tu as déjà un serveur qui tourne sur un port
et que tu veux obtenir son URL publique.`,
  category: 'system',
  parameters: [
    { name: 'port', type: 'number', description: 'Port à exposer', required: true }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const result = await realProjectSystem.exposePort(context.sessionId, args.port);
      
      if (result.success && result.publicUrl) {
        return {
          success: true,
          output: `🌐 Port ${args.port} exposé!\n\nURL publique: ${result.publicUrl}`,
          metadata: { publicUrl: result.publicUrl, port: args.port }
        };
      } else {
        return { success: false, output: '', error: result.error };
      }
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== REAL DEPLOY ====================

export const realDeployTool: Tool = {
  name: 'real_deploy',
  description: `Déploie un projet vers le cloud pour un accès PERMANENT.

Contrairement à 'real_preview_start' qui donne une URL temporaire (30 min),
cette fonction upload les fichiers vers S3 pour un accès permanent.`,
  category: 'web',
  parameters: [
    { name: 'project_path', type: 'string', description: 'Chemin du projet à déployer', required: true },
    { name: 'name', type: 'string', description: 'Nom du déploiement', required: true }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const result = await realProjectSystem.deployProject(
        context.sessionId,
        args.project_path,
        args.name
      );
      
      if ('projectId' in result) {
        return {
          success: true,
          output: `✅ Projet déployé!\n\n📦 ID: ${result.projectId}\n🌐 URL: ${result.indexUrl}\n📁 Fichiers: ${result.files.length}\n\nFichiers déployés:\n${result.files.map(f => `- ${f.path}: ${f.url}`).join('\n')}`,
          metadata: {
            projectId: result.projectId,
            indexUrl: result.indexUrl,
            files: result.files
          },
          artifacts: [{
            type: 'text',
            content: result.indexUrl,
            mimeType: 'text/uri-list',
            name: 'URL du projet déployé'
          }]
        };
      } else {
        return { success: false, output: '', error: result.error };
      }
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== REAL SHELL EXEC ====================

export const realShellExecTool: Tool = {
  name: 'real_shell_exec',
  description: `Exécute une commande shell RÉELLE dans le sandbox E2B.

Commandes supportées: npm, node, python, git, curl, wget, etc.
Le résultat est réel, pas simulé.`,
  category: 'system',
  parameters: [
    { name: 'command', type: 'string', description: 'Commande à exécuter', required: true },
    { name: 'cwd', type: 'string', description: 'Répertoire de travail (optionnel)', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const result = await realProjectSystem.executeCommand(
        context.sessionId,
        args.command,
        args.cwd
      );
      
      let output = '';
      if (result.stdout) output += result.stdout;
      if (result.stderr) output += (output ? '\n' : '') + result.stderr;
      
      return {
        success: result.success,
        output: output || '[Aucune sortie]',
        error: result.success ? undefined : `Exit code: ${result.exitCode}`,
        metadata: {
          exitCode: result.exitCode,
          command: args.command
        }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== REAL LIST FILES ====================

export const realListFilesTool: Tool = {
  name: 'real_list_files',
  description: `Liste les fichiers d'un répertoire dans le sandbox E2B.`,
  category: 'file',
  parameters: [
    { name: 'path', type: 'string', description: 'Chemin du répertoire', required: true }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const result = await realProjectSystem.listFiles(context.sessionId, args.path);
      
      if (result.success && result.files) {
        return {
          success: true,
          output: `📁 Fichiers dans ${args.path}:\n\n${result.files.map(f => `- ${f}`).join('\n')}`,
          metadata: { files: result.files, count: result.files.length }
        };
      } else {
        return { success: false, output: '', error: result.error };
      }
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== REAL PREVIEW LIST ====================

export const realPreviewListTool: Tool = {
  name: 'real_preview_list',
  description: `Liste tous les serveurs de preview actifs avec leurs URLs publiques.`,
  category: 'web',
  parameters: [],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const previews = realProjectSystem.getActivePreviews(context.sessionId);
      
      if (previews.length === 0) {
        return {
          success: true,
          output: 'Aucun serveur de preview actif.\n\nUtilise "real_preview_start" pour démarrer un serveur.',
          metadata: { count: 0 }
        };
      }
      
      const list = previews.map(p => 
        `🌐 Port ${p.port}: ${p.publicUrl}\n   📁 ${p.projectPath}\n   ⏱️ Démarré: ${p.startedAt.toISOString()}`
      ).join('\n\n');
      
      return {
        success: true,
        output: `📡 Serveurs de preview actifs:\n\n${list}`,
        metadata: { previews, count: previews.length }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== EXPORT ALL TOOLS ====================

export const realTools: Tool[] = [
  realFileCreateTool,
  realFileReadTool,
  realProjectCreateTool,
  realPreviewStartTool,
  realExposePortTool,
  realDeployTool,
  realShellExecTool,
  realListFilesTool,
  realPreviewListTool
];

export default realTools;
