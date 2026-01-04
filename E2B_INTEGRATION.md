# Phoenix - Intégration E2B Complète

## Vue d'ensemble

Phoenix est maintenant entièrement intégré avec **E2B Sandbox** pour l'exécution de code isolée et sécurisée. Cette documentation décrit les capacités et l'utilisation du système.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend React                         │
│            (E2BExecutor Component)                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              tRPC Router (e2b.ts)                        │
│  - executePython                                         │
│  - executeNode                                           │
│  - executeShell                                          │
│  - readFile / writeFile                                  │
│  - getPersistentVolume                                   │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
    ┌────────┐  ┌──────────┐  ┌────────────┐
    │E2B     │  │Monitoring│  │Persistent  │
    │Adapter │  │System    │  │Volume      │
    └────────┘  └──────────┘  └────────────┘
        │            │            │
        └────────────┼────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │   E2B Sandbox          │
        │  (Isolated Execution)  │
        └────────────────────────┘
```

## Composants Clés

### 1. E2B Adapter (`server/phoenix/e2bAdapter.ts`)

Gère la communication avec les sandboxes E2B.

**Fonctionnalités:**
- Création/gestion de sandboxes par utilisateur/conversation
- Exécution de Python, Node.js, Shell
- Gestion des fichiers (read, write, list, upload, download)
- Installation de packages
- Gestion du cycle de vie des sandboxes

**Utilisation:**
```typescript
const adapter = getE2BAdapter();

// Exécuter du Python
const result = await adapter.executePython(sandboxId, 'print("Hello")');

// Écrire un fichier
await adapter.writeFile(sandboxId, '/tmp/test.txt', 'content');

// Lire un fichier
const file = await adapter.readFile(sandboxId, '/tmp/test.txt');
```

### 2. Monitoring System (`server/phoenix/e2bMonitoring.ts`)

Suivi des exécutions et collecte de métriques.

**Métriques collectées:**
- Nombre total d'exécutions par utilisateur
- Taux de succès/échec
- Durée moyenne d'exécution
- Historique des erreurs
- Statistiques par langage

**Utilisation:**
```typescript
const monitoring = getE2BMonitoring();

// Enregistrer une exécution
monitoring.recordExecutionStart(userId, 'python');
monitoring.recordExecutionEnd(userId, 'python', true, 150);

// Obtenir les métriques
const metrics = monitoring.getUserMetrics(userId);
console.log(metrics.totalExecutions, metrics.averageDuration);
```

### 3. Persistent Volume (`server/phoenix/e2bPersistentVolume.ts`)

Stockage persistant par utilisateur pour les fichiers.

**Fonctionnalités:**
- Sauvegarde/récupération de fichiers
- Gestion des quotas (100MB par défaut)
- Listing des fichiers
- Nettoyage automatique des fichiers obsolètes
- Export/import de volumes

**Utilisation:**
```typescript
const volume = getE2BPersistentVolume();

// Sauvegarder un fichier
await volume.saveFile(userId, 'results.json', JSON.stringify(data));

// Lire un fichier
const result = await volume.getFile(userId, 'results.json');

// Obtenir les informations du volume
const info = await volume.getVolumeInfo(userId);
console.log(info.usagePercent, info.fileCount);
```

### 4. tRPC Router (`server/routers/e2b.ts`)

Endpoints tRPC pour accéder à E2B depuis le frontend.

**Endpoints disponibles:**
- `e2b.executePython` - Exécuter du code Python
- `e2b.executeNode` - Exécuter du code Node.js
- `e2b.executeShell` - Exécuter une commande shell
- `e2b.readFile` - Lire un fichier
- `e2b.writeFile` - Écrire un fichier
- `e2b.listFiles` - Lister les fichiers
- `e2b.getSandboxInfo` - Obtenir les infos de la sandbox
- `e2b.closeSandbox` - Fermer une sandbox
- `e2b.getStats` - Obtenir les statistiques
- `e2b.getPersistentVolume` - Obtenir les infos du volume persistant
- `e2b.saveToPersistentVolume` - Sauvegarder dans le volume
- `e2b.readFromPersistentVolume` - Lire du volume
- `e2b.listPersistentVolume` - Lister le volume

## Utilisation Frontend

### Composant E2BExecutor

Composant React complet pour exécuter du code.

```typescript
import { E2BExecutor } from '@/components/E2BExecutor';

export function MyPage() {
  return (
    <E2BExecutor 
      conversationId="conv-123"
      onExecute={(result) => console.log(result)}
    />
  );
}
```

**Fonctionnalités:**
- Interface d'édition de code avec onglets (Python/Node/Shell)
- Exécution avec feedback en temps réel
- Affichage des résultats (stdout/stderr)
- Copie des résultats
- Statistiques d'exécution

## Flux de Travail Complet

### 1. Exécution de Code

```typescript
// Frontend
const result = await trpc.e2b.executePython.mutate({
  code: 'print("Hello")',
  conversationId: 'conv-123'
});

// Backend
1. Crée/récupère une sandbox E2B pour l'utilisateur
2. Exécute le code dans la sandbox
3. Enregistre les métriques
4. Retourne le résultat (stdout/stderr/exitCode)
```

### 2. Persistance de Données

```typescript
// Sauvegarder un résultat
await trpc.e2b.saveToPersistentVolume.mutate({
  filename: 'results.json',
  content: JSON.stringify(data)
});

// Récupérer plus tard
const file = await trpc.e2b.readFromPersistentVolume.query({
  filename: 'results.json'
});
```

### 3. Suivi des Performances

```typescript
// Obtenir les statistiques
const stats = await trpc.e2b.getStats.query();

console.log(stats.user.totalExecutions);      // 42
console.log(stats.user.averageDuration);      // 150ms
console.log(stats.user.successRate);          // 95%
```

## Sécurité

- **Isolation:** Chaque exécution se fait dans une sandbox E2B complètement isolée
- **Timeout:** 60 secondes par exécution
- **Ressources:** Gestion automatique des ressources
- **Quotas:** 100MB de stockage persistant par utilisateur
- **Logging:** Toutes les exécutions sont enregistrées pour audit

## Tests

Suite de tests complète avec 20 tests passants:

```bash
pnpm test server/routers/e2b.test.ts
```

**Couverture:**
- Tests E2B Adapter (Python, Node, Shell)
- Tests Monitoring
- Tests Persistent Volume
- Tests d'intégration
- Tests de résilience

## Performance

- **Création de sandbox:** ~2-3 secondes
- **Exécution Python simple:** ~300-500ms
- **Exécution Node.js:** ~1-2 secondes
- **Exécution Shell:** ~200-400ms

## Limitations

- Timeout de 60 secondes par exécution
- 100MB de stockage persistant par utilisateur
- Pas d'accès réseau direct (utiliser les APIs)
- Pas d'accès à la base de données locale

## Prochaines Étapes

1. **Intégration avec le Chat** - Permettre à Phoenix de demander l'exécution de code
2. **Webhooks** - Notifier l'utilisateur quand une exécution est terminée
3. **Historique** - Conserver l'historique des exécutions
4. **Partage** - Permettre de partager les résultats d'exécution
5. **Scheduling** - Exécuter du code à des heures précises

## Ressources

- [E2B Documentation](https://e2b.dev)
- [tRPC Documentation](https://trpc.io)
- [Phoenix Architecture](./AUTONOMOUS_SYSTEM.md)
