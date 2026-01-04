import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getOrCreateStripeCustomer,
  createCheckoutSession,
  getActiveSubscription,
  getPaymentHistory,
  cancelSubscription,
  getCustomerInvoices,
  getStripeCustomerDetails,
} from "../stripe/stripeHelpers";
import { STRIPE_PRODUCTS, getAllPlans } from "../stripe/products";

export const stripeRouter = router({
  /**
   * Récupère tous les plans disponibles
   */
  getPlans: publicProcedure.query(async () => {
    return getAllPlans();
  }),

  /**
   * Crée une session de checkout pour un abonnement
   */
  createCheckout: protectedProcedure
    .input(
      z.object({
        planKey: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]),
        billingPeriod: z.enum(["monthly", "yearly"]).default("monthly"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user.email) {
        throw new Error("User email is required");
      }

      // Récupérer l'ID de prix Stripe (à implémenter avec vos IDs réels)
      // Pour maintenant, on utilise des IDs de test
      const stripePriceIds: Record<string, Record<string, string>> = {
        STARTER: {
          monthly: "price_test_starter_monthly",
          yearly: "price_test_starter_yearly",
        },
        PROFESSIONAL: {
          monthly: "price_test_pro_monthly",
          yearly: "price_test_pro_yearly",
        },
        ENTERPRISE: {
          monthly: "price_test_ent_monthly",
          yearly: "price_test_ent_yearly",
        },
      };

      const stripePriceId = stripePriceIds[input.planKey][input.billingPeriod];

      // Créer la session de checkout
      const checkoutUrl = await createCheckoutSession(
        ctx.user.id,
        ctx.user.email || "noemail@example.com",
        stripePriceId,
        `${ctx.req.headers.origin}/dashboard?checkout=success`,
        `${ctx.req.headers.origin}/dashboard?checkout=canceled`,
        ctx.user.name || undefined
      );

      if (!checkoutUrl) {
        throw new Error("Failed to create checkout session");
      }

      return { checkoutUrl };
    }),

  /**
   * Récupère l'abonnement actif de l'utilisateur
   */
  getActiveSubscription: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await getActiveSubscription(ctx.user.id);

    if (!subscription) {
      return null;
    }

    // Récupérer les détails du plan
    const planKey = Object.keys(STRIPE_PRODUCTS).find((key) => {
      // Vous devriez mapper stripePriceId à planKey
      // Pour maintenant, on retourne une valeur par défaut
      return true;
    });

    return {
      ...subscription,
      plan: planKey || "PROFESSIONAL",
    };
  }),

  /**
   * Récupère l'historique des paiements
   */
  getPaymentHistory: protectedProcedure.query(async ({ ctx }) => {
    return await getPaymentHistory(ctx.user.id);
  }),

  /**
   * Annule l'abonnement de l'utilisateur
   */
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await cancelSubscription(ctx.user.id);

    return {
      success: true,
      subscription,
      message: "Subscription will be canceled at the end of the billing period",
    };
  }),

  /**
   * Récupère les factures de l'utilisateur
   */
  getInvoices: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Récupérer le client Stripe de l'utilisateur
      const stripeCustomerId = await getOrCreateStripeCustomer(
        ctx.user.id,
        ctx.user.email || "",
        ctx.user.name || undefined
      );

      const invoices = await getCustomerInvoices(stripeCustomerId);

      return invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        date: new Date(invoice.created * 1000),
        status: invoice.status,
        pdfUrl: invoice.invoice_pdf,
        description: invoice.description,
      }));
    } catch (error) {
      console.error("Error fetching invoices:", error);
      return [];
    }
  }),

  /**
   * Récupère les détails du client Stripe
   */
  getCustomerDetails: protectedProcedure.query(async ({ ctx }) => {
    try {
      const stripeCustomerId = await getOrCreateStripeCustomer(
        ctx.user.id,
        ctx.user.email || "",
        ctx.user.name || undefined
      );

      const customer = await getStripeCustomerDetails(stripeCustomerId);
      const cust = customer as any;

      return {
        id: cust.id,
        email: cust.email,
        name: cust.name,
        defaultPaymentMethod: cust.default_source,
        createdAt: new Date(cust.created * 1000),
      };
    } catch (error) {
      console.error("Error fetching customer details:", error);
      return null;
    }
  }),
});
