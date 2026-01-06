/**
 * MCP Security Module
 * 
 * Système de confirmation de sécurité pour les actions MCP sensibles.
 * Phoenix demande l'autorisation de l'utilisateur avant d'exécuter des actions risquées.
 */

// Niveaux de risque
export enum RiskLevel {
  LOW = 'low',       // Lecture seule, pas de confirmation
  MEDIUM = 'medium', // Modification mineure, confirmation simple
  HIGH = 'high',     // Installation/suppression, confirmation détaillée
  CRITICAL = 'critical' // Actions système, double confirmation
}

// Types d'actions
export type ActionType = 
  | 'read_file'
  | 'list_directory'
  | 'search'
  | 'get_info'
  | 'write_file'
  | 'create_file'
  | 'rename'
  | 'move'
  | 'copy'
  | 'delete_file'
  | 'delete_directory'
  | 'install_package'
  | 'uninstall_package'
  | 'execute_command'
  | 'run_script'
  | 'modify_config'
  | 'system_command'
  | 'unknown';

// Mapping des actions vers les niveaux de risque
const ACTION_RISK_MAP: Record<ActionType, RiskLevel> = {
  // Actions à faible risque (pas de confirmation)
  'read_file': RiskLevel.LOW,
  'list_directory': RiskLevel.LOW,
  'search': RiskLevel.LOW,
  'get_info': RiskLevel.LOW,
  
  // Actions à risque moyen (confirmation simple)
  'write_file': RiskLevel.MEDIUM,
  'create_file': RiskLevel.MEDIUM,
  'rename': RiskLevel.MEDIUM,
  'move': RiskLevel.MEDIUM,
  'copy': RiskLevel.MEDIUM,
  
  // Actions à haut risque (confirmation détaillée)
  'delete_file': RiskLevel.HIGH,
  'delete_directory': RiskLevel.HIGH,
  'install_package': RiskLevel.HIGH,
  'uninstall_package': RiskLevel.HIGH,
  'execute_command': RiskLevel.HIGH,
  'run_script': RiskLevel.HIGH,
  'modify_config': RiskLevel.HIGH,
  
  // Actions critiques (double confirmation)
  'system_command': RiskLevel.CRITICAL,
  'unknown': RiskLevel.MEDIUM,
};

// Mots-clés dangereux dans les commandes
const DANGEROUS_KEYWORDS = [
  'rm -rf', 'rmdir', 'del /f', 'format',
  'sudo', 'chmod 777', 'chown',
  'npm uninstall', 'pip uninstall', 'apt remove',
  'drop table', 'delete from', 'truncate',
  'shutdown', 'reboot', 'kill -9',
  'registry', 'regedit',
  'netsh', 'iptables',
  'mkfs', 'fdisk', 'dd if=',
];

// Chemins protégés
const PROTECTED_PATHS = [
  '/etc', '/usr', '/bin', '/sbin', '/boot', '/root', '/var',
  'C:\\Windows', 'C:\\Program Files', 'C:\\System32',
  '/System', '/Library', '/Applications',
  '/home/ubuntu', // Protéger le home directory aussi
];

// Interface pour une demande de confirmation
export interface SecurityConfirmationRequest {
  id: string;
  userId: string;
  action: ActionType;
  toolName: string;
  serverName: string;
  arguments: Record<string, unknown>;
  riskLevel: RiskLevel;
  description: string;
  warnings: string[];
  createdAt: Date;
  expiresAt: Date;
}

// Interface pour une réponse de confirmation
export interface SecurityConfirmationResponse {
  requestId: string;
  approved: boolean;
  reason?: string;
  respondedAt: Date;
}

// Stockage des confirmations en attente (en mémoire)
const pendingConfirmations = new Map<string, SecurityConfirmationRequest>();

/**
 * Détermine le type d'action à partir du nom de l'outil MCP
 */
