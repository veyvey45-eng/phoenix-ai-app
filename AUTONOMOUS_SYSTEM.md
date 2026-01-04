# Phoenix - Système Autonome et Persistant

## Vue d'ensemble

Phoenix a été transformé en **environnement de développement autonome et persistant** capable de:

1. **Maintenir son état** entre les conversations
2. **S'auto-corriger** automatiquement en cas d'erreur
3. **Exécuter des tâches complexes** (OS, web, code)
4. **Persister les fichiers** créés
5. **Afficher visuellement** son processus de réflexion

---

## Architecture

### 1. Orchestrateur Principal (`orchestrator.ts`)

L'orchestrateur coordonne les 4 modules avancés:

```typescript
const orchestrator = getOrchestrator();

const result = await orchestrator.executeTask({
  userId: 'user-123',
  conversationId: 'conv-456',
  taskType: 'auto_correction', // ou 'os_command', 'web_interaction', 'code_execution'
  content: 'Exécute cette commande: ls -la',
});
```

**Responsabilités:**
- Détection automatique du type de tâche
- Routage vers le module approprié
- Gestion de la boucle de rétroaction (max 3 tentatives)
- Logging et monitoring complet

### 2. Persistance d'État (`persistentState.ts`)

Sauvegarde l'état de Phoenix entre les exécutions:

```typescript
import { persistentState } from './persistentState';

// Sauvegarder une variable
await persistentState.setVariable(userId, sessionId, 'myVar', 'myValue');

// Récupérer une session
const session = persistentState.getSession(userId, sessionId);
console.log(session.variables.get('myVar')); // 'myValue'

// Sauvegarder un fichier
await persistentState.saveFile(userId, sessionId, 'file.txt', 'contenu');
```

**Caractéristiques:**
- Stockage en mémoire avec persistance fichier
- Gestion automatique des sessions
- Nettoyage des anciennes sessions (24h)
- Limite de 100 sessions actives

### 3. Auto-Correction (`autoCorrection.ts`)

Détecte et corrige automatiquement les erreurs:

```typescript
import { autoCorrection } from './autoCorrection';

// Analyser une erreur
const analysis = autoCorrection.analyzeError('SyntaxError: invalid syntax');
console.log(analysis.recoverable); // true
console.log(analysis.severity); // 'high'

// Générer une correction
const correctedCode = await autoCorrection.generateCorrection(
  'demande originale',
  'code avec erreur',
  'message d\'erreur',
  1 // numéro de tentative
);
```

**Types d'erreurs gérées:**
- SyntaxError (récupérable)
- ImportError (récupérable)
- TypeError (récupérable)
- ValueError (récupérable)
- IndexError (récupérable)
- KeyError (récupérable)
- FileNotFoundError (récupérable)
- PermissionError (non-récupérable)
- TimeoutError (récupérable)

### 4. Accès OS (`osAccess.ts`)

Exécute des commandes shell sécurisées:

```typescript
import { osAccess } from './osAccess';

// Exécuter une commande
const result = await osAccess.executeCommand('ls -la', userId);
console.log(result.stdout); // Sortie de la commande
console.log(result.stderr); // Erreurs (si présentes)
console.log(result.exitCode); // Code de sortie

// Lister un répertoire
const dirResult = await osAccess.listDirectory('/home', userId);

// Lire un fichier
const fileResult = await osAccess.readFile('/path/to/file.txt', userId);

// Vérifier si un fichier existe
const exists = await osAccess.fileExists('/path/to/file.txt', userId);
```

**Sécurité:**
- Whitelist de commandes autorisées
- Blocage des patterns dangereux (rm -rf /, sudo, etc.)
- Timeout de 60 secondes par défaut
- Limite de sortie: 10MB
- Historique d'exécution tracé

### 5. Automation Web (`webAutomation.ts`)

Automatise les interactions web avec Puppeteer:

```typescript
import { webAutomation } from './webAutomation';

// Créer une session de navigateur
const session = await webAutomation.createSession(userId, sessionId);

// Créer une page
const page = await webAutomation.createPage(sessionId, pageId);

// Naviguer vers une URL
const navResult = await webAutomation.navigateTo(sessionId, pageId, 'https://example.com');

// Cliquer sur un élément
const clickResult = await webAutomation.click(sessionId, pageId, 'button.submit');

// Prendre une capture d'écran
const screenshotResult = await webAutomation.screenshot(sessionId, pageId, 'screenshot.png');

// Évaluer du JavaScript
const evalResult = await webAutomation.evaluate(sessionId, pageId, 'document.title');

// Attendre un élément
const waitResult = await webAutomation.waitForSelector(sessionId, pageId, '.result');
```

