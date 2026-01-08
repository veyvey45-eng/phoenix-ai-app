# Analyse: Pourquoi Phoenix est limité à 5 actions par requête

## 🔍 Diagnostic du Problème

### Le Problème Actuel

Après analyse du code, voici **exactement** pourquoi Phoenix est limité:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE ACTUELLE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Requête HTTP ──► tRPC Router ──► Agent Loop ──► Réponse HTTP   │
│       │                              │                           │
│       │                              │                           │
│       │         TIMEOUT 30s          │                           │
│       │    ◄─────────────────────►   │                           │
│       │                              │                           │
│       └──────────────────────────────┘                           │
│                                                                  │
│  Chaque requête = nouvelle instance = état perdu                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Les 5 Limitations Identifiées

#### 1. **Timeout HTTP (30 secondes)**

```typescript
// server/routers.ts - Chaque requête HTTP a un timeout
.mutation(async ({ ctx, input }) => {
  // Si l'agent prend plus de 30s, la connexion est coupée
  const result = await processPhoenixQuery(input.message);
  return result; // Doit retourner AVANT le timeout
});
```

**Problème:** Une action complexe (recherche web + exécution code + génération image) prend facilement 45-60 secondes.

#### 2. **État Non Persistant**

```typescript
// server/phoenix/agentCore.ts
const activeAgents: Map<string, AgentState> = new Map();
// ⚠️ Cette Map est en MÉMOIRE
// Si le serveur redémarre ou si la requête se termine, l'état est PERDU
```

**Problème:** L'état de l'agent vit uniquement pendant la durée de la requête HTTP.

#### 3. **Pas de Worker Background**

```typescript
// server/routers/agentRouter.ts
.mutation(async ({ ctx, input }) => {
  // L'agent s'exécute DANS la requête HTTP
  runAgent(input.taskId, ctx.user.openId, sessionId, onEvent)
    .then((completedAgent) => {
      // Ceci ne s'exécute que si la requête n'a pas timeout
    });
});
```

**Problème:** L'agent n'a pas de processus indépendant qui tourne en arrière-plan.

#### 4. **Streaming SSE Unidirectionnel**

```typescript
// server/routers/streamingRouter.ts
.subscription(({ input }) => {
  return observable<string>(emit => {
    // Streaming SERVEUR → CLIENT uniquement
    // Pas de possibilité d'interrompre ou modifier en cours
  });
});
```

**Problème:** L'utilisateur ne peut pas interagir avec l'agent pendant son exécution.

#### 5. **Limite de maxIterations Trop Basse**

```typescript
// server/phoenix/agentCore.ts
const DEFAULT_CONFIG: AgentConfig = {
  maxIterations: 30,    // Limité à 30
  maxToolCalls: 40,     // Limité à 40
  timeout: 5 * 60 * 1000 // 5 minutes max
};
```

**Problème:** Même si on résolvait les autres problèmes, la config limite à 30-40 actions.

---

## 🎯 Comment Manus Fonctionne (Ce qu'on doit copier)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE MANUS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────────────────────────────┐    │
│  │   Client    │     │         WORKER BACKGROUND           │    │
│  │  (Browser)  │◄───►│                                     │    │
│  └─────────────┘     │  ┌─────────────────────────────┐   │    │
│        │             │  │      BOUCLE D'AGENT         │   │    │
│        │             │  │                             │   │    │
│   WebSocket          │  │  while (!completed) {      │   │    │
│   Bidirectionnel     │  │    think();               │   │    │
│        │             │  │    act();                 │   │    │
│        ▼             │  │    observe();            │   │    │
│  ┌─────────────┐     │  │    checkpoint();         │   │    │
│  │  Task Queue │     │  │  }                       │   │    │
│  │   (Redis)   │     │  └─────────────────────────────┘   │    │
│  └─────────────┘     │                                     │    │
│        │             │  État persisté en DB + Redis        │    │
│        ▼             │                                     │    │
│  ┌─────────────┐     └─────────────────────────────────────┘    │
│  │  Database   │                                                 │
│  │  (State)    │                                                 │
│  └─────────────┘                                                 │
│                                                                  │
│  ✅ Pas de timeout HTTP                                          │
│  ✅ État persistant                                               │
│  ✅ Reprise après interruption                                    │
│  ✅ Communication bidirectionnelle                                │
│  ✅ 50+ actions possibles                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Solution: Architecture de la Boucle Persistante

