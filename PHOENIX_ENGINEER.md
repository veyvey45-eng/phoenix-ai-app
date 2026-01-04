# Phoenix Engineer Module - Documentation Complète

## 🎯 Vue d'ensemble

Phoenix est maintenant transformé en **ingénieur logiciel complet** capable de:

1. **Générer des pages web** - HTML/CSS/React avec Tailwind
2. **Créer des projets multi-fichiers** - Structure complète avec package.json
3. **Gérer les dépendances** - npm/yarn/pnpm avec audit de sécurité
4. **Déployer automatiquement** - Manus, Vercel, Netlify, Railway, Render, Heroku
5. **Monitorer les performances** - Métriques, erreurs, alertes en temps réel

## 📦 Architecture

### Modules Principaux

```
server/phoenix/
├── engineerModule.ts          # Orchestrateur principal
├── webPageGenerator.ts         # Génération de pages web
├── projectGenerator.ts         # Génération de projets
├── dependencyManager.ts        # Gestion des dépendances
├── deploymentManager.ts        # Déploiement automatique
├── advancedMonitoring.ts       # Monitoring et métriques
└── engineerModule.test.ts      # Tests complets

server/routers/
└── engineer.ts                 # Endpoints tRPC (7 endpoints)
```

### Endpoints tRPC Disponibles

#### 1. `engineer.getCapabilities()`
Obtient les capacités de Phoenix Engineer

**Réponse:**
```typescript
{
  canGeneratePages: true,
  canGenerateProjects: true,
  canManageDependencies: true,
  canDeploy: true,
  canMonitor: true,
  supportedPlatforms: ['manus', 'vercel', 'netlify', 'railway', 'render', 'heroku'],
  supportedLanguages: ['typescript', 'javascript', 'python', 'node.js', 'react', 'next.js']
}
```

#### 2. `engineer.generateWebPage()`
Génère une page web complète

**Entrée:**
```typescript
{
  description: string;           // Description de la page
  pageType: 'landing' | 'dashboard' | 'blog' | 'ecommerce' | 'portfolio' | 'custom';
  colorScheme?: 'light' | 'dark' | 'auto';
  components?: string[];         // Composants à inclure
  sections?: string[];           // Sections de la page
}
```

**Réponse:**
```typescript
{
  success: boolean;
  page?: {
    html: string;              // HTML complet
    tsx: string;               // Composant React
    css: string;               // Styles Tailwind
    metadata: {
      title: string;
      description: string;
      components: string[];
      sections: string[];
      responsive: boolean;
    }
  };
  error?: string;
}
```

#### 3. `engineer.generateProject()`
Génère un projet complet multi-fichiers

**Entrée:**
```typescript
{
  name: string;                                    // Nom du projet
  description: string;                             // Description
  projectType: 'react-app' | 'next-app' | 'express-api' | 'full-stack' | 'static-site';
  features?: string[];                             // Features à inclure
  database?: 'none' | 'postgresql' | 'mongodb' | 'sqlite';
  authentication?: boolean;                        // Ajouter l'authentification
  styling?: 'tailwind' | 'bootstrap' | 'material-ui' | 'none';
}
```

**Réponse:**
```typescript
{
  success: boolean;
  project?: {
    name: string;
    structure: {
      root: string;
      directories: string[];
      files: string[];
    };
    files: Map<string, string>;  // Contenu des fichiers
    packageJson: {
      name: string;
      version: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    metadata: {
      createdAt: number;
      features: string[];
      database: string;
      authentication: boolean;
      styling: string;
    }
  };
  error?: string;
}
```

#### 4. `engineer.installDependencies()`
Installe les dépendances d'un projet

**Entrée:**
```typescript
{
  projectPath: string;  // Chemin du projet
}
```

