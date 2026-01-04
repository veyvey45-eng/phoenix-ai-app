/**
 * Webhook Manager Component - Gestion des webhooks E2B
 */

import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus } from 'lucide-react';

export function WebhookManager() {
  const [newUrl, setNewUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'execution_completed',
    'execution_failed',
  ]);

  // Récupérer les souscriptions
  const { data: subscriptionsData, refetch: refetchSubscriptions } = trpc.e2bHistory.getWebhookSubscriptions.useQuery();

  // Récupérer les statistiques
  const { data: statsData } = trpc.e2bHistory.getWebhookStatistics.useQuery();

  // Mutations
  const createMutation = trpc.e2bHistory.createWebhookSubscription.useMutation({
    onSuccess: () => {
      setNewUrl('');
      setSelectedEvents(['execution_completed', 'execution_failed']);
      refetchSubscriptions();
    },
  });

  const deleteMutation = trpc.e2bHistory.deleteWebhookSubscription.useMutation({
    onSuccess: () => {
      refetchSubscriptions();
    },
  });

  const handleCreate = async () => {
    if (!newUrl) return;

    await createMutation.mutateAsync({
      url: newUrl,
      events: selectedEvents as any,
    });
  };

  const handleDelete = async (subscriptionId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce webhook?')) {
      await deleteMutation.mutateAsync({ subscriptionId });
    }
  };

  const handleEventToggle = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const subscriptions = subscriptionsData?.subscriptions || [];
  const stats = statsData?.stats;

  const eventOptions = [
    { value: 'execution_started', label: 'Exécution Démarrée' },
    { value: 'execution_completed', label: 'Exécution Complétée' },
    { value: 'execution_failed', label: 'Exécution Échouée' },
    { value: 'timeout', label: 'Timeout' },
  ];

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Souscriptions Actives</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
              <p className="text-xs text-muted-foreground">
                sur {stats.totalSubscriptions} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Événements Livrés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.deliveryStats.delivered}</div>
              <p className="text-xs text-muted-foreground">
                {stats.deliveryStats.failed} échoués
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Événements Totaux</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEvents}</div>
              <p className="text-xs text-muted-foreground">
                {stats.deliveryStats.pending} en attente
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Créer une souscription */}
      <Card>
        <CardHeader>
          <CardTitle>Ajouter un Webhook</CardTitle>
          <CardDescription>Recevez des notifications pour les événements d'exécution</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">URL du Webhook</label>
            <Input
              type="url"
              placeholder="https://example.com/webhook"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">Événements</label>
            <div className="space-y-2">
              {eventOptions.map((option) => (
                <div key={option.value} className="flex items-center">
                  <Checkbox
                    id={option.value}
                    checked={selectedEvents.includes(option.value)}
                    onCheckedChange={() => handleEventToggle(option.value)}
                  />
                  <label htmlFor={option.value} className="ml-2 text-sm cursor-pointer">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || !newUrl || selectedEvents.length === 0}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter Webhook
          </Button>
        </CardContent>
      </Card>

      {/* Liste des souscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Webhooks Actifs</CardTitle>
          <CardDescription>{subscriptions.length} webhooks configurés</CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Aucun webhook configuré</div>
          ) : (
            <div className="space-y-4">
              {subscriptions.map((subscription) => (
                <div
                  key={subscription.id}
                  className="border rounded-lg p-4 flex items-start justify-between"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm break-all">{subscription.url}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {subscription.events.map((event) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Créé le {new Date(subscription.createdAt).toLocaleString()}
                    </p>
                    {subscription.lastTriggeredAt && (
                      <p className="text-xs text-muted-foreground">
                        Dernier événement: {new Date(subscription.lastTriggeredAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(subscription.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Documentation des Webhooks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">Format de l'événement</h4>
            <pre className="bg-muted p-3 rounded text-xs overflow-auto">
{`{
  "id": "event-id",
  "userId": 123,
  "executionId": "exec-id",
  "eventType": "execution_completed",
  "payload": {
    "success": true,
    "duration": 150,
    "stdout": "Hello from E2B!"
  },
  "timestamp": "2024-01-04T12:00:00Z"
}`}
            </pre>
          </div>

          <div>
            <h4 className="font-medium mb-2">En-têtes HTTP</h4>
            <ul className="space-y-1 text-xs">
              <li><code className="bg-muted px-1">Content-Type: application/json</code></li>
              <li><code className="bg-muted px-1">X-Webhook-Event: execution_completed</code></li>
              <li><code className="bg-muted px-1">X-Webhook-ID: event-id</code></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">Exemple de réponse</h4>
            <p className="text-muted-foreground">
              Votre serveur doit répondre avec un code HTTP 2xx pour confirmer la réception.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
