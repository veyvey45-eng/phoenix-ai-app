import Stripe from "stripe";
import { getDb } from "../db";
import { stripeCustomers, stripeSubscriptions, stripePayments } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-12-15.clover",
});

/**
 * Récupère ou crée un client Stripe pour un utilisateur
 */
export async function getOrCreateStripeCustomer(userId: number, email: string, name?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Vérifier si le client existe déjà
  const existing = await db.select().from(stripeCustomers).where(eq(stripeCustomers.userId, userId)).limit(1);

  if (existing.length > 0) {
    return existing[0].stripeCustomerId;
  }

  // Créer un nouveau client Stripe
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      userId: userId.toString(),
    },
  });

  // Sauvegarder dans la base de données
  await db.insert(stripeCustomers).values({
    userId,
    stripeCustomerId: customer.id,
  });

  return customer.id;
}

/**
 * Crée une session de checkout pour un abonnement
 */
export async function createCheckoutSession(
  userId: number,
  email: string,
  stripePriceId: string,
  successUrl: string,
  cancelUrl: string,
  name?: string
) {
  const stripeCustomerId = await getOrCreateStripeCustomer(userId, email, name);

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userId.toString(),
    metadata: {
      user_id: userId.toString(),
    },
    allow_promotion_codes: true,
  });

  return session.url;
}

/**
 * Récupère l'abonnement actif d'un utilisateur
 */
export async function getActiveSubscription(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const result = await db.select().from(stripeSubscriptions).where(eq(stripeSubscriptions.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Récupère l'historique des paiements d'un utilisateur
 */
export async function getPaymentHistory(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  return await db
    .select()
    .from(stripePayments)
    .where(eq(stripePayments.userId, userId))
    .orderBy(desc(stripePayments.createdAt))
    .limit(limit);
}

/**
 * Annule l'abonnement d'un utilisateur
 */
export async function cancelSubscription(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const subscription = await getActiveSubscription(userId);

  if (!subscription) {
    throw new Error("No active subscription found");
  }

  // Annuler l'abonnement dans Stripe
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  // Mettre à jour la base de données
  await db
    .update(stripeSubscriptions)
    .set({
      cancelAtPeriodEnd: true,
      canceledAt: new Date(),
    })
    .where(eq(stripeSubscriptions.userId, userId));

  return subscription;
}

/**
 * Récupère les détails d'un abonnement Stripe
 */
export async function getStripeSubscriptionDetails(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Récupère les détails d'un client Stripe
 */
export async function getStripeCustomerDetails(customerId: string) {
  return await stripe.customers.retrieve(customerId);
}

/**
 * Récupère les factures d'un client Stripe
 */
export async function getCustomerInvoices(customerId: string, limit = 10) {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });

  return invoices.data;
}

/**
 * Traite un événement webhook Stripe
 */
export async function handleStripeWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutSessionCompleted(session);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(invoice);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaymentFailed(invoice);
      break;
    }
  }
}

/**
 * Traite la session de checkout complétée
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const userId = parseInt(session.client_reference_id || "0");
  const customerId = session.customer as string;

  if (!userId || !customerId) {
    console.error("Invalid session data");
    return;
  }

  // Récupérer l'abonnement créé
  const subscription = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
  });

  if (subscription.data.length === 0) {
    console.error("No subscription found for customer");
    return;
  }

  const stripeSubscription = subscription.data[0];
  const priceId = (stripeSubscription.items.data[0]?.price.id || "") as string;

  // Sauvegarder l'abonnement dans la base de données
  await db.insert(stripeSubscriptions).values({
    userId,
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId: priceId,
    status: stripeSubscription.status as any,
    currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
    currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
  });

  console.log(`Subscription created for user ${userId}`);
}

/**
 * Traite la mise à jour d'un abonnement
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const dbSubscription = await db
    .select()
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.stripeSubscriptionId, subscription.id))
    .limit(1);

  if (dbSubscription.length === 0) {
    console.error("Subscription not found in database");
    return;
  }

  const priceId = (subscription.items.data[0]?.price.id || "") as string;

  // Mettre à jour l'abonnement
  await db
    .update(stripeSubscriptions)
    .set({
      status: subscription.status as any,
      stripePriceId: priceId,
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    })
    .where(eq(stripeSubscriptions.stripeSubscriptionId, subscription.id));

  console.log(`Subscription updated: ${subscription.id}`);
}

/**
 * Traite la suppression d'un abonnement
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db
    .update(stripeSubscriptions)
    .set({
      status: "canceled",
      canceledAt: new Date(),
    })
    .where(eq(stripeSubscriptions.stripeSubscriptionId, subscription.id));

  console.log(`Subscription deleted: ${subscription.id}`);
}

/**
 * Traite le paiement d'une facture
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const customerId = invoice.customer as string;

  // Trouver l'utilisateur
  const customer = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.stripeCustomerId, customerId))
    .limit(1);

  if (customer.length === 0) {
    console.error("Customer not found");
    return;
  }

  // Sauvegarder le paiement
  const paymentIntentId = typeof (invoice as any).payment_intent === "string" ? (invoice as any).payment_intent : "unknown";
  await db.insert(stripePayments).values({
    userId: customer[0].userId,
    stripePaymentIntentId: paymentIntentId,
    stripeInvoiceId: invoice.id,
    amount: invoice.amount_paid || 0,
    currency: (invoice.currency || "usd") as string,
    status: "succeeded",
    description: invoice.description || undefined,
  });

  console.log(`Invoice paid: ${invoice.id}`);
}

/**
 * Traite l'échec du paiement d'une facture
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const customerId = invoice.customer as string;

  // Trouver l'utilisateur
  const customer = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.stripeCustomerId, customerId))
    .limit(1);

  if (customer.length === 0) {
    console.error("Customer not found");
    return;
  }

  // Sauvegarder l'échec du paiement
  const paymentIntentId = typeof (invoice as any).payment_intent === "string" ? (invoice as any).payment_intent : "unknown";
  await db.insert(stripePayments).values({
    userId: customer[0].userId,
    stripePaymentIntentId: paymentIntentId,
    stripeInvoiceId: invoice.id,
    amount: invoice.amount_due || 0,
    currency: (invoice.currency || "usd") as string,
    status: "requires_payment_method",
    description: `Payment failed: ${invoice.description || ""}`,
  });

  console.log(`Invoice payment failed: ${invoice.id}`);
}
