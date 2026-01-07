/**
 * Smart Web Tools - Outils intelligents de création web avec fallback
 * 
 * Ces outils essaient d'abord E2B, puis basculent automatiquement
 * vers la création directe en base de données si E2B est indisponible.
 * 
 * Avantages:
 * - Toujours fonctionnel (pas de limite)
 * - URL permanente garantie
 * - Plus rapide pour les sites simples
 */

import { Tool, ToolContext, ToolResult } from './toolRegistry';
import { e2bManager } from './e2bManager';
import { staticSiteGenerator } from './staticSiteGenerator';
import { realProjectSystem } from './realProjectSystem';
import { createHostedSite } from '../hostedSites';

// Cache des fichiers de projet pour la sauvegarde
const projectFilesCache: Map<string, { 
  name: string; 
  files: Array<{ path: string; content: string; mimeType?: string }>;
  createdAt: Date;
}> = new Map();

// Nettoyer le cache après 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of Array.from(projectFilesCache.entries())) {
    if (now - value.createdAt.getTime() > 30 * 60 * 1000) {
      projectFilesCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Détecte si un projet est un site statique simple
 */
function isStaticSite(files: Array<{ path: string; content: string }>): boolean {
  const hasHTML = files.some(f => f.path.endsWith('.html'));
  const hasPackageJson = files.some(f => f.path === 'package.json');
  const hasServerCode = files.some(f => 
    f.path.endsWith('.ts') || 
    f.path.endsWith('.tsx') ||
    f.path.includes('server') ||
    f.path.includes('api')
  );
  
  // C'est un site statique si: HTML présent, pas de package.json, pas de code serveur
  return hasHTML && !hasPackageJson && !hasServerCode;
}

/**
 * Outil intelligent de création de projet web
 */
export const smartProjectCreateTool: Tool = {
  name: 'smart_project_create',
  description: `Crée un projet web de manière intelligente.

🎯 FONCTIONNEMENT:
1. Pour les sites STATIQUES (HTML/CSS/JS): Sauvegarde directement en base de données
   → URL PERMANENTE immédiate, pas de limite, ultra-rapide!
   
2. Pour les projets COMPLEXES (Node.js, React, etc.): Utilise E2B avec fallback
   → Si E2B échoue, bascule automatiquement sur une autre clé API
   → Si toutes les clés échouent, propose une alternative

⚡ AVANTAGES:
- Toujours fonctionnel (pas de limite de sandboxes)
- URL permanente garantie pour les sites statiques
- Rotation automatique des clés E2B

Exemple de fichiers:
- index.html, style.css, script.js → Site statique (DB directe)
- package.json, src/App.tsx → Projet complexe (E2B)`,
  category: 'code',
  parameters: [
    { name: 'name', type: 'string', description: 'Nom du projet', required: true },
    { name: 'files', type: 'array', description: 'Liste des fichiers [{path, content, mimeType}]', required: true },
    { name: 'force_e2b', type: 'boolean', description: 'Forcer l\'utilisation de E2B même pour les sites statiques', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    const files = args.files.map((f: any) => ({
      path: f.path,
      content: f.content,
      mimeType: f.mimeType || 'text/plain'
    }));
    
    const isStatic = isStaticSite(files);
    const forceE2B = args.force_e2b === true;
    
    // Pour les sites statiques, sauvegarder directement en DB
    if (isStatic && !forceE2B) {
      try {
        const userId = parseInt(context.userId, 10) || 1;
        
        const result = await staticSiteGenerator.createStaticSite(userId, {
          name: args.name,
          description: `Site créé par Phoenix AI`,
          files,
          siteType: 'custom',
          isPublic: true
        });
        
        if (result.success) {
          return {
            success: true,
            output: `✅ Site statique "${args.name}" créé avec succès!\n\n🔗 **URL PERMANENTE:** ${result.permanentUrl}\n   Cette URL ne disparaîtra JAMAIS!\n\n📁 Fichiers inclus:\n${files.map((f: any) => `- ${f.path}`).join('\n')}\n\n💡 Le site est déjà en ligne et accessible!`,
            metadata: {
              method: 'direct_db',
              permanentUrl: result.permanentUrl,
              slug: result.slug,
              filesCount: files.length
            },
            artifacts: [{
              type: 'text',
              content: result.permanentUrl || '',
              mimeType: 'text/uri-list',
              name: 'URL permanente du site'
            }]
          };
        } else {
          return {
            success: false,
            output: '',
            error: result.error || 'Erreur lors de la création du site'
          };
        }
      } catch (error: any) {
        return {
          success: false,
          output: '',
          error: `Erreur création site statique: ${error.message}`
        };
      }
    }
    
    // Pour les projets complexes, utiliser E2B avec le manager
    try {
      const { sandbox, error, usedFallback } = await e2bManager.getOrCreateSandbox(context.sessionId);
      
      if (!sandbox) {
        // E2B indisponible, proposer une alternative
        return {
          success: false,
          output: `⚠️ E2B temporairement indisponible: ${error}\n\n💡 Suggestions:\n- Convertir en site statique (HTML/CSS/JS)\n- Réessayer dans quelques minutes\n- Utiliser le Web Generator pour un site simple`,
          error: error,
          metadata: { e2bUnavailable: true }
        };
      }
      
      // Créer le projet via realProjectSystem
      const result = await realProjectSystem.createProject(
        context.sessionId,
        args.name,
        files
      );
      
      if (result.success) {
        // Mettre en cache pour la sauvegarde permanente lors du preview
        const cacheKey = `${context.sessionId}:${args.name}`;
        projectFilesCache.set(cacheKey, {
          name: args.name,
          files,
          createdAt: new Date()
        });
        
        let fallbackNote = '';
        if (usedFallback) {
          fallbackNote = '\n\n⚡ Note: Clé E2B de fallback utilisée (la principale était saturée)';
        }
        
        return {
          success: true,
          output: `✅ Projet "${args.name}" créé avec ${result.filesCreated.length} fichiers!\n\nChemin: ${result.projectPath}\n\nFichiers:\n${result.filesCreated.map(f => `- ${f}`).join('\n')}\n\n💡 Utilise 'smart_preview_start' pour obtenir une URL publique!${fallbackNote}`,
          metadata: {
            method: 'e2b',
            projectPath: result.projectPath,
            filesCreated: result.filesCreated,
            usedFallback
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
      return {
        success: false,
        output: '',
        error: `Erreur E2B: ${error.message}`
      };
    }
  }
};

/**
 * Outil intelligent de preview avec sauvegarde automatique
 */
export const smartPreviewStartTool: Tool = {
  name: 'smart_preview_start',
  description: `Démarre un preview et sauvegarde automatiquement le site de façon permanente.

🎯 FONCTIONNEMENT:
1. Démarre le serveur E2B pour le preview en temps réel
2. Sauvegarde AUTOMATIQUEMENT le site dans la base de données
3. Retourne DEUX URLs:
   - URL E2B temporaire (30 min) pour le preview
   - URL PERMANENTE qui ne disparaîtra jamais

⚡ Si E2B échoue, le site est quand même sauvegardé de façon permanente!`,
  category: 'web',
  parameters: [
    { name: 'project_path', type: 'string', description: 'Chemin du projet', required: true },
    { name: 'port', type: 'number', description: 'Port à utiliser (défaut: 8080)', required: false },
    { name: 'type', type: 'string', description: 'Type: static (défaut) ou nodejs', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    const port = args.port || 8080;
    const projectName = args.project_path.split('/').pop() || args.project_path;
    const cacheKey = `${context.sessionId}:${projectName}`;
    const cachedProject = projectFilesCache.get(cacheKey);
    
    let e2bUrl = '';
    let permanentUrl = '';
    let e2bError = '';
    
    // Essayer de démarrer le preview E2B
    try {
      const { sandbox, error } = await e2bManager.getOrCreateSandbox(context.sessionId);
      
      if (sandbox) {
        const result = await realProjectSystem.startPreviewServer(
          context.sessionId,
          args.project_path,
          port
        );
        
        if (result.success && result.publicUrl) {
          e2bUrl = result.publicUrl;
        } else {
          e2bError = result.error || 'Erreur démarrage serveur';
        }
      } else {
        e2bError = error || 'E2B indisponible';
      }
    } catch (error: any) {
      e2bError = error.message;
    }
    
    // Sauvegarder le site de façon permanente (toujours, même si E2B échoue)
    try {
      const userId = parseInt(context.userId, 10) || 1;
      
      if (cachedProject) {
        // Utiliser les fichiers en cache
        const result = await staticSiteGenerator.createStaticSite(userId, {
          name: cachedProject.name,
          files: cachedProject.files,
          isPublic: true
        });
        
        if (result.success) {
          permanentUrl = result.permanentUrl || '';
          projectFilesCache.delete(cacheKey);
        }
      } else {
        // Essayer de lire les fichiers depuis E2B
        const htmlResult = await realProjectSystem.readRealFile(context.sessionId, `${args.project_path}/index.html`);
        const cssResult = await realProjectSystem.readRealFile(context.sessionId, `${args.project_path}/style.css`);
        const jsResult = await realProjectSystem.readRealFile(context.sessionId, `${args.project_path}/script.js`);
        
        if (htmlResult.success && htmlResult.content) {
          const site = await createHostedSite({
            userId,
            name: projectName,
            description: `Site généré par Phoenix AI`,
            siteType: 'custom',
            htmlContent: htmlResult.content,
            cssContent: cssResult.content,
            jsContent: jsResult.content,
            isPublic: true
          });
          
          if (site) {
            permanentUrl = `/sites/${site.slug}`;
          }
        }
      }
    } catch (saveError: any) {
      console.error('[smartPreviewStart] Erreur sauvegarde permanente:', saveError);
    }
    
    // Construire la réponse
    if (e2bUrl && permanentUrl) {
      return {
        success: true,
        output: `🚀 Site déployé avec succès!\n\n🌐 **URL TEMPORAIRE (30 min):** ${e2bUrl}\n   Pour preview et tests en temps réel.\n\n🔗 **URL PERMANENTE:** ${permanentUrl}\n   Cette URL ne disparaîtra JAMAIS!\n\n💡 Partagez l'URL permanente pour un accès durable.`,
        metadata: {
          e2bUrl,
          permanentUrl,
          port
        },
        artifacts: [{
          type: 'text',
          content: permanentUrl,
          mimeType: 'text/uri-list',
          name: 'URL permanente'
        }]
      };
    } else if (permanentUrl) {
      return {
        success: true,
        output: `🚀 Site sauvegardé de façon permanente!\n\n🔗 **URL PERMANENTE:** ${permanentUrl}\n   Cette URL ne disparaîtra JAMAIS!\n\n⚠️ Preview E2B non disponible: ${e2bError}\n   Mais votre site est accessible via l'URL permanente!`,
        metadata: {
          permanentUrl,
          e2bError
        },
        artifacts: [{
          type: 'text',
          content: permanentUrl,
          mimeType: 'text/uri-list',
          name: 'URL permanente'
        }]
      };
    } else if (e2bUrl) {
      return {
        success: true,
        output: `🚀 Serveur démarré!\n\n🌐 **URL TEMPORAIRE (30 min):** ${e2bUrl}\n\n⚠️ Sauvegarde permanente non disponible.\n   L'URL expirera dans 30 minutes.`,
        metadata: {
          e2bUrl,
          port
        },
        artifacts: [{
          type: 'text',
          content: e2bUrl,
          mimeType: 'text/uri-list',
          name: 'URL du projet'
        }]
      };
    } else {
      return {
        success: false,
        output: '',
        error: `Impossible de créer le site. E2B: ${e2bError}`
      };
    }
  }
};

/**
 * Outil de création rapide de site d'hôtel
 */
export const quickHotelSiteTool: Tool = {
  name: 'quick_hotel_site',
  description: `Crée rapidement un site web élégant pour un hôtel.

🎯 Génère automatiquement:
- Design moderne et responsive
- Section hero avec nom et adresse
- Liste des services/équipements
- Section contact
- Footer professionnel

⚡ Sauvegarde directement en base de données = URL PERMANENTE immédiate!`,
  category: 'web',
  parameters: [
    { name: 'name', type: 'string', description: 'Nom de l\'hôtel', required: true },
    { name: 'address', type: 'string', description: 'Adresse complète', required: true },
    { name: 'city', type: 'string', description: 'Ville', required: false },
    { name: 'description', type: 'string', description: 'Description/slogan', required: false },
    { name: 'features', type: 'array', description: 'Liste des services (ex: ["WiFi", "Parking"])', required: false },
    { name: 'phone', type: 'string', description: 'Numéro de téléphone', required: false },
    { name: 'email', type: 'string', description: 'Email de contact', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const userId = parseInt(context.userId, 10) || 1;
      
      // Générer le HTML du site d'hôtel
      const htmlContent = staticSiteGenerator.generateHotelTemplate({
        name: args.name,
        address: args.address,
        city: args.city,
        description: args.description,
        features: args.features,
        phone: args.phone,
        email: args.email
      });
      
      // Sauvegarder directement en base de données
      const result = await staticSiteGenerator.createFromHTML(
        userId,
        args.name,
        htmlContent,
        {
          description: `Site web de l'hôtel ${args.name}`,
          siteType: 'business',
          isPublic: true
        }
      );
      
      if (result.success) {
        return {
          success: true,
          output: `🏨 Site de l'hôtel "${args.name}" créé avec succès!\n\n🔗 **URL PERMANENTE:** ${result.permanentUrl}\n   Cette URL ne disparaîtra JAMAIS!\n\n📍 Adresse: ${args.address}${args.city ? `, ${args.city}` : ''}\n\n✨ Le site inclut:\n- Design moderne et élégant\n- Section hero avec votre nom et adresse\n- Liste de vos services\n- Section contact\n- Responsive (mobile-friendly)\n\n💡 Partagez cette URL avec vos clients!`,
          metadata: {
            permanentUrl: result.permanentUrl,
            slug: result.slug,
            hotelName: args.name
          },
          artifacts: [{
            type: 'text',
            content: result.permanentUrl || '',
            mimeType: 'text/uri-list',
            name: 'URL du site hôtel'
          }]
        };
      } else {
        return {
          success: false,
          output: '',
          error: result.error || 'Erreur lors de la création du site'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: `Erreur: ${error.message}`
      };
    }
  }
};

/**
 * Outil pour obtenir les stats E2B
 */
export const e2bStatsTool: Tool = {
  name: 'e2b_stats',
  description: `Affiche les statistiques du gestionnaire E2B.

Informations disponibles:
- Nombre de sandboxes actifs
- État des clés API (active/inactive)
- Compteurs d'utilisation et d'erreurs`,
  category: 'system',
  parameters: [],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    const stats = e2bManager.getStats();
    
    const keysInfo = stats.apiKeys.map(k => 
      `  - ${k.name}: ${k.isActive ? '✅ Active' : '❌ Inactive'} (${k.usageCount} utilisations, ${k.failureCount} erreurs)`
    ).join('\n');
    
    return {
      success: true,
      output: `📊 Statistiques E2B\n\n🔧 Sandboxes actifs: ${stats.activeSandboxes}\n⏱️ Plus ancien sandbox: ${stats.oldestSandboxAge}s\n\n🔑 Clés API:\n${keysInfo}`,
      metadata: stats
    };
  }
};

// Export des outils
export const smartWebTools: Tool[] = [
  smartProjectCreateTool,
  smartPreviewStartTool,
  quickHotelSiteTool,
  e2bStatsTool
];

export default smartWebTools;
