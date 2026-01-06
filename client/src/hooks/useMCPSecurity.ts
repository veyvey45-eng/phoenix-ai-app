/**
 * Hook pour gérer les confirmations de sécurité MCP
 * 
 * Permet d'afficher des demandes de confirmation dans le chat
 * quand Phoenix veut exécuter une action MCP sensible.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

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
  riskLabel?: string;
  riskEmoji?: string;
  riskColor?: string;
}

export interface UseMCPSecurityReturn {
  pendingConfirmations: SecurityConfirmationRequest[];
  isProcessing: boolean;
  approveAction: (requestId: string) => Promise<{ success: boolean; result?: unknown }>;
  rejectAction: (requestId: string, reason?: string) => Promise<void>;
  checkToolSecurity: (serverId: string, toolName: string, args?: Record<string, unknown>) => Promise<{
    requiresConfirmation: boolean;
    confirmationRequest?: SecurityConfirmationRequest;
  }>;
  clearConfirmation: (requestId: string) => void;
  refreshPendingConfirmations: () => void;
}

export function useMCPSecurity(): UseMCPSecurityReturn {
  const [pendingConfirmations, setPendingConfirmations] = useState<SecurityConfirmationRequest[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastDataRef = useRef<string>('');

  // Queries
  const pendingQuery = trpc.mcpBridge.getPendingConfirmations.useQuery(undefined, {
    refetchInterval: 5000, // Rafraîchir toutes les 5 secondes
  });
  
  // Mettre à jour les confirmations en attente quand les données changent
  useEffect(() => {
    if (pendingQuery.data?.confirmations) {
      const newData = JSON.stringify(pendingQuery.data.confirmations);
      if (newData !== lastDataRef.current) {
        lastDataRef.current = newData;
        setPendingConfirmations(pendingQuery.data.confirmations as SecurityConfirmationRequest[]);
      }
    }
  }, [pendingQuery.data]);

  // Mutations
  const requestConfirmationMutation = trpc.mcpBridge.requestToolConfirmation.useMutation();
  const respondMutation = trpc.mcpBridge.respondToConfirmation.useMutation();

  /**
   * Vérifie si un outil nécessite une confirmation de sécurité
   */
  const checkToolSecurity = useCallback(async (
    serverId: string,
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<{
    requiresConfirmation: boolean;
    confirmationRequest?: SecurityConfirmationRequest;
  }> => {
    try {
      const result = await requestConfirmationMutation.mutateAsync({
        serverId,
        toolName,
        arguments: args,
      });

      if (result.requiresConfirmation && result.confirmationRequest) {
        const request = result.confirmationRequest as SecurityConfirmationRequest;
        
        // Ajouter à la liste des confirmations en attente
        setPendingConfirmations(prev => {
          const exists = prev.some(p => p.id === request.id);
          if (exists) return prev;
          return [...prev, request];
        });

        return {
          requiresConfirmation: true,
          confirmationRequest: request,
        };
      }

      return { requiresConfirmation: false };
    } catch (error) {
      console.error('Error checking tool security:', error);
      return { requiresConfirmation: false };
    }
  }, [requestConfirmationMutation]);

  /**
   * Approuve une action en attente
   */
  const approveAction = useCallback(async (requestId: string): Promise<{ success: boolean; result?: unknown }> => {
    setIsProcessing(true);
    
    try {
      const result = await respondMutation.mutateAsync({
        requestId,
        approved: true,
      });

      // Retirer de la liste des confirmations en attente
      setPendingConfirmations(prev => prev.filter(p => p.id !== requestId));

      if (result.executed) {
        toast.success('Action autorisée et exécutée');
        return { success: true, result: result.result };
      }

      return { success: true };
    } catch (error) {
      console.error('Error approving action:', error);
      toast.error('Erreur lors de l\'approbation');
      return { success: false };
    } finally {
      setIsProcessing(false);
    }
  }, [respondMutation]);

  /**
   * Refuse une action en attente
   */
  const rejectAction = useCallback(async (requestId: string, reason?: string): Promise<void> => {
    setIsProcessing(true);
    
    try {
      await respondMutation.mutateAsync({
        requestId,
        approved: false,
        reason: reason || 'Refusé par l\'utilisateur',
      });

      // Retirer de la liste des confirmations en attente
      setPendingConfirmations(prev => prev.filter(p => p.id !== requestId));

      toast.info('Action refusée');
    } catch (error) {
      console.error('Error rejecting action:', error);
      toast.error('Erreur lors du refus');
    } finally {
      setIsProcessing(false);
    }
  }, [respondMutation]);

  /**
   * Supprime une confirmation de la liste (sans répondre)
   */
  const clearConfirmation = useCallback((requestId: string) => {
    setPendingConfirmations(prev => prev.filter(p => p.id !== requestId));
  }, []);

  /**
   * Rafraîchit la liste des confirmations en attente
   */
  const refreshPendingConfirmations = useCallback(() => {
    pendingQuery.refetch();
  }, [pendingQuery]);

  return {
    pendingConfirmations,
    isProcessing,
    approveAction,
    rejectAction,
    checkToolSecurity,
    clearConfirmation,
    refreshPendingConfirmations,
  };
}

export default useMCPSecurity;
