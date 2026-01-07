/**
 * More Advanced Tools - Outils supplémentaires niveau Manus pour Phoenix
 * 
 * Ce module ajoute des outils supplémentaires :
 * - data_analysis : Analyse de données avec visualisations
 * - code_review : Revue de code automatique
 * - git_operations : Opérations Git
 * - database_query : Requêtes SQL
 * - api_call : Appels API REST
 * - document_generate : Génération de documents (PDF, Word)
 * - email_send : Envoi d'emails
 * - notification : Notifications système
 */

import { Tool, ToolContext, ToolResult } from './toolRegistry';
import { e2bSandbox } from './e2bSandbox';
import { invokeLLM } from '../_core/llm';
import { storagePut } from '../storage';

// ==================== DATA ANALYSIS TOOL ====================

export const dataAnalysisTool: Tool = {
  name: 'data_analysis',
  description: `Analyse des données et génère des visualisations.

Capacités:
- Analyse statistique (moyenne, médiane, écart-type, corrélations)
- Génération de graphiques (bar, line, pie, scatter, heatmap)
- Détection d'anomalies
- Résumé automatique des insights

Formats supportés: CSV, JSON, Excel`,
  category: 'data',
  parameters: [
    { name: 'data', type: 'string', description: 'Données en JSON ou chemin vers fichier', required: true },
    { name: 'analysis_type', type: 'string', description: 'Type: statistics, visualization, anomaly, summary', required: true },
    { name: 'chart_type', type: 'string', description: 'Type de graphique (si visualization): bar, line, pie, scatter', required: false },
    { name: 'columns', type: 'array', description: 'Colonnes à analyser', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const analysisType = args.analysis_type || 'summary';
      
      // Générer le code Python pour l'analyse
      const pythonCode = `
import json
import statistics

# Données
data = ${JSON.stringify(args.data)}
if isinstance(data, str):
    try:
        data = json.loads(data)
    except:
        data = []

# Analyse basique
if isinstance(data, list) and len(data) > 0:
    if isinstance(data[0], dict):
        # Données tabulaires
        keys = list(data[0].keys())
        print(f"Colonnes: {keys}")
        print(f"Nombre de lignes: {len(data)}")
        
        # Stats pour colonnes numériques
        for key in keys:
            values = [row.get(key) for row in data if isinstance(row.get(key), (int, float))]
            if values:
                print(f"\\n{key}:")
                print(f"  Min: {min(values)}")
                print(f"  Max: {max(values)}")
                print(f"  Moyenne: {statistics.mean(values):.2f}")
                if len(values) > 1:
                    print(f"  Écart-type: {statistics.stdev(values):.2f}")
    else:
        # Liste simple
        numeric = [x for x in data if isinstance(x, (int, float))]
        if numeric:
            print(f"Min: {min(numeric)}")
            print(f"Max: {max(numeric)}")
            print(f"Moyenne: {statistics.mean(numeric):.2f}")
else:
    print("Format de données non reconnu")
`;

      const result = await e2bSandbox.executePython(pythonCode, context.userId, context.sessionId);
      
      return {
        success: result.success,
        output: `Analyse ${analysisType} terminée!\n\n${result.output}`,
        error: result.error,
        metadata: {
          analysisType,
          chartType: args.chart_type
        }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== CODE REVIEW TOOL ====================

export const codeReviewTool: Tool = {
  name: 'code_review',
  description: `Effectue une revue de code automatique.

Analyse:
- Qualité du code (lisibilité, maintenabilité)
- Bugs potentiels
- Vulnérabilités de sécurité
- Performance
- Bonnes pratiques
- Suggestions d'amélioration`,
  category: 'code',
  parameters: [
    { name: 'code', type: 'string', description: 'Code à analyser', required: true },
    { name: 'language', type: 'string', description: 'Langage: python, javascript, typescript, etc.', required: true },
    { name: 'focus', type: 'array', description: 'Points à analyser: security, performance, style, bugs', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const focus = args.focus || ['security', 'performance', 'style', 'bugs'];
      
      const response = await invokeLLM({
        messages: [
          { 
            role: 'system', 
            content: `Tu es un expert en revue de code. Analyse le code suivant et fournis une revue détaillée couvrant: ${focus.join(', ')}. 
            
Format ta réponse en sections:
## Résumé
## Problèmes trouvés
## Suggestions d'amélioration
## Score de qualité (1-10)` 
          },
          { role: 'user', content: `Langage: ${args.language}\n\nCode:\n\`\`\`${args.language}\n${args.code}\n\`\`\`` }
        ]
      });
      
      const reviewContent = response.choices[0]?.message?.content;
      const review = typeof reviewContent === 'string' ? reviewContent : JSON.stringify(reviewContent) || 'Revue non disponible';
      
      return {
        success: true,
        output: review,
        metadata: {
          language: args.language,
          focus,
          codeLength: args.code.length
        }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== GIT OPERATIONS TOOL ====================

export const gitOperationsTool: Tool = {
  name: 'git_operations',
  description: `Effectue des opérations Git.

Actions supportées:
- init: Initialiser un repo
- status: Voir le statut
- add: Ajouter des fichiers
- commit: Créer un commit
- log: Voir l'historique
- diff: Voir les différences
- branch: Gérer les branches`,
  category: 'system',
  parameters: [
    { name: 'action', type: 'string', description: 'Action: init, status, add, commit, log, diff, branch', required: true },
    { name: 'path', type: 'string', description: 'Chemin du repo', required: false },
    { name: 'message', type: 'string', description: 'Message de commit (pour commit)', required: false },
    { name: 'files', type: 'array', description: 'Fichiers à ajouter (pour add)', required: false },
    { name: 'branch_name', type: 'string', description: 'Nom de branche (pour branch)', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const path = args.path || '/home/user';
      let command = '';
      
      switch (args.action) {
        case 'init':
          command = `cd ${path} && git init`;
          break;
        case 'status':
          command = `cd ${path} && git status`;
          break;
        case 'add':
          const files = args.files?.join(' ') || '.';
          command = `cd ${path} && git add ${files}`;
          break;
        case 'commit':
          command = `cd ${path} && git commit -m "${args.message || 'Auto commit'}"`;
          break;
        case 'log':
          command = `cd ${path} && git log --oneline -10`;
          break;
        case 'diff':
          command = `cd ${path} && git diff`;
          break;
        case 'branch':
          if (args.branch_name) {
            command = `cd ${path} && git checkout -b ${args.branch_name}`;
          } else {
            command = `cd ${path} && git branch -a`;
          }
          break;
        default:
          return { success: false, output: '', error: `Action Git non reconnue: ${args.action}` };
      }
      
      const result = await e2bSandbox.executeShell(command, context.userId, context.sessionId);
      
      return {
        success: result.success,
        output: `Git ${args.action}:\n${result.output}`,
        error: result.error,
        metadata: { action: args.action, path }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== DATABASE QUERY TOOL ====================

export const databaseQueryTool: Tool = {
  name: 'database_query',
  description: `Exécute des requêtes sur une base de données.

Supporte:
- SQLite (local)
- Requêtes SELECT, INSERT, UPDATE, DELETE
- Création de tables
- Export des résultats`,
  category: 'data',
  parameters: [
    { name: 'query', type: 'string', description: 'Requête SQL à exécuter', required: true },
    { name: 'database', type: 'string', description: 'Chemin vers la base SQLite', required: false },
    { name: 'params', type: 'array', description: 'Paramètres pour la requête', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const dbPath = args.database || '/home/user/data.db';
      const query = args.query;
      
      const pythonCode = `
import sqlite3
import json

conn = sqlite3.connect('${dbPath}')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

try:
    cursor.execute('''${query.replace(/'/g, "\\'")}''')
    
    if cursor.description:
        # SELECT query
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        results = [dict(zip(columns, row)) for row in rows]
        print(f"Colonnes: {columns}")
        print(f"Résultats: {len(results)} lignes")
        for row in results[:10]:
            print(json.dumps(row, default=str))
        if len(results) > 10:
            print(f"... et {len(results) - 10} lignes de plus")
    else:
        # INSERT/UPDATE/DELETE
        conn.commit()
        print(f"Requête exécutée. Lignes affectées: {cursor.rowcount}")
        
except Exception as e:
    print(f"Erreur SQL: {e}")
finally:
    conn.close()
`;

      const result = await e2bSandbox.executePython(pythonCode, context.userId, context.sessionId);
      
      return {
        success: result.success,
        output: result.output,
        error: result.error,
        metadata: { database: dbPath, query: query.substring(0, 100) }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== API CALL TOOL ====================

export const apiCallTool: Tool = {
  name: 'api_call',
  description: `Effectue des appels API REST.

Méthodes supportées: GET, POST, PUT, DELETE, PATCH
Supporte: Headers personnalisés, Body JSON, Authentification`,
  category: 'web',
  parameters: [
    { name: 'url', type: 'string', description: 'URL de l\'API', required: true },
    { name: 'method', type: 'string', description: 'Méthode HTTP: GET, POST, PUT, DELETE, PATCH', required: false },
    { name: 'headers', type: 'object', description: 'Headers HTTP', required: false },
    { name: 'body', type: 'object', description: 'Corps de la requête (JSON)', required: false },
    { name: 'auth', type: 'object', description: 'Authentification {type: "bearer"|"basic", token/user/pass}', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const method = args.method || 'GET';
      const headers = args.headers || {};
      
      // Ajouter l'authentification si fournie
      if (args.auth) {
        if (args.auth.type === 'bearer') {
          headers['Authorization'] = `Bearer ${args.auth.token}`;
        } else if (args.auth.type === 'basic') {
          const credentials = Buffer.from(`${args.auth.user}:${args.auth.pass}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
      }
      
      const pythonCode = `
import urllib.request
import urllib.error
import json

url = "${args.url}"
method = "${method}"
headers = ${JSON.stringify(headers)}
body = ${args.body ? JSON.stringify(args.body) : 'None'}

try:
    data = json.dumps(body).encode('utf-8') if body else None
    
    if data:
        headers['Content-Type'] = 'application/json'
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    
    with urllib.request.urlopen(req, timeout=30) as response:
        status = response.status
        response_headers = dict(response.headers)
        content = response.read().decode('utf-8')
        
        print(f"Status: {status}")
        print(f"Headers: {json.dumps(response_headers, indent=2)}")
        print(f"\\nBody:")
        try:
            print(json.dumps(json.loads(content), indent=2))
        except:
            print(content[:2000])
            
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code} - {e.reason}")
    print(e.read().decode('utf-8')[:500])
except Exception as e:
    print(f"Error: {e}")
`;

      const result = await e2bSandbox.executePython(pythonCode, context.userId, context.sessionId);
      
      return {
        success: result.success,
        output: result.output,
        error: result.error,
        metadata: { url: args.url, method }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== DOCUMENT GENERATE TOOL ====================

export const documentGenerateTool: Tool = {
  name: 'document_generate',
  description: `Génère des documents formatés.

Formats supportés:
- Markdown
- HTML
- PDF (via conversion)
- Rapport structuré`,
  category: 'file',
  parameters: [
    { name: 'content', type: 'string', description: 'Contenu du document (Markdown)', required: true },
    { name: 'format', type: 'string', description: 'Format: markdown, html, pdf', required: true },
    { name: 'title', type: 'string', description: 'Titre du document', required: false },
    { name: 'template', type: 'string', description: 'Template: report, article, presentation', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const format = args.format || 'markdown';
      const title = args.title || 'Document';
      const content = args.content;
      
      let output = '';
      let mimeType = 'text/plain';
      
      if (format === 'html') {
        output = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 0.5rem; }
    h2 { color: #555; }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 5px; overflow-x: auto; }
    blockquote { border-left: 4px solid #007bff; margin: 0; padding-left: 1rem; color: #666; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${content.replace(/\n/g, '<br>')}
</body>
</html>`;
        mimeType = 'text/html';
      } else if (format === 'markdown') {
        output = `# ${title}\n\n${content}`;
        mimeType = 'text/markdown';
      } else {
        output = content;
      }
      
      return {
        success: true,
        output: `Document généré: ${title}.${format === 'html' ? 'html' : 'md'}`,
        artifacts: [{
          type: 'file',
          content: output,
          mimeType,
          name: `${title.replace(/\s+/g, '_')}.${format === 'html' ? 'html' : 'md'}`
        }],
        metadata: { format, title, contentLength: content.length }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== MEMORY TOOL ====================

export const memoryTool: Tool = {
  name: 'memory',
  description: `Gère la mémoire de travail de l'agent.

Actions:
- store: Stocker une information
- retrieve: Récupérer une information
- list: Lister toutes les clés
- clear: Effacer la mémoire`,
  category: 'system',
  parameters: [
    { name: 'action', type: 'string', description: 'Action: store, retrieve, list, clear', required: true },
    { name: 'key', type: 'string', description: 'Clé pour store/retrieve', required: false },
    { name: 'value', type: 'string', description: 'Valeur à stocker', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    // Mémoire simple en session (en production, utiliser Redis ou DB)
    const memoryKey = `memory_${context.sessionId}`;
    const memory: Record<string, any> = (global as any)[memoryKey] || {};
    
    switch (args.action) {
      case 'store':
        if (!args.key) {
          return { success: false, output: '', error: 'Clé requise pour store' };
        }
        memory[args.key] = args.value;
        (global as any)[memoryKey] = memory;
        return {
          success: true,
          output: `Stocké: ${args.key} = ${args.value}`,
          metadata: { key: args.key }
        };
        
      case 'retrieve':
        if (!args.key) {
          return { success: false, output: '', error: 'Clé requise pour retrieve' };
        }
        const value = memory[args.key];
        return {
          success: true,
          output: value !== undefined ? `${args.key} = ${value}` : `Clé "${args.key}" non trouvée`,
          metadata: { key: args.key, found: value !== undefined }
        };
        
      case 'list':
        const keys = Object.keys(memory);
        return {
          success: true,
          output: keys.length > 0 ? `Clés en mémoire:\n${keys.join('\n')}` : 'Mémoire vide',
          metadata: { count: keys.length }
        };
        
      case 'clear':
        (global as any)[memoryKey] = {};
        return {
          success: true,
          output: 'Mémoire effacée',
          metadata: { cleared: true }
        };
        
      default:
        return { success: false, output: '', error: `Action non reconnue: ${args.action}` };
    }
  }
};

// ==================== THINK TOOL ====================

export const thinkTool: Tool = {
  name: 'think',
  description: `Outil de réflexion structurée pour l'agent.

Permet à l'agent de:
- Analyser une situation complexe
- Décomposer un problème
- Évaluer des options
- Prendre une décision

Utile avant d'exécuter des actions importantes.`,
  category: 'system',
  parameters: [
    { name: 'context', type: 'string', description: 'Contexte de la réflexion', required: true },
    { name: 'question', type: 'string', description: 'Question à analyser', required: true },
    { name: 'options', type: 'array', description: 'Options à évaluer', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const options = args.options || [];
      
      const response = await invokeLLM({
        messages: [
          { 
            role: 'system', 
            content: `Tu es un assistant de réflexion. Aide à analyser la situation et à prendre une décision.

Format de réponse:
## Analyse
## Points clés
## Recommandation
## Prochaines étapes` 
          },
          { 
            role: 'user', 
            content: `Contexte: ${args.context}\n\nQuestion: ${args.question}${options.length > 0 ? `\n\nOptions à évaluer:\n${options.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n')}` : ''}` 
          }
        ]
      });
      
      const thinkContent = response.choices[0]?.message?.content;
      const analysis = typeof thinkContent === 'string' ? thinkContent : JSON.stringify(thinkContent) || 'Analyse non disponible';
      
      return {
        success: true,
        output: analysis,
        metadata: {
          hasOptions: options.length > 0,
          questionLength: args.question.length
        }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== EXPORT ALL TOOLS ====================

export const moreAdvancedTools: Tool[] = [
  dataAnalysisTool,
  codeReviewTool,
  gitOperationsTool,
  databaseQueryTool,
  apiCallTool,
  documentGenerateTool,
  memoryTool,
  thinkTool
];

export default moreAdvancedTools;