### Composants à Implémenter

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOUVELLE ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. TASK QUEUE (File d'attente des tâches)                      │
│     - Stocke les tâches à exécuter                              │
│     - Persiste en base de données                               │
│     - Permet la reprise après crash                             │
│                                                                  │
│  2. PERSISTENT WORKER (Worker background)                       │
│     - Tourne en continu (pas de timeout)                        │
│     - Exécute les tâches de la queue                            │
│     - Sauvegarde l'état après chaque action                     │
│                                                                  │
│  3. STATE MANAGER (Gestionnaire d'état)                         │
│     - Persiste l'état en base de données                        │
│     - Permet les checkpoints                                    │
│     - Permet la reprise après interruption                      │
│                                                                  │
│  4. WEBSOCKET SERVER (Communication bidirectionnelle)           │
│     - Streaming en temps réel                                   │
│     - Permet l'interruption par l'utilisateur                   │
│     - Permet l'ajout de messages pendant l'exécution            │
│                                                                  │
│  5. CHECKPOINT SYSTEM (Sauvegarde d'état)                       │
│     - Sauvegarde après chaque action                            │
│     - Permet le rollback en cas d'erreur                        │
│     - Permet la reprise exacte                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Flux d'Exécution

```
1. Utilisateur envoie une tâche
   │
   ▼
2. Tâche ajoutée à la TASK QUEUE (persistée en DB)
   │
   ▼
3. WORKER récupère la tâche
   │
   ▼
4. BOUCLE D'AGENT (sans timeout)
   │
   ├──► Think (réflexion)
   │      │
   │      ▼
   ├──► Act (exécution d'outil)
   │      │
   │      ▼
   ├──► Observe (analyse du résultat)
   │      │
   │      ▼
   ├──► Checkpoint (sauvegarde état en DB)
   │      │
   │      ▼
   ├──► Notify (envoi via WebSocket)
   │      │
   │      ▼
   └──► Continue ou Complete
   │
   ▼
5. Résultat final envoyé à l'utilisateur
```

---

## 📝 Schéma de Base de Données

```sql
-- Table des tâches d'agent
CREATE TABLE agent_tasks (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  goal TEXT NOT NULL,
  status ENUM('pending', 'running', 'paused', 'completed', 'failed') DEFAULT 'pending',
  current_phase VARCHAR(255),
  config JSON,
  result TEXT,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Table des étapes d'agent
CREATE TABLE agent_steps (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  step_number INT NOT NULL,
  type ENUM('think', 'plan', 'tool_call', 'observe', 'answer'),
  content TEXT,
  tool_name VARCHAR(255),
  tool_args JSON,
  tool_result JSON,
  status ENUM('pending', 'executing', 'completed', 'failed'),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INT,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
);

-- Table des checkpoints
CREATE TABLE agent_checkpoints (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  step_number INT NOT NULL,
  state JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
);

-- Table des artifacts
CREATE TABLE agent_artifacts (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  content TEXT,
  url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
);
```

---

## 🔧 Implémentation

### 1. Task Queue

```typescript
// server/phoenix/persistentAgent/taskQueue.ts
export class TaskQueue {
  async enqueue(task: AgentTask): Promise<string> {
    // Persister en DB
    await db.insert(agentTasks).values(task);
    return task.id;
  }

  async dequeue(): Promise<AgentTask | null> {
    // Récupérer la prochaine tâche en attente
    const task = await db.query.agentTasks.findFirst({
      where: eq(agentTasks.status, 'pending'),
      orderBy: asc(agentTasks.createdAt)
    });
    if (task) {
      await db.update(agentTasks)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(agentTasks.id, task.id));
    }
    return task;
  }
}
```

### 2. Persistent Worker

```typescript
// server/phoenix/persistentAgent/worker.ts
export class PersistentWorker {
  private running = false;
  private currentTask: AgentTask | null = null;

  async start() {
    this.running = true;
    console.log('[PersistentWorker] Started');
    
    while (this.running) {
      const task = await this.taskQueue.dequeue();
      
      if (task) {
        this.currentTask = task;
        await this.executeTask(task);
        this.currentTask = null;
      } else {
        // Attendre avant de re-vérifier
        await this.sleep(1000);
      }
    }
  }

  async executeTask(task: AgentTask) {
    let iteration = 0;
    const maxIterations = task.config?.maxIterations || 100;

    while (iteration < maxIterations && task.status === 'running') {
      iteration++;
      
      // 1. Think
      const thought = await this.think(task);
      
      // 2. Act
      if (thought.action.type === 'tool_call') {
        const result = await this.act(thought.action);
        
        // 3. Observe
        await this.observe(task, result);
        
        // 4. Checkpoint (CRITIQUE!)
        await this.checkpoint(task, iteration);
        
        // 5. Notify via WebSocket
        await this.notify(task, { type: 'step_complete', iteration });
      } else if (thought.action.type === 'answer') {
        task.status = 'completed';
        task.result = thought.action.answer;
        break;
      }
    }

    await this.completeTask(task);
  }

  async checkpoint(task: AgentTask, stepNumber: number) {
    // Sauvegarder l'état complet en DB
    await db.insert(agentCheckpoints).values({
      id: generateId(),
      taskId: task.id,
      stepNumber,
      state: JSON.stringify({
        steps: task.steps,
        memory: task.memory,
        artifacts: task.artifacts
      })
    });
  }
}
```

### 3. WebSocket Server

```typescript
// server/phoenix/persistentAgent/websocket.ts
export class AgentWebSocket {
  private connections: Map<string, WebSocket> = new Map();

  handleConnection(ws: WebSocket, userId: string) {
    this.connections.set(userId, ws);
    
    ws.on('message', async (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'interrupt') {
        await this.interruptTask(message.taskId);
      } else if (message.type === 'add_message') {
        await this.addMessageToTask(message.taskId, message.content);
      }
    });
  }

  async notify(userId: string, event: AgentEvent) {
    const ws = this.connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }
}
```

---

## 📊 Comparaison Avant/Après

| Aspect | Avant (Actuel) | Après (Nouveau) |
|--------|----------------|-----------------|
| **Timeout** | 30s HTTP | Aucun (worker background) |
| **Max Actions** | 5-10 | 100+ |
| **Persistance** | Mémoire (perdu) | Base de données |
| **Reprise** | Impossible | Depuis checkpoint |
| **Interruption** | Impossible | Via WebSocket |
| **Communication** | SSE unidirectionnel | WebSocket bidirectionnel |
| **Parallélisation** | Non | Oui (multiple workers) |

---

## 🚀 Plan d'Implémentation

### Phase 1: Base de données (1 jour)
- [ ] Créer les tables agent_tasks, agent_steps, agent_checkpoints
- [ ] Créer les fonctions CRUD

### Phase 2: Task Queue (0.5 jour)
- [ ] Implémenter TaskQueue
- [ ] Tests unitaires

### Phase 3: Persistent Worker (1 jour)
- [ ] Implémenter PersistentWorker
- [ ] Intégrer avec agentCore existant
- [ ] Système de checkpoint

### Phase 4: WebSocket (0.5 jour)
- [ ] Serveur WebSocket
- [ ] Intégration client
- [ ] Gestion des interruptions

### Phase 5: Intégration UI (0.5 jour)
- [ ] Composant de suivi en temps réel
- [ ] Boutons pause/resume/cancel
- [ ] Affichage des checkpoints

### Phase 6: Tests (0.5 jour)
- [ ] Test 10 actions
- [ ] Test 30 actions
- [ ] Test 50+ actions
- [ ] Test reprise après interruption

**Total estimé: 4 jours**

---

## ✅ Résultat Attendu

Après implémentation, Phoenix pourra:

1. **Exécuter 100+ actions** sans timeout
2. **Sauvegarder l'état** après chaque action
3. **Reprendre** exactement où il s'est arrêté
4. **Être interrompu** par l'utilisateur à tout moment
5. **Recevoir des messages** pendant l'exécution
6. **Fonctionner en arrière-plan** même si l'utilisateur ferme le navigateur
