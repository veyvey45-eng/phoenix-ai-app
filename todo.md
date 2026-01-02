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

## Phase 8: Outils, Upload, Démo et Export

### Outils Concrets
- [x] Créer le module ToolsEngine avec interface standard
- [x] Implémenter l'outil Calculatrice (évaluation d'expressions mathématiques)
- [x] Implémenter l'outil Recherche Web (via API intégrée)
- [x] Implémenter l'outil Lecture de Fichiers (extraction de texte)
- [x] Implémenter l'outil Date/Heure
- [x] Intégrer les outils dans l'orchestrateur Phoenix
- [x] Ajouter l'affichage des appels d'outils dans le chat

### Upload de Fichiers
- [x] Créer l'endpoint d'upload avec stockage S3
- [x] Supporter les formats PDF, TXT, DOCX, images
- [x] Implémenter l'extraction de texte des PDFs
- [x] Ajouter le composant FileUpload dans le chat
- [x] Permettre l'analyse de fichiers par Phoenix
- [x] Stocker les fichiers uploadés dans la mémoire

### Mode Démo
- [x] Créer des scénarios de démonstration pré-configurés
- [x] Scénario 1: Détection de contradictions
- [x] Scénario 2: Auto-correction avec mémoire
- [x] Scénario 3: Utilisation d'outils
- [x] Scénario 4: Arbitrage multi-hypothèses
- [x] Ajouter un bouton "Démo" dans l'interface
- [x] Afficher les explications pendant la démo

### Export des Conversations
- [x] Implémenter l'export JSON des conversations
- [x] Implémenter l'export Markdown avec mise en forme
- [x] Exporter le journal d'audit
- [x] Ajouter les boutons d'export dans le dashboard

## Phase 9: Synthèse Vocale Fonctionnelle
- [x] Implémenter le hook useSpeechSynthesis avec Web Speech API
- [x] Ajouter la sélection de voix (français prioritaire)
- [x] Connecter le bouton TTS pour lire les réponses de Phoenix
- [x] Connecter le mode Auto-Voix pour lecture automatique
- [x] Ajouter les contrôles (play, pause, stop, vitesse)
- [x] Ajouter les paramètres de voix (vitesse, tonalité, volume)
- [x] Sauvegarder les préférences vocales dans localStorage
- [x] Ajouter un bouton "Tester la voix"

## Phase 10: Corrections de bugs
- [x] Bug: TypeError "Cannot read properties of undefined (reading 'cancel')" - Ajout de vérifications null
- [x] Bug: Détection incorrecte du support de synthèse vocale sur mobile - Refactorisation complète
- [x] Bug: Erreur générale dans le dashboard - Gestion d'erreurs améliorée
- [x] Ajouter des vérifications de sécurité pour window.speechSynthesis - synthRef avec try/catch

## Phase 11: Optimisation du comportement et de la vitesse
- [x] Bug: Phoenix analyse les phrases au lieu d'exécuter les tâches - Prompt système réécrit
- [x] Modifier le prompt système pour orienter vers l'exécution
- [x] Masquer les hypothèses par défaut (garder en arrière-plan)
- [x] Ajouter un toggle "Voir les hypothèses" optionnel
- [x] Optimiser l'affichage pour réponse plus rapide
- [x] Masquer le raisonnement par défaut
- [x] Afficher la réponse finale immédiatement

## Phase 12: Correction du comportement méta
- [x] Bug: Phoenix parle de ses limitations au lieu d'exécuter les tâches
- [x] Renforcer le prompt système pour interdire les réponses méta
- [x] Phoenix ne doit jamais se décrire comme "modèle de langage"
- [x] Phoenix doit agir, pas s'expliquer


## Phase 13: Optimisation de la Vitesse et TTS Serveur

### Mode Rapide (1 hypothèse)
- [x] Ajouter un paramètre fastMode dans l'API phoenix.chat
- [x] Modifier ArbitrageModule pour supporter n=1 hypothèse
- [x] Ajouter le toggle "Mode Rapide" dans l'interface utilisateur
- [x] Sauvegarder la préférence dans localStorage

### TTS Côté Serveur
- [x] Créer l'endpoint tRPC pour synthèse vocale serveur
- [x] Intégrer l'API TTS de Manus (ou alternative)
- [x] Modifier le hook useSpeechSynthesis pour utiliser le serveur en fallback
- [ ] Tester sur navigateurs mobiles (Samsung Internet, etc.)

### Tool Gateway Avancé
- [x] Créer le module toolGateway.ts avec signatures et scopes
- [x] Implémenter le système de permissions par catégorie
- [x] Ajouter la vérification de signature avant exécution
- [ ] Créer les tables de base de données pour ActionRequest/Signature
- [x] Implémenter l'approbation humaine pour actions sensibles

### Tests Unitaires
- [x] Tests pour Tool Gateway (24 tests)
- [x] Tests pour TTS serveur (17 tests)
- [x] Tous les tests passent (96 tests au total)


## Phase 14: Correction Mémoire Conversationnelle

### Bug: Phoenix ne peut pas reprendre la dernière question
- [x] Analyser pourquoi l'historique n'est pas accessible au LLM
- [x] Vérifier la persistance des messages en base de données
- [x] S'assurer que l'historique est passé dans le contexte du prompt
- [x] Tester la commande "reprends ma dernière question" (7 tests ajoutés)
