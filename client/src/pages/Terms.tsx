import { Brain, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Terms() {
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
        <h1 className="text-4xl font-bold mb-2">Conditions Générales d'Utilisation</h1>
        <p className="text-muted-foreground mb-8">Dernière mise à jour : 7 janvier 2025</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Objet</h2>
            <p className="text-muted-foreground leading-relaxed">
              Les présentes Conditions Générales d'Utilisation (ci-après "CGU") ont pour objet de définir 
              les modalités et conditions d'utilisation des services proposés par Phoenix AI (ci-après "le Service"), 
              ainsi que de définir les droits et obligations des parties dans ce cadre.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              L'utilisation du Service implique l'acceptation pleine et entière des présentes CGU. 
              Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser le Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description du Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Phoenix AI est un assistant d'intelligence artificielle qui propose les fonctionnalités suivantes :
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
              <li>Conversation avec une intelligence artificielle</li>
              <li>Exécution de code informatique (Python, JavaScript) dans un environnement sécurisé</li>
              <li>Création de sites web avec génération d'URLs publiques</li>
              <li>Analyse de données et de cryptomonnaies</li>
              <li>Recherche d'informations sur Internet</li>
              <li>Génération d'images par intelligence artificielle</li>
              <li>Agent autonome capable d'effectuer des tâches complexes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Accès au Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              L'accès au Service nécessite la création d'un compte utilisateur. L'utilisateur s'engage à fournir 
              des informations exactes et à les maintenir à jour. L'utilisateur est responsable de la confidentialité 
              de ses identifiants de connexion.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Le Service est accessible 24h/24 et 7j/7, sauf en cas de maintenance ou de force majeure. 
              Phoenix AI se réserve le droit de suspendre temporairement l'accès au Service pour des raisons techniques.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Tarification et Paiement</h2>
            <p className="text-muted-foreground leading-relaxed">
              Le Service propose différentes formules d'abonnement :
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
              <li><strong>Gratuit</strong> : Accès limité à 10 messages par jour</li>
              <li><strong>Starter (9€/mois)</strong> : 100 messages/jour, exécution de code, création de sites</li>
              <li><strong>Pro (29€/mois)</strong> : Accès illimité à toutes les fonctionnalités</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Les paiements sont effectués par carte bancaire via notre prestataire sécurisé Stripe. 
              Les abonnements sont renouvelés automatiquement sauf résiliation. L'utilisateur peut résilier 
              son abonnement à tout moment depuis son espace personnel.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Utilisation Acceptable</h2>
            <p className="text-muted-foreground leading-relaxed">
              L'utilisateur s'engage à utiliser le Service de manière responsable et légale. 
              Il est strictement interdit de :
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
              <li>Utiliser le Service pour des activités illégales ou frauduleuses</li>
              <li>Générer du contenu haineux, discriminatoire ou portant atteinte aux droits d'autrui</li>
              <li>Tenter de contourner les mesures de sécurité du Service</li>
              <li>Exécuter du code malveillant ou tenter d'accéder à des systèmes non autorisés</li>
              <li>Utiliser le Service pour du spam ou des activités de phishing</li>
              <li>Revendre ou redistribuer l'accès au Service sans autorisation</li>
              <li>Utiliser le Service pour créer des armes ou des contenus dangereux</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Propriété Intellectuelle</h2>
            <p className="text-muted-foreground leading-relaxed">
              Phoenix AI et tous ses éléments (logo, interface, code source, algorithmes) sont la propriété 
              exclusive de Adaga Veysel Artur. Toute reproduction ou utilisation non autorisée est interdite.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Le contenu généré par l'utilisateur via le Service (code, textes, images) reste la propriété 
              de l'utilisateur. Cependant, l'utilisateur accorde à Phoenix AI une licence non exclusive 
              pour améliorer le Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Limitation de Responsabilité</h2>
            <p className="text-muted-foreground leading-relaxed">
              Phoenix AI est fourni "en l'état". Nous ne garantissons pas que le Service sera exempt d'erreurs 
              ou d'interruptions. Les réponses générées par l'intelligence artificielle peuvent contenir des 
              inexactitudes et ne constituent pas des conseils professionnels.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              En aucun cas, Phoenix AI ne pourra être tenu responsable des dommages directs ou indirects 
              résultant de l'utilisation du Service, y compris mais sans s'y limiter : pertes de données, 
              pertes financières, ou dommages causés par l'exécution de code.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Avertissement pour les analyses crypto :</strong> Les analyses de cryptomonnaies fournies 
              par Phoenix AI sont à titre informatif uniquement et ne constituent pas des conseils en investissement. 
              L'utilisateur est seul responsable de ses décisions d'investissement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Données Personnelles</h2>
            <p className="text-muted-foreground leading-relaxed">
              Le traitement des données personnelles est décrit dans notre{" "}
              <Link href="/privacy" className="text-green-500 hover:underline">Politique de Confidentialité</Link>.
              En utilisant le Service, vous acceptez ce traitement conformément au RGPD.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Modification des CGU</h2>
            <p className="text-muted-foreground leading-relaxed">
              Phoenix AI se réserve le droit de modifier les présentes CGU à tout moment. 
              Les utilisateurs seront informés des modifications par email ou via le Service. 
              La poursuite de l'utilisation du Service après modification vaut acceptation des nouvelles CGU.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Résiliation</h2>
            <p className="text-muted-foreground leading-relaxed">
              L'utilisateur peut résilier son compte à tout moment. Phoenix AI se réserve le droit de 
              suspendre ou résilier un compte en cas de violation des présentes CGU, sans préavis ni remboursement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Droit Applicable et Juridiction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Les présentes CGU sont régies par le droit français. En cas de litige, les parties s'engagent 
              à rechercher une solution amiable. À défaut, les tribunaux français seront seuls compétents.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pour toute question concernant ces CGU, vous pouvez nous contacter à :
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Email :</strong> contact@phoenix-ai.com
            </p>
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
