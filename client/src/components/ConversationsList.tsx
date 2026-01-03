'use client';

import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageSquare,
  Plus,
  Trash2,
  MoreVertical,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

interface ConversationsListProps {
  onSelectConversation?: (conversationId: number, contextId: string) => void;
  onCreateNew?: () => void;
}

export function ConversationsList({
  onSelectConversation,
  onCreateNew,
}: ConversationsListProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Queries
  const conversationsQuery = trpc.conversations.list.useQuery();
  const createConversationMutation = trpc.conversations.create.useMutation({
    onSuccess: (conversation) => {
      toast.success('Nouvelle conversation créée');
      conversationsQuery.refetch();
      if (onSelectConversation && conversation) {
        onSelectConversation(conversation.id, conversation.contextId);
      }
    },
    onError: (error) => {
      toast.error('Erreur lors de la création', {
        description: error.message,
      });
    },
  });

  const deleteConversationMutation = trpc.conversations.delete.useMutation({
    onSuccess: () => {
      toast.success('Conversation supprimée');
      conversationsQuery.refetch();
      setDeleteConfirm(null);
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression', {
        description: error.message,
      });
    },
  });

  const handleCreateNew = useCallback(() => {
    createConversationMutation.mutate({});
    onCreateNew?.();
  }, [createConversationMutation, onCreateNew]);

  const handleDelete = useCallback((conversationId: number) => {
    deleteConversationMutation.mutate({ conversationId });
  }, [deleteConversationMutation]);

  const conversations = conversationsQuery.data || [];

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-green-500" />
          <h2 className="font-semibold text-sm">Conversations</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCreateNew}
          disabled={createConversationMutation.isPending}
          className="h-8"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-2 pr-4">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <p>Aucune conversation</p>
              <p className="text-xs mt-2">Créez une nouvelle conversation pour commencer</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <Card
                key={conv.id}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => onSelectConversation?.(conv.id, conv.contextId)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {conv.title || 'Sans titre'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {new Date(conv.updatedAt).toLocaleString('fr-FR', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectConversation?.(conv.id, conv.contextId);
                          }}
                        >
                          <ChevronRight className="w-4 h-4 mr-2" />
                          Reprendre
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(conv.id);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Supprimer la conversation?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. Tous les messages de cette conversation seront supprimés.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
