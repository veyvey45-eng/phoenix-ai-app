/**
 * Stripe Products & Pricing Configuration
 * Définit les plans d'abonnement disponibles
 */

export const STRIPE_PRODUCTS = {
  STARTER: {
    name: "Starter",
    description: "Plan de base pour commencer",
    monthlyPrice: 9.99, // USD
    yearlyPrice: 99.99,
    features: [
      "Accès à Phoenix AI",
      "5 conversations par jour",
      "Mémoire limitée",
      "Support email",
    ],
  },
  PROFESSIONAL: {
    name: "Professional",
    description: "Plan professionnel avec plus de fonctionnalités",
    monthlyPrice: 29.99, // USD
    yearlyPrice: 299.99,
    features: [
      "Accès illimité à Phoenix AI",
      "Conversations illimitées",
      "Mémoire avancée",
      "Support prioritaire",
      "Intégrations API",
      "Webhooks personnalisés",
    ],
  },
  ENTERPRISE: {
    name: "Enterprise",
    description: "Plan personnalisé pour les grandes organisations",
    monthlyPrice: 99.99, // USD
    yearlyPrice: 999.99,
    features: [
      "Tout du plan Professional",
      "Support 24/7 dédié",
      "Déploiement personnalisé",
      "SLA garanti",
      "Modules personnalisés",
      "Formation d'équipe",
    ],
  },
};

/**
 * Récupère les détails d'un plan par clé
 */
export function getPlanDetails(planKey: keyof typeof STRIPE_PRODUCTS) {
  return STRIPE_PRODUCTS[planKey];
}

/**
 * Liste tous les plans disponibles
 */
export function getAllPlans() {
  return Object.entries(STRIPE_PRODUCTS).map(([key, plan]) => ({
    key,
    ...plan,
  }));
}