**Fonctionnalités:**
- Gestion de sessions multiples
- Support des pages multiples par session
- Screenshots complets
- Évaluation JavaScript
- Attentes intelligentes
- Limite de 5 sessions simultanées

### 6. Checkpoint E2B (`e2bCheckpoint.ts`)

Sauvegarde et restaure l'état complet du sandbox:

```typescript
import { getCheckpointManager } from './e2bCheckpoint';

const checkpointManager = getCheckpointManager();

// Sauvegarder un checkpoint
const checkpointId = await checkpointManager.saveCheckpoint(
  conversationId,
  userId,
  {
    variables: { /* état */ },
    files: [],
    environment: {},
    workingDirectory: '/home',
  },
  [], // historique d'exécution
  {
    version: '1.0',
    e2bVersion: '1.0',
    pythonVersion: '3.11',
    nodeVersion: '18.0',
  }
);

// Charger le dernier checkpoint
const checkpoint = await checkpointManager.loadLatestCheckpoint(conversationId);

// Charger un checkpoint spécifique
const specificCheckpoint = await checkpointManager.loadCheckpointById(checkpointId);

// Lister tous les checkpoints
const checkpoints = await checkpointManager.listCheckpoints(conversationId);

// Restaurer un checkpoint
const restored = await checkpointManager.restoreCheckpoint(checkpoint);

// Supprimer un checkpoint
await checkpointManager.deleteCheckpoint(checkpointId);
```

**Gestion:**
- Sauvegarde dans SQLite + fichier système
- Historique des versions (max 10 par conversation)
- Nettoyage automatique des anciens checkpoints
- Statistiques complètes

### 7. Volume Persistant (`persistentVolume.ts`)

Gère un volume persistant dédié pour les fichiers:

```typescript
import { getVolumeManager } from './persistentVolume';

const volumeManager = getVolumeManager();

// Créer ou obtenir un volume
const volume = volumeManager.getOrCreateVolume(volumeId);

// Sauvegarder un fichier
const file = await volume.saveFile('path/to/file.txt', 'contenu');

// Récupérer un fichier
const retrievedFile = await volume.getFile('path/to/file.txt');

// Lister les fichiers
const files = await volume.listFiles('path/');

// Créer un répertoire
await volume.createDirectory('path/to/dir');

// Supprimer un fichier
await volume.deleteFile('path/to/file.txt');

// Exporter le volume
const exported = await volume.exportVolume();

// Importer du contenu
const imported = await volume.importVolume(exported);

// Obtenir les statistiques
const stats = await volume.getStats();
console.log(stats.totalFiles); // Nombre de fichiers
console.log(stats.totalSize); // Taille totale
```

**Caractéristiques:**
- Limite de 100MB par volume
- Gestion automatique des répertoires
- Export/Import de contenu
- Statistiques détaillées
- Nettoyage complet

### 8. Indicateur Visuel (`ReflectionIndicator.tsx`)

Affiche l'état de réflexion/auto-correction:

```typescript
import { ReflectionIndicator, useReflectionState } from '@/components/ReflectionIndicator';

export function MyComponent() {
  const { state, setThinking, setAutoCorrect, setExecuting, setIdle } = useReflectionState();

  // Afficher l'indicateur
  return (
    <div>
      <ReflectionIndicator state={state} compact={true} />
      
      <button onClick={() => setThinking('Phoenix réfléchit...')}>
        Commencer à réfléchir
      </button>
      
      <button onClick={() => setAutoCorrect(1, 3, 'Correction en cours')}>
        Auto-correction
      </button>
      
      <button onClick={() => setExecuting('code_execution', 'Exécution du code', 50)}>
        Exécuter
      </button>
      
      <button onClick={() => setIdle()}>
        Terminer
      </button>
    </div>
  );
}
```

**États supportés:**
- `thinking`: Phoenix réfléchit
- `auto_correcting`: Boucle d'auto-correction (affiche 1/3, 2/3, 3/3)
- `executing`: Exécution en cours
- `idle`: Inactif

---

## Flux d'Exécution Complet

### Exemple: Exécution d'une tâche avec auto-correction