**Réponse:**
```typescript
{
  success: boolean;
  result?: {
    success: boolean;
    installed: string[];   // Packages installés
    failed: string[];      // Packages échoués
    warnings: string[];
    duration: number;      // Temps en ms
  };
  error?: string;
}
```

#### 5. `engineer.deployApplication()`
Déploie une application

**Entrée:**
```typescript
{
  projectPath: string;
  projectName: string;
  platform: 'manus' | 'vercel' | 'netlify' | 'railway' | 'render' | 'heroku';
  environment: 'development' | 'staging' | 'production';
  buildCommand?: string;
  startCommand?: string;
}
```

**Réponse:**
```typescript
{
  success: boolean;
  result?: {
    success: boolean;
    platform: string;
    url?: string;
    deploymentId?: string;
    buildTime: number;
    deployTime: number;
    logs: string[];
    errors: string[];
  };
  error?: string;
}
```

#### 6. `engineer.getMonitoringDashboard()`
Obtient le dashboard de monitoring

**Entrée:**
```typescript
{
  period?: 'hour' | 'day' | 'week' | 'month';  // Défaut: 'hour'
}
```

**Réponse:**
```typescript
{
  success: boolean;
  dashboard?: {
    period: string;
    metrics: PerformanceMetric[];
    errors: ErrorMetric[];
    resources: ResourceMetric[];
    events: AnalyticsEvent[];
    alerts: Alert[];
    summary: {
      totalExecutions: number;
      successRate: number;
      averageDuration: number;
      errorCount: number;
      alertCount: number;
    }
  };
  error?: string;
}
```

#### 7. `engineer.getTaskStatus()` / `engineer.getAllTasks()`
Obtient l'état des tâches

## 🚀 Utilisation

### Exemple 1: Générer une page web

```typescript
const response = await trpc.engineer.generateWebPage.mutate({
  description: "Une landing page moderne pour une startup SaaS",
  pageType: 'landing',
  colorScheme: 'dark',
  components: ['Hero', 'Features', 'Pricing', 'CTA'],
  sections: ['header', 'hero', 'features', 'pricing', 'footer']
});

if (response.success) {
  console.log('Page générée:', response.page?.metadata.title);
  console.log('HTML:', response.page?.html);
  console.log('React:', response.page?.tsx);
}
```

### Exemple 2: Générer un projet complet

```typescript
const response = await trpc.engineer.generateProject.mutate({
  name: 'my-awesome-app',
  description: 'Une application web moderne avec authentification',
  projectType: 'full-stack',
  features: ['user-auth', 'real-time-chat', 'file-upload'],
  database: 'postgresql',
  authentication: true,
  styling: 'tailwind'
});

if (response.success) {
  console.log('Projet créé:', response.project?.name);
  console.log('Fichiers:', response.project?.files.size);
}
```

### Exemple 3: Installer les dépendances

```typescript
const response = await trpc.engineer.installDependencies.mutate({
  projectPath: '/path/to/project'
});

if (response.success) {
  console.log('Dépendances installées:', response.result?.installed.length);
  console.log('Durée:', response.result?.duration, 'ms');
}
```

### Exemple 4: Déployer une application

```typescript
const response = await trpc.engineer.deployApplication.mutate({
  projectPath: '/path/to/project',
  projectName: 'my-awesome-app',
  platform: 'vercel',
  environment: 'production'
});

if (response.success) {
  console.log('Déployé sur:', response.result?.url);
  console.log('Temps de déploiement:', response.result?.deployTime, 'ms');
}
```

### Exemple 5: Obtenir les métriques

```typescript
const response = await trpc.engineer.getMonitoringDashboard.query({
  period: 'day'
});

if (response.success) {
  const { summary } = response.dashboard;
  console.log('Total exécutions:', summary.totalExecutions);
  console.log('Taux de succès:', summary.successRate, '%');
  console.log('Durée moyenne:', summary.averageDuration, 'ms');
  console.log('Erreurs:', summary.errorCount);
}
```

