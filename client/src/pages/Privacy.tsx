import { Brain, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl">Phoenix AI</span>
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Retour
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-2">Politique de Confidentialité</h1>
        <p className="text-muted-foreground mb-8">Dernière mise à jour : 7 janvier 2025</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Chez Phoenix AI, nous accordons une grande importance à la protection de vos données personnelles. 
              Cette politique de confidentialité explique comment nous collectons, utilisons, stockons et protégeons 
              vos informations conformément au Règlement Général sur la Protection des Données (RGPD) et à la 
              loi Informatique et Libertés.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Responsable du Traitement</h2>
            <p className="text-muted-foreground leading-relaxed">
              Le responsable du traitement des données est :
            </p>
            <div className="bg-card border border-border rounded-lg p-4 mt-4">
              <p className="text-foreground"><strong>Adaga Veysel Artur</strong></p>
              <p className="text-muted-foreground">Phoenix AI</p>
              <p className="text-muted-foreground">Email : contact@phoenix-ai.com</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Données Collectées</h2>
            <p className="text-muted-foreground leading-relaxed">
              Nous collectons les catégories de données suivantes :
            </p>
            
            <h3 className="text-xl font-medium mt-6 mb-3">3.1 Données d'identification</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Nom et prénom</li>
              <li>Adresse email</li>
              <li>Photo de profil (si fournie via Google)</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-3">3.2 Données d'utilisation</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Historique des conversations avec l'IA</li>
              <li>Code exécuté via le Service</li>
              <li>Sites web créés</li>
              <li>Fichiers uploadés (PDF, images)</li>
              <li>Préférences et paramètres</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-3">3.3 Données techniques</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Adresse IP</li>
              <li>Type de navigateur et appareil</li>
              <li>Pages visitées et temps passé</li>
              <li>Cookies et identifiants de session</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-3">3.4 Données de paiement</h3>
            <p className="text-muted-foreground">
              Les données de paiement (numéro de carte bancaire) sont traitées directement par notre 
              prestataire Stripe et ne sont jamais stockées sur nos serveurs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Finalités du Traitement</h2>
            <p className="text-muted-foreground leading-relaxed">
              Vos données sont collectées pour les finalités suivantes :
            </p>
            <table className="w-full mt-4 border border-border rounded-lg overflow-hidden">
              <thead className="bg-card">
                <tr>
                  <th className="text-left p-3 border-b border-border">Finalité</th>
                  <th className="text-left p-3 border-b border-border">Base légale</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border">
                  <td className="p-3">Fourniture du Service</td>
                  <td className="p-3">Exécution du contrat</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Gestion du compte utilisateur</td>
                  <td className="p-3">Exécution du contrat</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Traitement des paiements</td>
                  <td className="p-3">Exécution du contrat</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Amélioration du Service</td>
                  <td className="p-3">Intérêt légitime</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Communication marketing</td>
                  <td className="p-3">Consentement</td>
                </tr>
                <tr>
                  <td className="p-3">Sécurité et prévention des fraudes</td>
                  <td className="p-3">Intérêt légitime</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Durée de Conservation</h2>
            <p className="text-muted-foreground leading-relaxed">
              Nous conservons vos données selon les durées suivantes :
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
              <li><strong>Données de compte :</strong> Pendant la durée de votre inscription + 3 ans après suppression</li>
              <li><strong>Historique des conversations :</strong> 1 an (ou selon votre abonnement)</li>
              <li><strong>Données de paiement :</strong> 10 ans (obligation légale)</li>
              <li><strong>Logs techniques :</strong> 1 an</li>
              <li><strong>Cookies :</strong> 13 mois maximum</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Partage des Données</h2>
            <p className="text-muted-foreground leading-relaxed">
              Vos données peuvent être partagées avec les destinataires suivants :
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
              <li><strong>Stripe :</strong> Traitement des paiements (États-Unis, certifié Privacy Shield)</li>
              <li><strong>Google :</strong> Authentification OAuth (États-Unis)</li>
              <li><strong>E2B :</strong> Exécution de code dans des sandboxes sécurisées</li>
              <li><strong>Groq / Google AI :</strong> Traitement des requêtes IA</li>
              <li><strong>Serper :</strong> Recherche web</li>
              <li><strong>Manus :</strong> Hébergement de l'application</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Nous ne vendons jamais vos données personnelles à des tiers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Transferts Internationaux</h2>
            <p className="text-muted-foreground leading-relaxed">
              Certaines de vos données peuvent être transférées vers des pays hors de l'Union Européenne 
              (notamment les États-Unis). Ces transferts sont encadrés par :
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
              <li>Les clauses contractuelles types de la Commission Européenne</li>
              <li>Le Data Privacy Framework (pour les entreprises américaines certifiées)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Vos Droits (RGPD)</h2>
            <p className="text-muted-foreground leading-relaxed">
              Conformément au RGPD, vous disposez des droits suivants :
            </p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="font-medium text-foreground mb-2">Droit d'accès</h4>
                <p className="text-sm text-muted-foreground">Obtenir une copie de vos données personnelles</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="font-medium text-foreground mb-2">Droit de rectification</h4>
                <p className="text-sm text-muted-foreground">Corriger des données inexactes</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="font-medium text-foreground mb-2">Droit à l'effacement</h4>
                <p className="text-sm text-muted-foreground">Demander la suppression de vos données</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="font-medium text-foreground mb-2">Droit à la portabilité</h4>
                <p className="text-sm text-muted-foreground">Récupérer vos données dans un format lisible</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="font-medium text-foreground mb-2">Droit d'opposition</h4>
                <p className="text-sm text-muted-foreground">Vous opposer au traitement de vos données</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="font-medium text-foreground mb-2">Droit à la limitation</h4>
                <p className="text-sm text-muted-foreground">Limiter le traitement de vos données</p>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Pour exercer ces droits, contactez-nous à : <strong>contact@phoenix-ai.com</strong>
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Vous pouvez également introduire une réclamation auprès de la CNIL : 
              <a href="https://www.cnil.fr" className="text-green-500 hover:underline ml-1">www.cnil.fr</a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Nous utilisons des cookies pour :
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
              <li><strong>Cookies essentiels :</strong> Nécessaires au fonctionnement du site (authentification, session)</li>
              <li><strong>Cookies analytiques :</strong> Mesurer l'audience et améliorer le Service</li>
              <li><strong>Cookies de préférences :</strong> Mémoriser vos choix (thème, langue)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Vous pouvez gérer vos préférences de cookies à tout moment via les paramètres de votre navigateur.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Sécurité des Données</h2>
            <p className="text-muted-foreground leading-relaxed">
              Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos données :
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
              <li>Chiffrement des données en transit (HTTPS/TLS)</li>
              <li>Chiffrement des données sensibles au repos (AES-256)</li>
              <li>Authentification sécurisée (OAuth 2.0)</li>
              <li>Isolation des environnements d'exécution de code (sandboxes E2B)</li>
              <li>Audits de sécurité réguliers</li>
              <li>Accès restreint aux données (principe du moindre privilège)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Données des Mineurs</h2>
            <p className="text-muted-foreground leading-relaxed">
              Phoenix AI n'est pas destiné aux personnes de moins de 16 ans. Nous ne collectons pas 
              sciemment de données personnelles de mineurs. Si vous êtes parent et découvrez que votre 
              enfant nous a fourni des données, contactez-nous pour les supprimer.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Modifications</h2>
            <p className="text-muted-foreground leading-relaxed">
              Nous pouvons mettre à jour cette politique de confidentialité. En cas de modification 
              substantielle, nous vous en informerons par email ou via une notification dans le Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Contact DPO</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pour toute question relative à la protection de vos données personnelles :
            </p>
            <div className="bg-card border border-border rounded-lg p-4 mt-4">
              <p className="text-foreground"><strong>Délégué à la Protection des Données</strong></p>
              <p className="text-muted-foreground">Email : dpo@phoenix-ai.com</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-12">
        <div className="container text-center text-sm text-muted-foreground">
          © 2025 Phoenix AI - Propriété Adaga Veysel Artur - Tous droits réservés
        </div>
      </footer>
    </div>
  );
}