```
1. Utilisateur: "Exécute ce code Python: print(hello)"
   ↓
2. Orchestrateur détecte: taskType = 'code_execution'
   ↓
3. Orchestrateur charge l'état persistant
   ↓
4. Tentative 1: Exécution du code
   ❌ Erreur: NameError: name 'hello' is not defined
   ↓
5. Auto-Correction détecte: Erreur récupérable
   ↓
6. Auto-Correction génère le code corrigé: print("hello")
   ↓
7. Tentative 2: Exécution du code corrigé
   ✅ Succès: Output = "hello"
   ↓
8. Sauvegarde du checkpoint
   ↓
9. Sauvegarde dans le volume persistant
   ↓
10. Retour du résultat à l'utilisateur
```

---

## Intégration avec le Chat

### Dans `streamingChat.ts`:

```typescript
import { getOrchestrator } from './phoenix/orchestrator';

export async function processPhoenixTask(content: string, userId: string, conversationId: string) {
  const orchestrator = getOrchestrator();
  
  // Détecter le type de tâche
  const taskType = orchestrator.detectTaskType(content);
  
  // Exécuter la tâche
  const result = await orchestrator.executeTask({
    userId,
    conversationId,
    taskType,
    content,
  });
  
  return result;
}
```

### Dans `core.ts`:

```typescript
import { getOrchestrator } from './phoenix/orchestrator';

export async function generateHypothesis(prompt: string, userId: string, conversationId: string) {
  const orchestrator = getOrchestrator();
  
  // Charger l'état persistant
  const state = await persistentState.getSession(userId, conversationId);
  
  // Générer l'hypothèse avec le contexte
  const hypothesis = await invokeLLM({
    messages: [
      { role: 'system', content: 'Tu es Phoenix...' },
      { role: 'user', content: prompt },
    ],
  });
  
  // Sauvegarder dans l'état persistant
  await persistentState.setVariable(userId, conversationId, 'lastHypothesis', hypothesis);
  
  return hypothesis;
}
```

---

## Tests

Exécuter les tests du système autonome:

```bash
pnpm test server/phoenix/autonomousSystem.test.ts
```

**Couverture:**
- ✅ Détection de type de tâche
- ✅ Persistance d'état
- ✅ Auto-correction
- ✅ Accès OS
- ✅ Checkpoint E2B
- ✅ Volume persistant
- ✅ Orchestration
- ✅ Résilience
- ✅ Flux autonome complet

---

## Monitoring et Debugging

### Logs

Tous les modules enregistrent leurs actions:

```
[Orchestrator] Tentative 1/3
[Orchestrator] Routage vers Code Execution
[AutoCorrection] Erreur détectée: SyntaxError
[AutoCorrection] Tentative d'auto-correction...
[Orchestrator] Code corrigé, nouvelle tentative...
[Orchestrator] Tâche réussie en 1234ms après 2 tentative(s)
```

### Statistiques

```typescript
// Orchestrateur
const log = orchestrator.getExecutionLog();

// Auto-Correction
const stats = autoCorrection.getStats();

// OS Access
const osStats = osAccess.getStats();

// Checkpoint
const checkpointStats = await checkpointManager.getStats();

// Volume
const volumeStats = await volume.getStats();
```

---

## Limitations et Considérations

1. **Taille du volume**: Limite de 100MB par volume
2. **Nombre de sessions**: Max 100 sessions actives
3. **Timeout OS**: 60 secondes par défaut
4. **Sessions web**: Max 5 simultanées
5. **Tentatives d'auto-correction**: Max 3 par tâche
6. **Historique**: Gardé 24 heures

---

## Prochaines Étapes

Pour étendre le système:

1. **Intégrer E2B Sandbox réel** pour l'exécution de code isolée
2. **Ajouter des outils supplémentaires** (API, base de données, etc.)
3. **Implémenter la synchronisation cloud** pour la persistance distribuée
4. **Ajouter le machine learning** pour l'amélioration continue
5. **Créer des workflows complexes** multi-étapes

---

## Support et Documentation

- **Orchestrateur**: `server/phoenix/orchestrator.ts`
- **Persistance**: `server/phoenix/persistentState.ts`
- **Auto-Correction**: `server/phoenix/autoCorrection.ts`
- **OS Access**: `server/phoenix/osAccess.ts`
- **Web Automation**: `server/phoenix/webAutomation.ts`
- **Checkpoint**: `server/phoenix/e2bCheckpoint.ts`
- **Volume**: `server/phoenix/persistentVolume.ts`
- **UI**: `client/src/components/ReflectionIndicator.tsx`
- **Tests**: `server/phoenix/autonomousSystem.test.ts`
