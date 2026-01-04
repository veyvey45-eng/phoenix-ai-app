import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { format } from "date-fns";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

export function SubscriptionsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Récupérer l'abonnement actif
  const { data: subscription, isLoading: subscriptionLoading } = trpc.stripe.getActiveSubscription.useQuery(undefined, {
    enabled: !!user,
  });

  // Récupérer l'historique des paiements
  const { data: payments, isLoading: paymentsLoading } = trpc.stripe.getPaymentHistory.useQuery(undefined, {
    enabled: !!user,
  });

  // Récupérer les factures
  const { data: invoices, isLoading: invoicesLoading } = trpc.stripe.getInvoices.useQuery(undefined, {
    enabled: !!user,
  });

  // Mutation pour annuler l'abonnement
  const cancelSubscription = trpc.stripe.cancelSubscription.useMutation({
    onSuccess: () => {
      utils.stripe.getActiveSubscription.invalidate();
      alert("Subscription will be canceled at the end of the billing period");
    },
    onError: (error) => {
      console.error("Cancel error:", error);
      alert("Failed to cancel subscription");
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "past_due":
        return "bg-yellow-100 text-yellow-800";
      case "canceled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="w-4 h-4" />;
      case "past_due":
        return <AlertCircle className="w-4 h-4" />;
      case "canceled":
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Please log in</CardTitle>
              <CardDescription>You need to be logged in to view your subscriptions</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Current Subscription */}
        <div>
          <h1 className="text-3xl font-bold mb-6">Subscription Management</h1>

          {subscriptionLoading ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-muted-foreground">Loading subscription...</p>
              </CardContent>
            </Card>
          ) : subscription ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Current Subscription</CardTitle>
                    <CardDescription>Your active subscription details</CardDescription>
                  </div>
                  <Badge className={getStatusColor(subscription.status)}>
                    <span className="flex items-center gap-2">
                      {getStatusIcon(subscription.status)}
                      {subscription.status.toUpperCase()}
                    </span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <p className="font-medium">{subscription.plan}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Subscription ID</p>
                    <p className="font-mono text-sm">{subscription.stripeSubscriptionId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Period Start</p>
                    <p className="font-medium">
                      {subscription.currentPeriodStart
                        ? format(new Date(subscription.currentPeriodStart), "MMM d, yyyy")
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Period End</p>
                    <p className="font-medium">
                      {subscription.currentPeriodEnd
                        ? format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {subscription.status === "active" && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (confirm("Are you sure you want to cancel your subscription?")) {
                          cancelSubscription.mutate();
                        }
                      }}
                      disabled={cancelSubscription.isPending}
                    >
                      {cancelSubscription.isPending ? "Canceling..." : "Cancel Subscription"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-muted-foreground mb-4">You don't have an active subscription yet.</p>
                <Button onClick={() => (window.location.href = "/pricing")}>View Plans</Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Payment History */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Payment History</h2>

          {paymentsLoading ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-muted-foreground">Loading payments...</p>
              </CardContent>
            </Card>
          ) : payments && payments.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Date</th>
                        <th className="text-left py-3 px-4 font-medium">Amount</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                        <th className="text-left py-3 px-4 font-medium">ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">{format(new Date(payment.createdAt), "MMM d, yyyy")}</td>
                          <td className="py-3 px-4 font-medium">
                            ${(payment.amount / 100).toFixed(2)} {payment.currency.toUpperCase()}
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={getStatusColor(payment.status)}>{payment.status}</Badge>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                            {payment.stripePaymentIntentId?.substring(0, 20)}...
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-muted-foreground">No payments yet.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Invoices */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Invoices</h2>

          {invoicesLoading ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-muted-foreground">Loading invoices...</p>
              </CardContent>
            </Card>
          ) : invoices && invoices.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                      <div>
                        <p className="font-medium">Invoice #{invoice.number}</p>
                        <p className="text-sm text-muted-foreground">{format(new Date(invoice.date), "MMM d, yyyy")}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-medium">${(invoice.amount / 100).toFixed(2)}</p>
                          <Badge className={getStatusColor(invoice.status || '')}>{invoice.status}</Badge>
                        </div>
                        {invoice.pdfUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(invoice.pdfUrl!, "_blank")}
                          >
                            Download PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-muted-foreground">No invoices yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
