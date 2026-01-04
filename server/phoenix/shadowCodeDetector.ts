/**
 * Shadow Code Detector Module
 * Détecte et clarifie le contexte du "code ombre"
 * Solution #2: Clarifier et détecter le contexte 'code ombre'
 */

export interface ShadowCodeContext {
  type: 'hidden' | 'background' | 'internal' | 'undocumented' | 'legacy' | 'unknown';
  description: string;
  examples: string[];
  concerns: string[];
  recommendations: string[];
}

/**
 * Détecte si le message parle de "code ombre"
 */
export function detectShadowCodeReference(message: string): boolean {
  const patterns = [
    /code ombre|shadow code|hidden code/i,
    /code non visible|invisible code|background code/i,
    /code interne|internal code|backend logic/i,
    /code non documenté|undocumented code|legacy code/i,
    /code caché|concealed code|obscured code/i,
    /code en arrière-plan|background process|hidden logic/i
  ];

  return patterns.some(p => p.test(message));
}

/**
 * Détermine le type de "code ombre"
 */
export function determineShadowCodeType(message: string): ShadowCodeContext['type'] {
  if (/caché|hidden|invisible|non visible/i.test(message)) {
    return 'hidden';
  }

  if (/arrière-plan|background|process|daemon/i.test(message)) {
    return 'background';
  }

  if (/interne|internal|backend|core/i.test(message)) {
    return 'internal';
  }

  if (/non documenté|undocumented|sans doc|missing docs/i.test(message)) {
    return 'undocumented';
  }

  if (/legacy|ancien|old|deprecated/i.test(message)) {
    return 'legacy';
  }

  return 'unknown';
}

/**
 * Crée un contexte détaillé pour le "code ombre"
 */
export function createShadowCodeContext(type: ShadowCodeContext['type']): ShadowCodeContext {
  const contexts: Record<ShadowCodeContext['type'], ShadowCodeContext> = {
    hidden: {
      type: 'hidden',
      description: 'Code non visible dans l\'interface utilisateur ou les fichiers principaux',
      examples: [
        'Code d\'initialisation caché',
        'Fonctions utilitaires non exportées',
        'Code de configuration interne',
        'Logique de cache en arrière-plan'
      ],
      concerns: [
        'Difficile à déboguer',
        'Peut causer des comportements inattendus',
        'Manque de documentation',
        'Couplage implicite'
      ],
      recommendations: [
        'Documenter le code caché',
        'Créer des tests unitaires',
        'Exposer les interfaces publiques',
        'Ajouter des logs de débogage'
      ]
    },
    background: {
      type: 'background',
      description: 'Code qui s\'exécute en arrière-plan sans interaction directe de l\'utilisateur',
      examples: [
        'Tâches de traitement en arrière-plan',
        'Synchronisation de données',
        'Nettoyage de cache',
        'Monitoring et logging'
      ],
      concerns: [
        'Peut affecter les performances',
        'Difficile à tester',
        'Peut créer des deadlocks',
        'Gestion d\'erreurs complexe'
      ],
      recommendations: [
        'Implémenter des métriques',
        'Ajouter des timeouts',
        'Créer des tests d\'intégration',
        'Documenter les dépendances'
      ]
    },
    internal: {
      type: 'internal',
      description: 'Code interne du système qui ne doit pas être exposé publiquement',
      examples: [
        'Logique métier core',
        'Gestion des permissions',
        'Validation des données',
        'Orchestration des services'
      ],
      concerns: [
        'Sécurité critique',
        'Complexité élevée',
        'Dépendances multiples',
        'Impact sur la stabilité'
      ],
      recommendations: [
        'Implémenter des tests exhaustifs',
        'Ajouter des vérifications de sécurité',
        'Documenter les invariants',
        'Créer des interfaces stables'
      ]
    },
    undocumented: {
      type: 'undocumented',
      description: 'Code sans documentation ou avec documentation insuffisante',
      examples: [
        'Fonctions sans commentaires',
        'Algorithmes complexes non expliqués',
        'Dépendances non documentées',
        'Comportements implicites'
      ],
      concerns: [
        'Difficile à maintenir',
        'Risque de régression',
        'Onboarding difficile',
        'Bugs cachés'
      ],
      recommendations: [
        'Ajouter des commentaires détaillés',
        'Créer une documentation API',
        'Ajouter des exemples d\'utilisation',
        'Générer de la documentation automatique'
      ]
    },
    legacy: {
      type: 'legacy',
      description: 'Code ancien ou déprécié qui doit être refactorisé ou supprimé',
      examples: [
        'Code d\'anciennes versions',
        'Dépendances obsolètes',
        'Patterns dépassés',
        'Code mort non supprimé'
      ],
      concerns: [
        'Incompatibilité avec le nouveau code',
        'Sécurité compromise',
        'Performance dégradée',
        'Maintenance coûteuse'
      ],
      recommendations: [
        'Planifier une migration',
        'Créer des tests de régression',
        'Documenter les changements',
        'Implémenter un wrapper de compatibilité'
      ]
    },
    unknown: {
      type: 'unknown',
      description: 'Type de code ombre non clairement identifié',
      examples: [
        'Code dont le type est ambigu',
        'Comportement non documenté',
        'Logique complexe et opaque'
      ],
      concerns: [
        'Manque de clarté',
        'Risque d\'erreur d\'interprétation',
        'Difficile à analyser'
      ],
      recommendations: [
        'Clarifier le type de code',
        'Analyser le code source',
        'Demander plus de contexte',
        'Créer une documentation'
      ]
    }
  };

  return contexts[type];
}