export function getActionTypeFromTool(toolName: string, args: Record<string, unknown> = {}): ActionType {
  const toolLower = toolName.toLowerCase();
  
  // Actions de lecture (faible risque)
  if (toolLower.includes('read') || toolLower.includes('get') || 
      toolLower.includes('list') || toolLower.includes('search') ||
      toolLower.includes('find') || toolLower.includes('show') ||
      toolLower.includes('view') || toolLower.includes('cat')) {
    return 'read_file';
  }
  
  // Actions de suppression (haut risque)
  if (toolLower.includes('delete') || toolLower.includes('remove') ||
      toolLower.includes('rm') || toolLower.includes('unlink') ||
      toolLower.includes('erase')) {
    if (toolLower.includes('dir') || toolLower.includes('folder') || 
        args.recursive === true) {
      return 'delete_directory';
    }
    return 'delete_file';
  }
  
  // Actions d'installation (haut risque)
  if (toolLower.includes('install') || toolLower.includes('npm') || 
      toolLower.includes('pip') || toolLower.includes('apt') ||
      toolLower.includes('brew') || toolLower.includes('yarn')) {
    if (toolLower.includes('uninstall') || toolLower.includes('remove')) {
      return 'uninstall_package';
    }
    return 'install_package';
  }
  
  // Actions d'exécution (haut risque)
  if (toolLower.includes('exec') || toolLower.includes('run') ||
      toolLower.includes('shell') || toolLower.includes('command') ||
      toolLower.includes('bash') || toolLower.includes('cmd') ||
      toolLower.includes('terminal') || toolLower.includes('spawn')) {
    return 'execute_command';
  }
  
  // Actions d'écriture (risque moyen)
  if (toolLower.includes('write') || toolLower.includes('create') ||
      toolLower.includes('save') || toolLower.includes('put') ||
      toolLower.includes('update') || toolLower.includes('modify') ||
      toolLower.includes('edit') || toolLower.includes('append')) {
    return 'write_file';
  }
  
  // Actions de déplacement/renommage (risque moyen)
  if (toolLower.includes('move') || toolLower.includes('rename') ||
      toolLower.includes('mv')) {
    return 'move';
  }
  
  if (toolLower.includes('copy') || toolLower.includes('cp')) {
    return 'copy';
  }
  
  // Par défaut
  return 'unknown';
}

/**
 * Évalue le niveau de risque d'une action
 */
export function assessRisk(
  action: ActionType, 
  toolName: string,
  args: Record<string, unknown> = {}
): { riskLevel: RiskLevel; warnings: string[] } {
  let riskLevel = ACTION_RISK_MAP[action] || RiskLevel.MEDIUM;
  const warnings: string[] = [];
  
  // Vérifier les mots-clés dangereux dans les arguments
  const argsStr = JSON.stringify(args).toLowerCase();
  for (const keyword of DANGEROUS_KEYWORDS) {
    if (argsStr.includes(keyword.toLowerCase())) {
      riskLevel = RiskLevel.CRITICAL;
      warnings.push(`⚠️ Commande dangereuse détectée: "${keyword}"`);
    }
  }
  
  // Vérifier les chemins protégés
  const pathArgs = ['path', 'directory', 'target', 'file', 'dir', 'folder', 'destination'];
  for (const pathArg of pathArgs) {
    const pathValue = args[pathArg];
    if (typeof pathValue === 'string') {
      for (const protectedPath of PROTECTED_PATHS) {
        if (pathValue.toLowerCase().startsWith(protectedPath.toLowerCase())) {
          riskLevel = RiskLevel.CRITICAL;
          warnings.push(`🔒 Chemin système protégé: "${protectedPath}"`);
          break;
        }
      }
    }
  }
  
  // Vérifier les opérations récursives
  if (args.recursive === true || args.force === true) {
    if (riskLevel === RiskLevel.MEDIUM) {
      riskLevel = RiskLevel.HIGH;
    }
    warnings.push('⚡ Opération récursive ou forcée');
  }
  
  return { riskLevel, warnings };
}

/**
 * Génère une description lisible de l'action
 */
export function generateActionDescription(
  action: ActionType,
  toolName: string,
  serverName: string,
  args: Record<string, unknown>
): string {
  const actionNames: Record<ActionType, string> = {
    'read_file': 'Lire un fichier',
    'list_directory': 'Lister un dossier',
    'search': 'Rechercher',
    'get_info': 'Obtenir des informations',
    'write_file': 'Écrire dans un fichier',
    'create_file': 'Créer un fichier',
    'rename': 'Renommer',
    'move': 'Déplacer',
    'copy': 'Copier',
    'delete_file': 'Supprimer un fichier',
    'delete_directory': 'Supprimer un dossier',
    'install_package': 'Installer un package',
    'uninstall_package': 'Désinstaller un package',
    'execute_command': 'Exécuter une commande',
    'run_script': 'Exécuter un script',
    'modify_config': 'Modifier la configuration',
    'system_command': 'Commande système',
    'unknown': 'Action inconnue',
  };
  
  let description = `**${actionNames[action]}** via l'outil \`${toolName}\` (serveur: ${serverName})`;
  
  // Ajouter les détails pertinents
  const importantArgs = ['path', 'file', 'directory', 'command', 'package', 'name'];
  const details: string[] = [];
  
  for (const arg of importantArgs) {
    if (args[arg]) {
      details.push(`${arg}: \`${args[arg]}\``);
    }
  }
  
  if (details.length > 0) {
    description += '\n\n' + details.join('\n');
  }
  
  return description;
}

