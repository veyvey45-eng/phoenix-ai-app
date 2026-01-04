/**
 * ReflectionIndicator Component
 * 
 * Affiche visuellement quand Phoenix est en train de:
 * - Réfléchir (générer des hypothèses)
 * - Auto-corriger (boucle de rétroaction)
 * - Exécuter une tâche (OS, web, code)
 */

import React, { useEffect, useState } from 'react';
import { AlertCircle, Zap, Brain, Loader, CheckCircle } from 'lucide-react';

export interface ReflectionState {
  isReflecting: boolean;
  reflectionType: 'thinking' | 'auto_correcting' | 'executing' | 'idle';
  currentAttempt: number;
  maxAttempts: number;
  taskType?: 'calculation' | 'os_command' | 'web_interaction' | 'code_execution' | 'auto_correction';
  message?: string;
  progress?: number;
}

interface ReflectionIndicatorProps {
  state: ReflectionState;
  compact?: boolean;
}

export const ReflectionIndicator: React.FC<ReflectionIndicatorProps> = ({
  state,
  compact = false,
}) => {
  const [pulse, setPulse] = useState(false);

  // Animation de pulsation
  useEffect(() => {
    if (!state.isReflecting) return;

    const interval = setInterval(() => {
      setPulse(prev => !prev);
    }, 600);

    return () => clearInterval(interval);
  }, [state.isReflecting]);

  if (!state.isReflecting && state.reflectionType === 'idle') {
    return null;
  }

  const getIcon = () => {
    switch (state.reflectionType) {
      case 'thinking':
        return <Brain className="w-4 h-4" />;
      case 'auto_correcting':
        return <Zap className="w-4 h-4" />;
      case 'executing':
        return <Loader className="w-4 h-4 animate-spin" />;
      default:
        return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getLabel = () => {
    switch (state.reflectionType) {
      case 'thinking':
        return 'Phoenix réfléchit...';
      case 'auto_correcting':
        return `Auto-correction (${state.currentAttempt}/${state.maxAttempts})`;
      case 'executing':
        return `Exécution: ${state.taskType || 'tâche'}`;
      default:
        return 'Prêt';
    }
  };

  const getColor = () => {
    switch (state.reflectionType) {
      case 'thinking':
        return 'text-blue-500';
      case 'auto_correcting':
        return 'text-amber-500';
      case 'executing':
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  const getBackgroundColor = () => {
    switch (state.reflectionType) {
      case 'thinking':
        return 'bg-blue-50 border-blue-200';
      case 'auto_correcting':
        return 'bg-amber-50 border-amber-200';
      case 'executing':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getBackgroundColor()}`}>
        <div className={`${getColor()} ${pulse && state.isReflecting ? 'opacity-100' : 'opacity-70'}`}>
          {getIcon()}
        </div>
        <span className="text-xs font-medium text-gray-700">{getLabel()}</span>
        {state.currentAttempt > 0 && (
          <span className="text-xs text-gray-500">
            {state.currentAttempt}/{state.maxAttempts}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg border-2 ${getBackgroundColor()}`}>
      <div className="flex items-start gap-3">
        <div className={`${getColor()} mt-1`}>
          {getIcon()}
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{getLabel()}</h3>
          
          {state.message && (
            <p className="text-sm text-gray-600 mt-1">{state.message}</p>
          )}

          {state.isReflecting && (
            <div className="mt-3 space-y-2">
              {/* Barre de progression */}
              {state.progress !== undefined && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      state.reflectionType === 'auto_correcting'
                        ? 'bg-amber-500'
                        : state.reflectionType === 'executing'
                        ? 'bg-green-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${state.progress}%` }}
                  />
                </div>
              )}

              {/* Détails de la tentative */}
              {state.currentAttempt > 0 && (
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Tentative:</span> {state.currentAttempt}/{state.maxAttempts}
                </div>
              )}

              {/* Type de tâche */}
              {state.taskType && (
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Type:</span> {state.taskType.replace(/_/g, ' ')}
                </div>
              )}

              {/* Animation de points */}
              <div className="flex gap-1 mt-2">
                <span className={`w-1.5 h-1.5 rounded-full ${pulse ? 'bg-current' : 'bg-gray-300'}`} />
                <span className={`w-1.5 h-1.5 rounded-full ${pulse ? 'bg-gray-300' : 'bg-current'}`} />
                <span className={`w-1.5 h-1.5 rounded-full ${pulse ? 'bg-current' : 'bg-gray-300'}`} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Hook pour gérer l'état de réflexion
 */
export const useReflectionState = () => {
  const [state, setState] = useState<ReflectionState>({
    isReflecting: false,
    reflectionType: 'idle',
    currentAttempt: 0,
    maxAttempts: 3,
  });

  const setThinking = (message?: string) => {
    setState({
      isReflecting: true,
      reflectionType: 'thinking',
      currentAttempt: 0,
      maxAttempts: 3,
      message,
    });
  };

  const setAutoCorrect = (attempt: number, maxAttempts: number = 3, message?: string) => {
    setState({
      isReflecting: true,
      reflectionType: 'auto_correcting',
      currentAttempt: attempt,
      maxAttempts,
      message,
    });
  };

  const setExecuting = (taskType: ReflectionState['taskType'], message?: string, progress?: number) => {
    setState({
      isReflecting: true,
      reflectionType: 'executing',
      taskType,
      currentAttempt: 0,
      maxAttempts: 1,
      message,
      progress,
    });
  };

  const setIdle = () => {
    setState({
      isReflecting: false,
      reflectionType: 'idle',
      currentAttempt: 0,
      maxAttempts: 3,
    });
  };

  const setProgress = (progress: number) => {
    setState(prev => ({ ...prev, progress }));
  };

  return {
    state,
    setThinking,
    setAutoCorrect,
    setExecuting,
    setIdle,
    setProgress,
  };
};

/**
 * Composant pour afficher l'état dans le chat
 */
export const ChatReflectionIndicator: React.FC<{ state: ReflectionState }> = ({ state }) => {
  if (!state.isReflecting) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 my-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '0.2s' }} />
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '0.4s' }} />
      </div>
      <span>{getReflectionMessage(state)}</span>
    </div>
  );
};

function getReflectionMessage(state: ReflectionState): string {
  switch (state.reflectionType) {
    case 'thinking':
      return 'Phoenix réfléchit...';
    case 'auto_correcting':
      return `Auto-correction (tentative ${state.currentAttempt}/${state.maxAttempts})`;
    case 'executing':
      return `Exécution en cours...`;
    default:
      return '';
  }
}
