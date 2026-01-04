import Stripe from "stripe";
import { Request, Response } from "express";
import { handleStripeWebhookEvent } from "./stripeHelpers";
import { notifyOwner } from "../_core/notification";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-12-15.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

/**
 * Traite les webhooks Stripe
 * Cette fonction doit être appelée avec express.raw({ type: 'application/json' })
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"] as string;

  if (!signature) {
    console.error("[Webhook] Missing stripe-signature header");
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  let event: Stripe.Event;

  try {
    // Vérifier la signature du webhook
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    console.error("[Webhook] Signature verification failed:", error);
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }

  // Déterminer si c'est un événement de test
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({
      verified: true,
    });
  }

  try {
    console.log(`[Webhook] Processing event: ${event.type} (${event.id})`);

    // Traiter l'événement
    await handleStripeWebhookEvent(event);

    // Envoyer une notification au propriétaire pour certains événements
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await notifyOwner({
          title: "💳 New Subscription",
          content: `New subscription created for customer ${session.customer_email}. Amount: $${(session.amount_total || 0) / 100}`,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await notifyOwner({
          title: "⚠️ Payment Failed",
          content: `Payment failed for invoice ${invoice.number}. Customer: ${invoice.customer_email}`,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await notifyOwner({
          title: "📉 Subscription Canceled",
          content: `Subscription ${subscription.id} has been canceled.`,
        });
        break;
      }
    }

    // Retourner une réponse de succès
    res.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing event:", error);
    // Retourner 200 pour que Stripe ne réessaie pas
    res.json({ received: true, error: "Processing error" });
  }
}
