import { Brain, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Legal() {
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
        <h1 className="text-4xl font-bold mb-2">Mentions Légales</h1>
        <p className="text-muted-foreground mb-8">Conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Éditeur du Site</h2>
            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-foreground mb-2"><strong>Raison sociale :</strong> Phoenix AI</p>
              <p className="text-muted-foreground mb-2"><strong>Propriétaire :</strong> Adaga Veysel Artur</p>
              <p className="text-muted-foreground mb-2"><strong>Statut :</strong> Entrepreneur individuel / Auto-entrepreneur</p>
              <p className="text-muted-foreground mb-2"><strong>Email :</strong> contact@phoenix-ai.com</p>
              <p className="text-muted-foreground mb-2"><strong>Directeur de la publication :</strong> Adaga Veysel Artur</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Hébergeur</h2>
            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-foreground mb-2"><strong>Nom :</strong> Manus</p>
              <p className="text-muted-foreground mb-2"><strong>Site web :</strong> <a href="https://manus.im" className="text-green-500 hover:underline">https://manus.im</a></p>
              <p className="text-muted-foreground">L'hébergement est assuré par Manus, une plateforme d'intelligence artificielle.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Propriété Intellectuelle</h2>
            <p className="text-muted-foreground leading-relaxed">
              L'ensemble du contenu présent sur le site Phoenix AI, incluant, de façon non limitative, 
              les graphismes, images, textes, vidéos, animations, sons, logos, gifs et icônes ainsi que 
              leur mise en forme sont la propriété exclusive de Adaga Veysel Artur, à l'exception des 
              marques, logos ou contenus appartenant à d'autres sociétés partenaires ou auteurs.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Toute reproduction, distribution, modification, adaptation, retransmission ou publication, 
              même partielle, de ces différents éléments est strictement interdite sans l'accord exprès 
              par écrit de Adaga Veysel Artur. Cette représentation ou reproduction, par quelque procédé 
              que ce soit, constitue une contrefaçon sanctionnée par les articles L.335-2 et suivants du 
              Code de la propriété intellectuelle.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Limitation de Responsabilité</h2>
            <p className="text-muted-foreground leading-relaxed">
              Phoenix AI ne pourra être tenu responsable des dommages directs et indirects causés au 
              matériel de l'utilisateur, lors de l'accès au site, et résultant soit de l'utilisation 
              d'un matériel ne répondant pas aux spécifications techniques requises, soit de l'apparition 
              d'un bug ou d'une incompatibilité.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Phoenix AI ne pourra également être tenu responsable des dommages indirects (tels par 
              exemple qu'une perte de marché ou perte d'une chance) consécutifs à l'utilisation du site.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Avertissement concernant l'intelligence artificielle :</strong> Les réponses 
              générées par Phoenix AI sont produites par des modèles d'intelligence artificielle et 
              peuvent contenir des erreurs ou inexactitudes. Ces réponses ne constituent en aucun cas 
              des conseils professionnels (juridiques, médicaux, financiers, etc.). L'utilisateur est 
              seul responsable de l'utilisation qu'il fait des informations fournies.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Avertissement concernant les cryptomonnaies :</strong> Les analyses et informations 
              relatives aux cryptomonnaies fournies par Phoenix AI sont à titre informatif uniquement. 
              Elles ne constituent pas des conseils en investissement. L'investissement dans les 
              cryptomonnaies comporte des risques de perte en capital. Consultez un conseiller financier 
              agréé avant toute décision d'investissement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Données Personnelles</h2>
            <p className="text-muted-foreground leading-relaxed">
              Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi 
              Informatique et Libertés, vous disposez d'un droit d'accès, de rectification, de 
              suppression et d'opposition aux données personnelles vous concernant.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Pour plus d'informations sur le traitement de vos données personnelles, veuillez 
              consulter notre{" "}
              <Link href="/privacy" className="text-green-500 hover:underline">Politique de Confidentialité</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Le site Phoenix AI utilise des cookies pour améliorer l'expérience utilisateur. 
              En naviguant sur le site, vous acceptez l'utilisation de cookies conformément à notre 
              politique de cookies détaillée dans notre{" "}
              <Link href="/privacy" className="text-green-500 hover:underline">Politique de Confidentialité</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Liens Hypertextes</h2>
            <p className="text-muted-foreground leading-relaxed">
              Le site Phoenix AI peut contenir des liens hypertextes vers d'autres sites. Cependant, 
              Phoenix AI n'a pas la possibilité de vérifier le contenu des sites ainsi visités, et 
              n'assumera en conséquence aucune responsabilité de ce fait.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Droit Applicable</h2>
            <p className="text-muted-foreground leading-relaxed">
              Les présentes mentions légales sont régies par le droit français. En cas de litige, 
              et après échec de toute tentative de recherche d'une solution amiable, les tribunaux 
              français seront seuls compétents pour connaître de ce litige.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pour toute question ou réclamation concernant le site Phoenix AI, vous pouvez nous 
              contacter :
            </p>
            <div className="bg-card border border-border rounded-lg p-6 mt-4">
              <p className="text-muted-foreground mb-2"><strong>Par email :</strong> contact@phoenix-ai.com</p>
              <p className="text-muted-foreground"><strong>Par courrier :</strong> Phoenix AI - Adaga Veysel Artur</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Crédits</h2>
            <p className="text-muted-foreground leading-relaxed">
              <strong>Conception et développement :</strong> Adaga Veysel Artur avec l'assistance de Manus AI
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              <strong>Technologies utilisées :</strong> React, TypeScript, Tailwind CSS, tRPC, Node.js
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              <strong>Services tiers :</strong> Stripe (paiements), E2B (exécution de code), 
              Groq/Google AI (intelligence artificielle), Serper (recherche web)
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