/**
 * Crée une question de clarification pour le "code ombre"
 */
export function createShadowCodeClarificationQuestion(message: string): string {
  const type = determineShadowCodeType(message);
  const context = createShadowCodeContext(type);

  return `
Je détecte que vous parlez de "code ombre" (${context.type}).

Pour mieux vous aider, pouvez-vous clarifier:

1. **Type de code**: ${context.description}
   - Exemples: ${context.examples.join(', ')}

2. **Vos préoccupations**:
   - ${context.concerns.join('\n   - ')}

3. **Prochaines étapes recommandées**:
   - ${context.recommendations.join('\n   - ')}

Pouvez-vous préciser:
- Quel fichier ou module spécifique?
- Quel est le problème exact?
- Quel est votre objectif?
`;
}

/**
 * Analyse le projet pour trouver du "code ombre"
 */
export function identifyShadowCodePatterns(projectAnalysis: string): string[] {
  const patterns: string[] = [];

  // Patterns de code caché
  if (/private|protected|internal/i.test(projectAnalysis)) {
    patterns.push('Code privé/protégé détecté');
  }

  // Patterns de code en arrière-plan
  if (/background|async|worker|daemon|scheduler/i.test(projectAnalysis)) {
    patterns.push('Code en arrière-plan détecté');
  }

  // Patterns de code interne
  if (/core|engine|orchestrator|manager|handler/i.test(projectAnalysis)) {
    patterns.push('Code interne/core détecté');
  }

  // Patterns de code non documenté
  if (/TODO|FIXME|XXX|HACK|BUG/i.test(projectAnalysis)) {
    patterns.push('Code non documenté/à corriger détecté');
  }

  // Patterns de code legacy
  if (/deprecated|legacy|old|obsolete|v1|v2/i.test(projectAnalysis)) {
    patterns.push('Code legacy/déprécié détecté');
  }

  // Patterns de code complexe
  if (/complex|complicated|difficult|obscure|opaque/i.test(projectAnalysis)) {
    patterns.push('Code complexe/opaque détecté');
  }

  return patterns;
}

/**
 * Crée un rapport sur le "code ombre"
 */
export function createShadowCodeReport(message: string, projectAnalysis: string): string {
  const type = determineShadowCodeType(message);
  const context = createShadowCodeContext(type);
  const patterns = identifyShadowCodePatterns(projectAnalysis);

  return `
# Rapport d'Analyse du "Code Ombre"

## Type Détecté
**${context.type}** - ${context.description}

## Description
${context.description}

## Exemples Typiques
${context.examples.map(e => `- ${e}`).join('\n')}

## Préoccupations Identifiées
${context.concerns.map(c => `- ${c}`).join('\n')}

## Patterns Détectés dans le Projet
${patterns.length > 0 ? patterns.map(p => `- ${p}`).join('\n') : 'Aucun pattern détecté'}

## Recommandations
${context.recommendations.map(r => `- ${r}`).join('\n')}

## Prochaines Étapes
1. Clarifier le type de code ombre
2. Analyser le code source spécifique
3. Documenter les comportements
4. Implémenter les recommandations
5. Tester les changements
`;
}