## 📊 Monitoring et Métriques

### Types de Métriques Collectées

1. **Performance Metrics**
   - Durée d'exécution
   - Utilisation mémoire
   - Utilisation CPU
   - Taille des builds

2. **Error Metrics**
   - Type d'erreur
   - Message d'erreur
   - Stack trace
   - Sévérité (low, medium, high, critical)

3. **Resource Metrics**
   - Mémoire utilisée
   - CPU utilisé
   - Disque utilisé
   - Réseau (in/out)

4. **Analytics Events**
   - Page générée
   - Projet créé
   - Dépendances installées
   - Application déployée

5. **Alerts**
   - Seuils dépassés
   - Erreurs critiques
   - Utilisation excessive de ressources

### Accès aux Métriques

```typescript
// Obtenir le dashboard
const dashboard = await trpc.engineer.getMonitoringDashboard.query({ period: 'day' });

// Analyser les données
console.log('Succès rate:', dashboard.summary.successRate);
console.log('Erreurs:', dashboard.errors);
console.log('Alertes non résolues:', dashboard.alerts.filter(a => !a.resolved));
```

## 🔧 Configuration

### Variables d'Environnement Requises

```bash
# E2B Sandbox (pour l'exécution de code)
E2B_API_KEY=your_e2b_api_key

# LLM (pour la génération de contenu)
GOOGLE_AI_STUDIO_API_KEY=your_google_key

# Déploiement (optionnel)
VERCEL_TOKEN=your_vercel_token
NETLIFY_TOKEN=your_netlify_token
```

## 🎨 Capacités de Génération

### Pages Web Supportées

- **Landing Pages** - Pages d'accueil modernes
- **Dashboards** - Interfaces d'administration
- **Blogs** - Systèmes de blog
- **E-commerce** - Boutiques en ligne
- **Portfolios** - Portfolios professionnels
- **Custom** - Pages personnalisées

### Projets Supportés

- **React App** - Applications React modernes
- **Next.js App** - Applications Next.js avec SSR
- **Express API** - APIs REST avec Express
- **Full Stack** - Applications complètes (frontend + backend)
- **Static Site** - Sites statiques

### Bases de Données Supportées

- PostgreSQL
- MongoDB
- SQLite
- Aucune (stateless)

### Plateformes de Déploiement

- **Manus** - Plateforme native (recommandée)
- **Vercel** - Déploiement frontend
- **Netlify** - Déploiement frontend
- **Railway** - Déploiement full-stack
- **Render** - Déploiement full-stack
- **Heroku** - Déploiement legacy

## 🧪 Tests

Exécuter les tests du Engineer Module:

```bash
pnpm test server -- engineerModule.test.ts
```

## 📈 Performance

- **Génération de page**: ~2-5 secondes
- **Génération de projet**: ~3-8 secondes
- **Installation de dépendances**: ~30-120 secondes
- **Déploiement**: ~1-5 minutes (selon la plateforme)

## 🔒 Sécurité

- Audit automatique des vulnérabilités npm
- Isolation du code via E2B Sandbox
- Validation des entrées utilisateur
- Logs d'audit complets
- Gestion des erreurs sécurisée

## 🚀 Prochaines Étapes

1. **Intégration au Chat Phoenix** - Permettre à Phoenix de générer du code automatiquement
2. **Templates Personnalisés** - Créer des templates réutilisables
3. **CI/CD Intégré** - Ajouter les workflows GitHub Actions
4. **Monitoring Avancé** - Ajouter les alertes email/Slack
5. **Collaboration** - Permettre le partage de projets

## 📞 Support

Pour toute question ou problème:
- Consultez la documentation complète
- Vérifiez les logs du serveur
- Utilisez le dashboard de monitoring
- Contactez l'équipe Phoenix

---

**Phoenix Engineer Module v1.0.0** - Transformant les idées en applications en quelques secondes! 🚀
