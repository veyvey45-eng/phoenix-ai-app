/**
 * MCP Security Confirmation Component
 * 
 * Affiche une demande de confirmation de sécurité dans le chat
 * quand Phoenix veut exécuter une action MCP sensible.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  ShieldX,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Terminal,
  Folder,
  Package,
  Trash2,
  Edit,
  Copy,
  Loader2
} from 'lucide-react';

// Types
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityConfirmationRequest {
  id: string;
  action: string;
  toolName: string;
  serverName: string;
  arguments: Record<string, unknown>;
  riskLevel: RiskLevel;
  description: string;
  warnings: string[];
  createdAt: string;
  expiresAt: string;
}

interface MCPSecurityConfirmationProps {
  request: SecurityConfirmationRequest;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string, reason?: string) => void;
  isProcessing?: boolean;
}

// Configuration des niveaux de risque
const riskConfig: Record<RiskLevel, {
  icon: typeof Shield;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  low: {
    icon: ShieldCheck,
    label: 'Faible',
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  medium: {
    icon: Shield,
    label: 'Moyen',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
  },
  high: {
    icon: ShieldAlert,
    label: 'Élevé',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  critical: {
    icon: ShieldX,
    label: 'CRITIQUE',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-200 dark:border-red-800',
  },
};

// Icônes par type d'action
const actionIcons: Record<string, typeof Terminal> = {
  'read_file': Folder,
  'list_directory': Folder,
  'write_file': Edit,
  'create_file': Edit,
  'delete_file': Trash2,
  'delete_directory': Trash2,
  'install_package': Package,
  'uninstall_package': Package,
  'execute_command': Terminal,
  'run_script': Terminal,
  'copy': Copy,
  'move': Copy,
  'rename': Edit,
};

export function MCPSecurityConfirmation({
  request,
  onApprove,
  onReject,
  isProcessing = false,
}: MCPSecurityConfirmationProps) {
  const [showDetails, setShowDetails] = useState(false);
  const config = riskConfig[request.riskLevel] || riskConfig.medium;
  const RiskIcon = config.icon;
  const ActionIcon = actionIcons[request.action] || Terminal;

  // Calculer le temps restant
  const expiresAt = new Date(request.expiresAt);
  const now = new Date();
  const timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
  const isExpired = timeRemaining <= 0;

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border-2 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RiskIcon className={`h-5 w-5 ${config.color}`} />
            <CardTitle className="text-lg">Confirmation de Sécurité</CardTitle>
          </div>
          <Badge 
            variant="outline" 
            className={`${config.color} ${config.borderColor}`}
          >
            Risque {config.label}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-2 mt-1">
          <Clock className="h-3 w-3" />
          {isExpired ? (
            <span className="text-red-500">Expiré</span>
          ) : (
            <span>Expire dans {timeRemaining}s</span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description de l'action */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
          <ActionIcon className="h-5 w-5 mt-0.5 text-muted-foreground" />
          <div className="flex-1">
            <p className="font-medium">Phoenix veut exécuter :</p>
            <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
              {request.description}
            </div>
          </div>
        </div>

        {/* Avertissements */}
        {request.warnings.length > 0 && (
          <Alert variant="destructive" className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {request.warnings.map((warning, index) => (
                  <li key={index} className="text-sm">{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Détails techniques (collapsible) */}
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {showDetails ? '▼' : '▶'} Détails techniques
          </button>
          
          {showDetails && (
            <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs font-mono space-y-1">
              <p><strong>Outil:</strong> {request.toolName}</p>
              <p><strong>Serveur:</strong> {request.serverName}</p>
              <p><strong>Arguments:</strong></p>
              <pre className="mt-1 p-2 bg-background rounded overflow-x-auto">
                {JSON.stringify(request.arguments, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Message d'avertissement pour les actions critiques */}
        {request.riskLevel === 'critical' && (
          <Alert className="bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700">
            <ShieldX className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700 dark:text-red-300">
              <strong>Action critique !</strong> Cette action peut avoir des conséquences irréversibles.
              Assurez-vous de bien comprendre ce que Phoenix veut faire avant d'autoriser.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex gap-3 pt-3">
        <Button
          variant="outline"
          className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={() => onReject(request.id, 'Refusé par l\'utilisateur')}
          disabled={isProcessing || isExpired}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <XCircle className="h-4 w-4 mr-2" />
          )}
          Refuser
        </Button>
        <Button
          className="flex-1 bg-green-600 hover:bg-green-700"
          onClick={() => onApprove(request.id)}
          disabled={isProcessing || isExpired}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          Autoriser
        </Button>
      </CardFooter>
    </Card>
  );
}

// Composant pour afficher le résultat d'une confirmation
interface SecurityConfirmationResultProps {
  approved: boolean;
  action: string;
  toolName: string;
}

export function SecurityConfirmationResult({
  approved,
  action,
  toolName,
}: SecurityConfirmationResultProps) {
  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg ${
      approved 
        ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' 
        : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
    }`}>
      {approved ? (
        <>
          <CheckCircle className="h-4 w-4" />
          <span>Action <strong>{toolName}</strong> autorisée et exécutée.</span>
        </>
      ) : (
        <>
          <XCircle className="h-4 w-4" />
          <span>Action <strong>{toolName}</strong> refusée.</span>
        </>
      )}
    </div>
  );
}

export default MCPSecurityConfirmation;
