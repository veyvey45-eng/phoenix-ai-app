# Project Phoenix - TODO

## Phase 1: Base de données et modèle de données
- [x] Schéma Utterance (énoncés tracés avec id, role, content, timestamp, context_id, confidence, sources)
- [x] Schéma Decision (choix internes avec options, chosen, rationale, criteria_snapshot, torment_before/after)
- [x] Schéma Issue (incohérences avec type, severity, evidence, status, ttl, attempts)
- [x] Schéma MemoryItem (mémoire long-terme avec text, embedding, tags, salience, provenance)
- [x] Schéma ActionRequest (actions proposées avec tool, params, scope, risk_level, requires_human_ok, signature)
- [x] Schéma ActionResult (résultats vérifiés avec output, checks, side_effects, signature)
- [x] Schéma Criteria (règles de jugement avec level, list, weights, version, changelog)
- [x] Migration base de données

## Phase 2: Modules Backend
- [x] Module Mémoire Évolutive (RAG avec vector store)
- [x] Module Tourment Fonctionnel (score T [0-100], priorisation issues, hysteresis)
- [x] Module Arbitrage (multi-hypothèses N=3, scoring avec critères pondérés)
- [x] Module Sécurité Niveau 0 (axiomes immuables, policy engine, signatures HMAC-SHA256)
- [x] Module Détection d'erreurs (contradictions, mismatches, vérification outils)
- [x] Module Initiative (suggestions, actions outillées, permissions granulaires)

## Phase 3: Orchestrateur Phoenix
- [x] Séparation penser vs agir
- [x] Intégration LLM pour génération d'hypothèses
- [x] Pipeline de vérification
- [x] Système de journalisation immuable
- [x] Boucle réflexive (production → évaluation → réévaluation → correction → consolidation)

## Phase 4: Interface Utilisateur
- [x] Dashboard de visualisation des états internes
- [x] Affichage score de tourment en temps réel
- [x] Visualisation hypothèses concurrentes
- [x] Liste des issues actives
- [x] Journal des décisions prises
- [x] Journal d'audit complet
- [x] Interface de chat conversationnelle
- [x] Affichage transparent des incertitudes et raisonnements
- [x] Visualisation des processus de correction

## Phase 5: Tests et intégration
- [x] Tests unitaires des modules (29 tests passés)
- [x] Tests d'intégration frontend/backend
- [x] Tests de scénarios (mémoire fausse, contradictions)
- [x] Validation du système de sécurité

## Phase 6: Intégration Vector Store (Vectra)
- [x] Installer vectra (alternative à Chroma pour mode embarqué Node.js)
- [x] Configurer Vectra en mode embarqué (persistance locale fichiers)
- [x] Créer le service VectraMemoryStore
- [x] Générer des embeddings (hash-based pour MVP, LLM-ready)
- [x] Implémenter le stockage automatique des conversations (transpiration)
- [x] Implémenter le retrieval contextuel intelligent
- [x] Ajouter la consolidation de mémoire (Module Sommeil simplifié)
- [x] Ajouter les endpoints tRPC pour vectraMemory
- [x] Mettre à jour les types d'événements d'audit
- [x] Tests unitaires du système de mémoire Vectra (16 tests passés)
- [x] Validation de la persistance entre sessions (intégré dans le chat)

## Phase 7: Fonctionnalités Avancées

### Embeddings Réels
- [x] Intégrer l'API LLM pour générer des embeddings sémantiques
- [x] Remplacer les embeddings hash-based par des embeddings réels
- [x] Tester la qualité du retrieval sémantique

### Module Sommeil Complet
- [x] Implémenter la détection de mémoires similaires
- [x] Créer la logique de fusion des mémoires
- [x] Ajouter le renforcement des patterns récurrents
- [x] Créer un endpoint pour déclencher la consolidation
- [x] Ajouter des statistiques de consolidation

### Visualisation de la Mémoire
- [x] Créer le composant MemoryExplorer
- [x] Afficher les mémoires avec leur saillance et type
- [x] Ajouter la recherche dans les mémoires
- [x] Visualiser les connexions sémantiques

### Bouton Live (Streaming)
- [x] Implémenter le streaming SSE côté serveur
- [x] Créer le hook useStreamingChat côté client
- [x] Ajouter le bouton Live dans l'interface de chat
- [x] Afficher les tokens en temps réel

### Synthèse Vocale (TTS)
- [x] Intégrer l'API Web Speech ou un service TTS
- [x] Créer le composant TextToSpeech
- [x] Ajouter le bouton de lecture vocale
- [x] Gérer les contrôles (play, pause, stop)
- [x] Supporter plusieurs langues (français prioritaire)