/**
 * Crée une demande de confirmation
 */
export function createConfirmationRequest(
  userId: string,
  toolName: string,
  serverName: string,
  args: Record<string, unknown>
): SecurityConfirmationRequest {
  const action = getActionTypeFromTool(toolName, args);
  const { riskLevel, warnings } = assessRisk(action, toolName, args);
  const description = generateActionDescription(action, toolName, serverName, args);
  
  const request: SecurityConfirmationRequest = {
    id: `confirm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    action,
    toolName,
    serverName,
    arguments: args,
    riskLevel,
    description,
    warnings,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // Expire après 5 minutes
  };
  
  pendingConfirmations.set(request.id, request);
  
  return request;
}

/**
 * Vérifie si une action nécessite une confirmation
 */
export function requiresConfirmation(toolName: string, args: Record<string, unknown> = {}): boolean {
  const action = getActionTypeFromTool(toolName, args);
  const { riskLevel } = assessRisk(action, toolName, args);
  
  // Seules les actions à faible risque ne nécessitent pas de confirmation
  return riskLevel !== RiskLevel.LOW;
}

/**
 * Traite une réponse de confirmation
 */
export function processConfirmationResponse(
  requestId: string,
  approved: boolean,
  reason?: string
): SecurityConfirmationResponse | null {
  const request = pendingConfirmations.get(requestId);
  
  if (!request) {
    return null;
  }
  
  // Vérifier si la demande a expiré
  if (new Date() > request.expiresAt) {
    pendingConfirmations.delete(requestId);
    return null;
  }
  
  // Supprimer la demande
  pendingConfirmations.delete(requestId);
  
  return {
    requestId,
    approved,
    reason,
    respondedAt: new Date(),
  };
}

/**
 * Récupère une demande de confirmation en attente
 */
export function getPendingConfirmation(requestId: string): SecurityConfirmationRequest | null {
  const request = pendingConfirmations.get(requestId);
  
  if (!request) {
    return null;
  }
  
  // Vérifier si la demande a expiré
  if (new Date() > request.expiresAt) {
    pendingConfirmations.delete(requestId);
    return null;
  }
  
  return request;
}

/**
 * Récupère toutes les demandes de confirmation en attente pour un utilisateur
 */
export function getUserPendingConfirmations(userId: string): SecurityConfirmationRequest[] {
  const requests: SecurityConfirmationRequest[] = [];
  const now = new Date();
  
  pendingConfirmations.forEach((request, id) => {
    if (request.userId === userId) {
      if (now > request.expiresAt) {
        pendingConfirmations.delete(id);
      } else {
        requests.push(request);
      }
    }
  });
  
  return requests;
}

/**
 * Nettoie les demandes expirées
 */
export function cleanupExpiredConfirmations(): number {
  const now = new Date();
  let cleaned = 0;
  const toDelete: string[] = [];
  
  pendingConfirmations.forEach((request, id) => {
    if (now > request.expiresAt) {
      toDelete.push(id);
    }
  });
  
  toDelete.forEach(id => {
    pendingConfirmations.delete(id);
    cleaned++;
  });
  
  return cleaned;
}

// Nettoyer automatiquement toutes les minutes
setInterval(() => {
  cleanupExpiredConfirmations();
}, 60 * 1000);

/**
 * Obtenir les labels de niveau de risque
 */
export function getRiskLevelLabel(riskLevel: RiskLevel): { emoji: string; label: string; color: string } {
  switch (riskLevel) {
    case RiskLevel.LOW:
      return { emoji: '✅', label: 'Faible', color: 'green' };
    case RiskLevel.MEDIUM:
      return { emoji: '⚠️', label: 'Moyen', color: 'yellow' };
    case RiskLevel.HIGH:
      return { emoji: '🔶', label: 'Élevé', color: 'orange' };
    case RiskLevel.CRITICAL:
      return { emoji: '🚨', label: 'CRITIQUE', color: 'red' };
    default:
      return { emoji: '❓', label: 'Inconnu', color: 'gray' };
  }
}
