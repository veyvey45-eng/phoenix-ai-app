import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Check } from "lucide-react";

export function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Récupérer les plans disponibles
  const { data: plans } = trpc.stripe.getPlans.useQuery();

  // Récupérer l'abonnement actif
  const { data: activeSubscription } = trpc.stripe.getActiveSubscription.useQuery(undefined, {
    enabled: !!user,
  });

  // Mutation pour créer une session de checkout
  const createCheckout = trpc.stripe.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
      }
    },
    onError: (error) => {
      console.error("Checkout error:", error);
      alert("Failed to create checkout session");
    },
  });

  const handleSubscribe = (planKey: "STARTER" | "PROFESSIONAL" | "ENTERPRISE") => {
    if (!user) {
      alert("Please log in to subscribe");
      return;
    }

    createCheckout.mutate({
      planKey,
      billingPeriod,
    });
  };

  const getPriceForPlan = (planKey: string) => {
    const plan = plans?.find((p) => p.key === planKey);
    if (!plan) return "$0";

    const price = billingPeriod === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
    return `$${price}`;
  };

  const getFeatures = (planKey: string) => {
    const plan = plans?.find((p) => p.key === planKey);
    return plan?.features || [];
  };

  const isCurrentPlan = (planKey: string) => {
    // TODO: Mapper stripePriceId à planKey
    return false;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Choose the perfect plan for your needs. Always flexible to scale.
          </p>

          {/* Billing Period Toggle */}
          <div className="flex justify-center items-center gap-4">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                billingPeriod === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                billingPeriod === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Yearly
              <Badge variant="secondary" className="ml-2">
                Save 17%
              </Badge>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Starter Plan */}
          <Card className="relative border-border hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-2xl">Starter</CardTitle>
              <CardDescription>Perfect for getting started</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{getPriceForPlan("STARTER")}</span>
                  <span className="text-muted-foreground">/{billingPeriod === "monthly" ? "month" : "year"}</span>
                </div>
              </div>

              <Button
                onClick={() => handleSubscribe("STARTER")}
                disabled={isCurrentPlan("STARTER") || createCheckout.isPending}
                className="w-full"
                variant={isCurrentPlan("STARTER") ? "outline" : "default"}
              >
                {isCurrentPlan("STARTER") ? "Current Plan" : "Subscribe Now"}
              </Button>

              <div className="space-y-3">
                {getFeatures("STARTER").map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Professional Plan */}
          <Card className="relative border-primary shadow-lg scale-105">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">Professional</CardTitle>
              <CardDescription>For growing teams</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{getPriceForPlan("PROFESSIONAL")}</span>
                  <span className="text-muted-foreground">/{billingPeriod === "monthly" ? "month" : "year"}</span>
                </div>
              </div>

              <Button
                onClick={() => handleSubscribe("PROFESSIONAL")}
                disabled={isCurrentPlan("PROFESSIONAL") || createCheckout.isPending}
                className="w-full"
                variant={isCurrentPlan("PROFESSIONAL") ? "outline" : "default"}
              >
                {isCurrentPlan("PROFESSIONAL") ? "Current Plan" : "Subscribe Now"}
              </Button>

              <div className="space-y-3">
                {getFeatures("PROFESSIONAL").map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card className="relative border-border hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-2xl">Enterprise</CardTitle>
              <CardDescription>For large organizations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{getPriceForPlan("ENTERPRISE")}</span>
                  <span className="text-muted-foreground">/{billingPeriod === "monthly" ? "month" : "year"}</span>
                </div>
              </div>

              <Button
                onClick={() => handleSubscribe("ENTERPRISE")}
                disabled={isCurrentPlan("ENTERPRISE") || createCheckout.isPending}
                className="w-full"
                variant={isCurrentPlan("ENTERPRISE") ? "outline" : "default"}
              >
                {isCurrentPlan("ENTERPRISE") ? "Current Plan" : "Subscribe Now"}
              </Button>

              <div className="space-y-3">
                {getFeatures("ENTERPRISE").map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I change my plan anytime?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the next billing cycle.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What payment methods do you accept?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We accept all major credit cards, debit cards, and other payment methods through Stripe.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Is there a free trial?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Contact our sales team to discuss trial options for your organization.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
