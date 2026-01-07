/**
 * Streaming Chat Module - Réponses en temps réel avec SSE
 * Permet à Phoenix de générer des réponses en streaming
 */

import { invokeLLM } from '../_core/llm';
import { streamWithToolHandling } from './groqToolHandler';
import { generateAndExecuteCompleteFlow, isCodeRequest } from './smartCodeExecutor';
import { analyzeAndExecuteAutomatically, createEnrichedSystemPrompt } from './autoExecutionEngine';
import { generateCryptoExpertContext, getCryptoExpertSystemPrompt, detectCryptoExpertQuery } from './cryptoExpertIntegration';
import { multiSourceIntegration } from './multiSourceIntegration';
import { shouldUseAgentLoop, processWithAgentLoop } from './agentLoop';
import { autonomousBrowser } from './autonomousBrowser';
import { staticSiteGenerator } from './staticSiteGenerator';
import { createHostedSite } from '../hostedSites';
import { detectRequestType, extractSiteName, shouldResetContext, updateContext, getContext, resetContext, RequestType } from './contextManager';
import { getAutonomyCore, AutonomyConfig } from './autonomyCore';
import { detectIntent } from './intentDetector';

interface StreamingOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Format messages for streaming
 */
export function formatMessagesForStreaming(
  systemPrompt: string,
  userMessage: string,
  context?: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt }
  ];
  if (context) {
    messages.push({ role: 'system', content: `Context: ${context}` });
  }
  messages.push({ role: 'user', content: userMessage });
  return messages;
}

/**
 * Détecte si c'est une demande de CRÉATION de site web (pas de navigation)
 */
interface WebsiteCreationRequest {
  shouldCreate: boolean;
  type: 'hotel' | 'restaurant' | 'business' | 'portfolio' | 'landing' | 'custom';
  details: {
    name?: string;
    address?: string;
    city?: string;
    description?: string;
    features?: string[];
    phone?: string;
    email?: string;
    prices?: Record<string, number>;
    rooms?: { type: string; price: number }[];
  };
}

function detectWebsiteCreationRequest(message: string): WebsiteCreationRequest {
  const lowerMessage = message.toLowerCase();
  
  // Patterns pour détecter une demande de CRÉATION de site (pas navigation)
  // Français, Anglais, Allemand, Luxembourgeois
  const creationPatterns = [
    // Français - Patterns améliorés
    /(?:cr[ée]e|cr[ée]er|fais|faire|g[ée]n[èe]re|g[ée]n[ée]rer|construis|construire|d[ée]veloppe|d[ée]velopper)\s+(?:moi\s+)?(?:un[e]?\s+)?(?:site|page)/i,
    // "crée un site pour X" - pattern très commun
    /cr[ée]e[rz]?\s+(?:moi\s+)?(?:un[e]?\s+)?site\s+(?:web\s+)?(?:pour|d'|de)/i,
    // "site pour un X" avec verbe de création implicite
    /(?:un[e]?\s+)?site\s+(?:web\s+)?pour\s+(?:un[e]?\s+)?(?:h[ôo]tel|restaurant|entreprise|business|portfolio|coach|avocat|dentiste|plombier|fleuriste|architecte|musicien|photographe|boulanger|[ée]lectricien|psychologue|startup)/i,
    /(?:j'aimerais|je\s+voudrais|je\s+veux)\s+(?:que\s+tu\s+)?(?:cr[ée]es?|fasses?|g[ée]n[èe]res?)\s+(?:un[e]?\s+)?(?:site|page)/i,
    /(?:peux|peut|pourrais|pourrait)[-\s]*(?:tu|vous)?\s*(?:cr[ée]er|faire|g[ée]n[ée]rer)\s+(?:un[e]?\s+)?(?:site|page)/i,
    // Anglais
    /(?:create|make|build|generate|develop)\s+(?:me\s+)?(?:a\s+)?(?:website|web\s+page|landing\s+page|site)/i,
    /(?:can\s+you|could\s+you|please)\s+(?:create|make|build|generate)\s+(?:a\s+)?(?:website|site|page)/i,
    /(?:i\s+want|i\s+need|i'd\s+like)\s+(?:a\s+)?(?:website|site|page)\s+for/i,
    // Allemand
    /(?:erstelle|erstellen|mache|machen|baue|bauen|generiere|generieren|entwickle|entwickeln)\s+(?:mir\s+)?(?:eine?\s+)?(?:webseite|website|seite|landingpage)/i,
    /(?:kannst\s+du|könntest\s+du|bitte)\s+(?:eine?\s+)?(?:webseite|website|seite)\s+(?:erstellen|machen|bauen)/i,
    /(?:ich\s+möchte|ich\s+brauche|ich\s+will)\s+(?:eine?\s+)?(?:webseite|website|seite)\s+für/i,
    // Luxembourgeois
    /(?:maach|maachen|bau|bauen|erstell|erstellen)\s+(?:mir\s+)?(?:eng?\s+)?(?:websäit|site|säit)/i,
    /(?:kanns\s+du|kéints\s+du)\s+(?:eng?\s+)?(?:websäit|site)\s+(?:maachen|bauen)/i,
    // Mot-clé explicite "static_site_create" dans n'importe quelle langue
    /static_site_create/i,
  ];
  
  // Vérifier si c'est une demande de création
  const isCreationRequest = creationPatterns.some(p => p.test(message));
  
  if (!isCreationRequest) {
    return { shouldCreate: false, type: 'custom', details: {} };
  }
  
  // Détecter le type de site
  let type: WebsiteCreationRequest['type'] = 'custom';
  if (/h[ôo]tel/i.test(lowerMessage)) {
    type = 'hotel';
  } else if (/restaurant|resto|caf[ée]/i.test(lowerMessage)) {
    type = 'restaurant';
  } else if (/portfolio|cv|r[ée]sum[ée]/i.test(lowerMessage)) {
    type = 'portfolio';
  } else if (/landing|accueil|promo/i.test(lowerMessage)) {
    type = 'landing';
  } else if (/entreprise|business|soci[ée]t[ée]|commerce/i.test(lowerMessage)) {
    type = 'business';
  }
  
  // Extraire les détails
  const details: WebsiteCreationRequest['details'] = {};
  
  // Extraire le nom (après "s'appelle", "nom", "nommé", etc.)
  const nameMatch = message.match(/(?:s'appelle|nom(?:m[ée])?(?:\s+est)?|appel[ée])\s+["']?([^"',.\n]+)["']?/i) ||
                    message.match(/(?:h[ôo]tel|restaurant|entreprise)\s+["']?([A-Z][^"',.\n]+)["']?/i);
  if (nameMatch) {
    details.name = nameMatch[1].trim();
  }
  
  // Extraire l'adresse
  const addressMatch = message.match(/(?:situ[ée]|adresse|au|à)\s+(?:au\s+)?(\d+[^,.\n]+)/i);
  if (addressMatch) {
    details.address = addressMatch[1].trim();
  }
  
  // Extraire la ville
  const cityMatch = message.match(/(?:à|au|en)\s+([A-Z][a-zéèêëàâäùûüôöîïç]+(?:\s+[A-Z][a-zéèêëàâäùûüôöîïç]+)?)\s*(?:,|$|\.|avec|qui)/i);
  if (cityMatch) {
    details.city = cityMatch[1].trim();
  }
  
  // Extraire le nombre de chambres (pour hôtels)
  const roomsMatch = message.match(/(\d+)\s*chambres?/i);
  if (roomsMatch) {
    details.features = details.features || [];
    details.features.push(`${roomsMatch[1]} chambres`);
  }
  
  // Extraire les prix des chambres
  const priceRegex = /chambre\s+(single|double|twin|triple|familiale?|suite)\s*(?:à|:)?\s*(\d+)\s*[€$]/gi;
  const rooms: { type: string; price: number }[] = [];
  let priceMatch;
  while ((priceMatch = priceRegex.exec(message)) !== null) {
    rooms.push({ type: priceMatch[1], price: parseInt(priceMatch[2]) });
  }
  if (rooms.length > 0) {
    details.rooms = rooms;
  }
  
  // Extraire les prix génériques
  const genericPriceRegex = /(single|double|twin)\s*(?:et|\/|,)?\s*(?:double|twin)?\s*(?:prix\s*)?(?:à|:)?\s*(\d+)\s*[€$]/gi;
  let genericMatch;
  while ((genericMatch = genericPriceRegex.exec(message)) !== null) {
    if (!details.rooms) details.rooms = [];
    details.rooms.push({ type: genericMatch[1], price: parseInt(genericMatch[2]) });
  }
  
  // Extraire le téléphone
  const phoneMatch = message.match(/(?:t[ée]l[ée]phone|tel|num[ée]ro)\s*(?::|est)?\s*([\d\s+()-]+)/i);
  if (phoneMatch) {
    details.phone = phoneMatch[1].trim();
  }
  
  // Extraire l'email
  const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    details.email = emailMatch[1];
  }
  
  // Extraire les services/features
  const servicesMatch = message.match(/(?:services?|[ée]quipements?|avec)\s*(?::|inclus)?\s*([^.]+)/i);
  if (servicesMatch) {
    const services = servicesMatch[1].split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
    details.features = [...(details.features || []), ...services];
  }
  
  return {
    shouldCreate: true,
    type,
    details
  };
}

/**
 * Génère un site web basé sur la demande détectée
 */
async function generateWebsite(request: WebsiteCreationRequest, userId: number, originalMessage: string): Promise<string> {
  console.log('[StreamingChat] Generating website:', request);
  
  const { type, details } = request;
  
  // Utiliser extractSiteName du contextManager pour une meilleure extraction
  const extractedName = extractSiteName(originalMessage);
  
  // Générer le nom avec priorité: details.name > extractedName > nom générique basé sur le type
  let siteName: string;
  if (details.name && details.name !== 'Mon Site') {
    siteName = details.name;
  } else if (extractedName) {
    siteName = extractedName;
  } else {
    // Noms génériques améliorés par type
    const typeNames: Record<string, string> = {
      'hotel': 'Hôtel Prestige',
      'restaurant': 'Restaurant Gourmet',
      'business': 'Entreprise Pro',
      'portfolio': 'Portfolio Créatif',
      'landing': 'Landing Page',
      'custom': 'Site Professionnel'
    };
    siteName = typeNames[type] || 'Site Professionnel';
  }
  
  console.log(`[StreamingChat] Site name resolved: "${siteName}" (from: details=${details.name}, extracted=${extractedName})`);
  
  // Générer le HTML selon le type
  let htmlContent: string;
  
  if (type === 'hotel') {
    // Utiliser le template d'hôtel avec formulaire de réservation COMPLET
    htmlContent = generateHotelSiteWithBooking({
      name: siteName,
      address: details.address || 'Adresse non spécifiée',
      city: details.city || '',
      description: details.description || `Bienvenue à ${siteName}`,
      features: details.features || ['WiFi Gratuit', 'Parking', 'Réception 24h/24'],
      phone: details.phone || '+352 000 000 000',
      email: details.email || 'contact@hotel.com',
      rooms: details.rooms || [
        { type: 'Single', price: 90 },
        { type: 'Double', price: 130 },
        { type: 'Twin', price: 130 }
      ]
    });
  } else {
    // Template générique pour les autres types
    htmlContent = generateHotelSiteWithBooking({
      name: siteName,
      address: details.address || '',
      city: details.city || '',
      description: details.description || `Bienvenue à ${siteName}`,
      features: details.features || ['Service professionnel', 'Accueil chaleureux'],
      phone: details.phone || '+352 000 000 000',
      email: details.email || 'contact@hotel.com',
      rooms: details.rooms || [
        { type: 'Standard', price: 80 },
        { type: 'Confort', price: 120 }
      ]
    });
  }
  
  // Sauvegarder en base de données
  try {
    const result = await staticSiteGenerator.createFromHTML(
      userId,
      siteName,
      htmlContent,
      {
        description: `Site ${type} créé par Phoenix AI`,
        siteType: 'business',
        isPublic: true
      }
    );
    
    if (result.success && result.permanentUrl) {
      return `## 🎉 Site créé avec succès!

**${siteName}** est maintenant en ligne!

🔗 **URL PERMANENTE:** [${result.permanentUrl}](${result.permanentUrl})

Cette URL ne disparaîtra JAMAIS et est prête à être partagée!

### ✨ Ce qui a été créé:
- Design moderne et responsive
- ${type === 'hotel' ? 'Formulaire de réservation avec calcul automatique des prix' : 'Page de présentation professionnelle'}
- Section contact
- Optimisé pour mobile

${details.rooms ? `### 💰 Tarifs configurés:\n${details.rooms.map(r => `- Chambre ${r.type}: ${r.price}€/nuit`).join('\n')}` : ''}

💡 Cliquez sur le lien pour voir votre site!`;
    } else {
      return `❌ Erreur lors de la création du site: ${result.error || 'Erreur inconnue'}`;
    }
  } catch (error: any) {
    console.error('[StreamingChat] Website generation error:', error);
    return `❌ Erreur lors de la création du site: ${error.message}`;
  }
}

/**
 * Génère un site d'hôtel complet avec formulaire de réservation
 */
function generateHotelSiteWithBooking(config: {
  name: string;
  address: string;
  city?: string;
  description?: string;
  features?: string[];
  phone?: string;
  email?: string;
  rooms: { type: string; price: number }[];
}): string {
  const roomOptions = config.rooms.map(r => 
    `<option value="${r.type.toLowerCase()}" data-price="${r.price}">${r.type} - ${r.price}€/nuit</option>`
  ).join('\n                ');
  
  const roomPricesJS = config.rooms.map(r => 
    `'${r.type.toLowerCase()}': ${r.price}`
  ).join(', ');
  
  const featuresHTML = (config.features || []).map(f => 
    `<li>✓ ${f}</li>`
  ).join('\n            ');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
        }
        .hero {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: white;
            padding: 100px 20px;
            text-align: center;
        }
        .hero h1 {
            font-size: 3rem;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .hero p {
            font-size: 1.3rem;
            opacity: 0.9;
            max-width: 600px;
            margin: 0 auto;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 60px 20px;
        }
        .section-title {
            text-align: center;
            font-size: 2rem;
            margin-bottom: 40px;
            color: #1a1a2e;
        }
        .rooms-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 30px;
            margin-bottom: 60px;
        }
        .room-card {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            text-align: center;
            transition: transform 0.3s;
        }
        .room-card:hover {
            transform: translateY(-5px);
        }
        .room-card h3 {
            color: #1a1a2e;
            margin-bottom: 15px;
        }
        .room-price {
            font-size: 2rem;
            color: #e94560;
            font-weight: bold;
        }
        .room-price span {
            font-size: 1rem;
            color: #666;
        }
        .booking-section {
            background: #f8f9fa;
            padding: 60px 20px;
        }
        .booking-form {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 15px 40px rgba(0,0,0,0.1);
        }
        .form-group {
            margin-bottom: 25px;
        }
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #1a1a2e;
        }
        .form-group input,
        .form-group select {
            width: 100%;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 1rem;
            transition: border-color 0.3s;
        }
        .form-group input:focus,
        .form-group select:focus {
            outline: none;
            border-color: #e94560;
        }
        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        .price-estimate {
            background: linear-gradient(135deg, #1a1a2e, #0f3460);
            color: white;
            padding: 25px;
            border-radius: 15px;
            text-align: center;
            margin: 30px 0;
        }
        .price-estimate .total {
            font-size: 2.5rem;
            font-weight: bold;
        }
        .btn-submit {
            width: 100%;
            padding: 18px;
            background: linear-gradient(135deg, #e94560, #ff6b6b);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1.2rem;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.3s, box-shadow 0.3s;
        }
        .btn-submit:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(233, 69, 96, 0.4);
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 40px 0;
        }
        .features li {
            list-style: none;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
            text-align: center;
        }
        .contact-info {
            background: #1a1a2e;
            color: white;
            padding: 60px 20px;
            text-align: center;
        }
        .contact-info h2 {
            margin-bottom: 30px;
        }
        .contact-info p {
            margin: 10px 0;
            font-size: 1.1rem;
        }
        footer {
            background: #0f0f1a;
            color: #888;
            text-align: center;
            padding: 30px;
        }
        @media (max-width: 768px) {
            .hero h1 { font-size: 2rem; }
            .form-row { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <header class="hero">
        <h1>🏨 ${config.name}</h1>
        <p>${config.description || 'Votre confort est notre priorité'}</p>
        <p style="margin-top: 20px; opacity: 0.8;">📍 ${config.address}${config.city ? ', ' + config.city : ''}</p>
    </header>

    <div class="container">
        <h2 class="section-title">Nos Chambres</h2>
        <div class="rooms-grid">
            ${config.rooms.map(room => `
            <div class="room-card">
                <h3>Chambre ${room.type}</h3>
                <p class="room-price">${room.price}€ <span>/ nuit</span></p>
                <p style="color: #666; margin-top: 10px;">Petit-déjeuner non inclus</p>
            </div>
            `).join('')}
        </div>

        <h2 class="section-title">Nos Services</h2>
        <ul class="features">
            ${featuresHTML || '<li>✓ WiFi Gratuit</li><li>✓ Parking</li><li>✓ Réception 24h/24</li>'}
        </ul>
    </div>

    <section class="booking-section" id="reservation">
        <div class="booking-form">
            <h2 style="text-align: center; margin-bottom: 30px; color: #1a1a2e;">📅 Réserver une Chambre</h2>
            
            <form id="bookingForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>Prénom</label>
                        <input type="text" id="firstName" required placeholder="Votre prénom">
                    </div>
                    <div class="form-group">
                        <label>Nom</label>
                        <input type="text" id="lastName" required placeholder="Votre nom">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Genre</label>
                        <select id="gender" required>
                            <option value="">Sélectionnez</option>
                            <option value="homme">Homme</option>
                            <option value="femme">Femme</option>
                            <option value="autre">Autre</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Type de chambre</label>
                        <select id="roomType" required>
                            <option value="">Sélectionnez</option>
                            ${roomOptions}
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Nombre d'adultes</label>
                        <input type="number" id="adults" min="1" max="10" value="1" required>
                    </div>
                    <div class="form-group">
                        <label>Nombre d'enfants</label>
                        <input type="number" id="children" min="0" max="10" value="0">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Date d'arrivée</label>
                        <input type="date" id="checkIn" required>
                    </div>
                    <div class="form-group">
                        <label>Date de départ</label>
                        <input type="date" id="checkOut" required>
                    </div>
                </div>

                <div class="price-estimate">
                    <p>Prix estimé</p>
                    <p class="total" id="totalPrice">0€</p>
                    <p style="font-size: 0.9rem; opacity: 0.8;">Petit-déjeuner non inclus</p>
                </div>

                <button type="submit" class="btn-submit">Confirmer la Réservation</button>
            </form>
        </div>
    </section>

    <section class="contact-info">
        <h2>📞 Contactez-nous</h2>
        <p>📍 ${config.address}${config.city ? ', ' + config.city : ''}</p>
        <p>📱 ${config.phone || '+352 000 000 000'}</p>
        <p>✉️ ${config.email || 'contact@hotel.com'}</p>
    </section>

    <footer>
        <p>© ${new Date().getFullYear()} ${config.name} - Tous droits réservés</p>
        <p style="margin-top: 10px; font-size: 0.9rem;">Site créé avec Phoenix AI</p>
    </footer>

    <script>
        const roomPrices = { ${roomPricesJS} };
        
        // Set minimum dates
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('checkIn').min = today;
        document.getElementById('checkOut').min = today;
        
        // Calculate price
        function calculatePrice() {
            const roomType = document.getElementById('roomType').value;
            const checkIn = new Date(document.getElementById('checkIn').value);
            const checkOut = new Date(document.getElementById('checkOut').value);
            
            if (roomType && checkIn && checkOut && checkOut > checkIn) {
                const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
                const pricePerNight = roomPrices[roomType] || 0;
                const total = nights * pricePerNight;
                document.getElementById('totalPrice').textContent = total + '€';
            } else {
                document.getElementById('totalPrice').textContent = '0€';
            }
        }
        
        // Event listeners
        document.getElementById('roomType').addEventListener('change', calculatePrice);
        document.getElementById('checkIn').addEventListener('change', function() {
            document.getElementById('checkOut').min = this.value;
            calculatePrice();
        });
        document.getElementById('checkOut').addEventListener('change', calculatePrice);
        
        // Form submission
        document.getElementById('bookingForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = {
                firstName: document.getElementById('firstName').value,
                lastName: document.getElementById('lastName').value,
                gender: document.getElementById('gender').value,
                roomType: document.getElementById('roomType').value,
                adults: document.getElementById('adults').value,
                children: document.getElementById('children').value,
                checkIn: document.getElementById('checkIn').value,
                checkOut: document.getElementById('checkOut').value,
                totalPrice: document.getElementById('totalPrice').textContent
            };
            
            alert('Merci ' + formData.firstName + ' ' + formData.lastName + '!\\n\\nVotre demande de réservation a été enregistrée.\\n\\nDétails:\\n- Chambre: ' + formData.roomType + '\\n- Du ' + formData.checkIn + ' au ' + formData.checkOut + '\\n- ' + formData.adults + ' adulte(s), ' + formData.children + ' enfant(s)\\n- Total: ' + formData.totalPrice + '\\n\\nNous vous contacterons bientôt pour confirmer.');
        });
    </script>
</body>
</html>`;
}

/**
 * Détecte si c'est une demande conversationnelle simple qui ne nécessite pas Groq
 */
function isSimpleConversationalRequest(message: string): boolean {
  const conversationalPatterns = [
    // Salutations
    /^(?:salut|bonjour|bonsoir|coucou|hello|hi|hey)\b/i,
    /^(?:ça va|comment vas-tu|comment tu vas|how are you)/i,
    
    // Demandes créatives textuelles
    /(?:raconte|raconter|dis|dire)[\s-]*(?:moi)?[\s-]*(?:une|un)?[\s-]*(?:blague|histoire|conte|poème|joke)/i,
    /(?:écris|écrire|rédige|rédiger)[\s-]*(?:moi)?[\s-]*(?:un|une)?[\s-]*(?:poème|histoire|texte|lettre|email|mail|article)/i,
    /(?:fais|faire)[\s-]*(?:moi)?[\s-]*(?:une|un)?[\s-]*(?:blague|histoire|poème)/i,
    
    // Traductions
    /(?:traduis|traduire|translate)[\s-]/i,
    
    // Résumés
    /(?:résume|résumer|summarize)[\s-]/i,
    
    // Explications simples
    /(?:explique|expliquer|explain)[\s-]*(?:moi)?[\s-]*(?:ce|cette|cet|le|la|les)?/i,
    
    // Calculs simples
    /^(?:combien|how much|how many)[\s-]*(?:font|fait|is|are|equals?)[\s-]*\d/i,
    /^\d+[\s]*[\+\-\*\/][\s]*\d+/,
    
    // Questions oui/non
    /^(?:est-ce que|is it|are you|do you|can you|peux-tu|sais-tu)/i,
    
    // Questions de culture générale basiques
    /^(?:quelle est|quel est|what is|who is|c'est quoi|qu'est-ce que)[\s-]+(?:la|le|un|une|a|an|the)?[\s-]*(?:capitale|capital|président|president|sens|meaning|définition|definition)/i,
  ];
  
  return conversationalPatterns.some(pattern => pattern.test(message));
}

/**
 * Stream chat response using Server-Sent Events
 */
export async function* streamChatResponse(
  messages: Array<{ role: string; content: string }>,
  options?: StreamingOptions,
  userId?: number,
  username?: string
): AsyncGenerator<string> {
  try {
    // Get the user message (last message)
    const userMessage = messages[messages.length - 1]?.content || '';
    
    // === GESTION DU CONTEXTE ===
    // Détecter le type de demande actuelle
    const currentRequestType = detectRequestType(userMessage);
    const conversationId = userId || 0;
    const previousContext = getContext(conversationId);
    
    // Vérifier si le contexte doit être réinitialisé
    if (shouldResetContext(currentRequestType, previousContext)) {
      console.log(`[StreamingChat] Context reset: ${previousContext?.lastRequestType} -> ${currentRequestType}`);
      resetContext(conversationId);
    }
    
    console.log(`[StreamingChat] Request type detected: ${currentRequestType}, previous: ${previousContext?.lastRequestType || 'none'}`);
    
    // === INTÉGRATION AUTONOMYCORE ===
    // Utiliser le noyau d'autonomie pour les requêtes complexes
    const intentResult = detectIntent(userMessage);
    const autonomyCore = getAutonomyCore();
    
    // Stocker le contexte dans la mémoire de travail
    autonomyCore['workingMemory'].store('user_message', userMessage, { type: 'context' });
    autonomyCore['workingMemory'].store('intent', intentResult.type, { type: 'context' });
    autonomyCore['workingMemory'].store('confidence', intentResult.confidence, { type: 'context' });
    
    console.log(`[StreamingChat] Intent detected: ${intentResult.type} (confidence: ${intentResult.confidence})`);
    
    // PRIORITÉ 0: Demandes conversationnelles simples - utiliser Google AI directement
    // Cela évite les problèmes de rate limit de Groq pour les questions simples
    if (isSimpleConversationalRequest(userMessage)) {
      console.log('[StreamingChat] Simple conversational request detected, using Google AI directly');
      yield* streamWithGoogleAI(messages, options);
      return;
    }
    
    // PRIORITÉ 1: Vérifier si c'est une demande de CRÉATION de site web
    const websiteRequest = detectWebsiteCreationRequest(userMessage);
    if (websiteRequest.shouldCreate) {
      console.log('[StreamingChat] Website creation request detected:', websiteRequest.type);
      yield `🎨 Je crée votre site ${websiteRequest.type === 'hotel' ? "d'hôtel" : websiteRequest.type}...\n\n`;
      
      try {
        const result = await generateWebsite(websiteRequest, userId || 1, userMessage);
        
        // Mettre à jour le contexte avec les informations du site créé
        const siteName = extractSiteName(userMessage) || websiteRequest.details.name;
        const siteSlugMatch = result.match(/\/sites\/([\w-]+)/);
        updateContext(conversationId, 'site_creation', siteName || undefined, siteSlugMatch?.[1]);
        
        yield result;
        return;
      } catch (error) {
        console.error('[StreamingChat] Website creation error:', error);
        yield `⚠️ Erreur lors de la création du site: ${error instanceof Error ? error.message : 'Erreur inconnue'}\n\n`;
      }
    }
    
    // PRIORITÉ 2: Vérifier si c'est une demande de RECHERCHE web (Serper API - plus rapide)
    // IMPORTANT: Doit être AVANT la navigation pour éviter d'utiliser Browserless pour les recherches
    const isSearchRequest = /(?:cherche|recherche|search|trouve|find|actualit|news|nouvelles)\s+(?:sur|on|about|pour|for)?/i.test(userMessage) &&
      !/(?:va\s+sur|visite|ouvre|navigate|go\s+to)\s+/i.test(userMessage);
    
    if (isSearchRequest) {
      console.log('[StreamingChat] Search request detected, using Serper API');
      yield '🔍 Recherche en cours via Serper API...\n\n';
      
      try {
        const queryDetection = multiSourceIntegration.detectQueryType(userMessage);
        const enrichedData = await multiSourceIntegration.generateEnrichedContext(userMessage);
        
        if (enrichedData.context && enrichedData.context.length > 100) {
          // Ajouter le contexte au message système pour que Phoenix réponde avec les données
          messages[0] = {
            role: 'system',
            content: messages[0].content + '\n\n## DONNÉES DE RECHERCHE EN TEMPS RÉEL (Sources: ' + enrichedData.sources.join(', ') + ')\n' + enrichedData.context + '\n\nIMPORTANT: Utilise ces résultats pour répondre à la question.'
          };
          console.log('[StreamingChat] Search context added, continuing to LLM');
          // Ne pas return ici - laisser le LLM répondre avec les données
        }
      } catch (error) {
        console.error('[StreamingChat] Search error:', error);
        // Continuer sans les données de recherche
      }
    }
    
    // PRIORITÉ 3: Vérifier si c'est une demande de navigation web directe (URL explicite)
    const browseRequest = detectBrowseRequest(userMessage);
    // Ne naviguer que si c'est une URL explicite ou une demande de visite de site
    if (browseRequest.shouldBrowse && browseRequest.url && !isSearchRequest) {
      console.log('[StreamingChat] Browse request detected:', browseRequest.url);
      yield '🌐 Navigation web en cours avec Browserless.io (vrai Chrome cloud)...\n\n';
      
      try {
        const browseResult = await executeBrowseRequest(browseRequest, userMessage);
        yield browseResult;
        return;
      } catch (error) {
        console.error('[StreamingChat] Browse error:', error);
        yield `⚠️ Erreur de navigation: ${error instanceof Error ? error.message : 'Erreur inconnue'}\n\n`;
      }
    }
    
    // PRIORITÉ 4: Vérifier si c'est une tâche complexe multi-étapes (Agent Loop)
    if (shouldUseAgentLoop(userMessage)) {
      console.log('[StreamingChat] Complex task detected, using Agent Loop');
      yield '🧠 Tâche complexe détectée. Je décompose et exécute automatiquement...\n\n';
      
      try {
        const result = await processWithAgentLoop(
          userMessage,
          messages[0]?.content || '',
          (message, progress) => {
            console.log(`[AgentLoop] Progress ${progress}%: ${message}`);
          }
        );
        
        yield result;
        return;
      } catch (error) {
        console.error('[StreamingChat] Agent Loop error:', error);
        yield `⚠️ Erreur lors de l'exécution de la tâche complexe: ${error instanceof Error ? error.message : 'Erreur inconnue'}\n\n`;
      }
    }
    
    // PRIORITÉ 5: Vérifier si c'est une demande d'analyse crypto experte
    const cryptoDetection = detectCryptoExpertQuery(userMessage);
    if (cryptoDetection.needsExpert) {
      console.log('[StreamingChat] Crypto expert query detected:', cryptoDetection.analysisType);
      const cryptoContext = await generateCryptoExpertContext(userMessage);
      
      if (cryptoContext.enrichedContext) {
        // Ajouter le contexte crypto au message système
        const cryptoSystemPrompt = getCryptoExpertSystemPrompt();
        messages[0] = {
          role: 'system',
          content: messages[0].content + '\n\n' + cryptoSystemPrompt + '\n\n## DONNÉES CRYPTO EN TEMPS RÉEL\n' + cryptoContext.enrichedContext
        };
        console.log('[StreamingChat] Crypto context added to system prompt');
      }
    }
    
      // PRIORITÉ 6: Vérifier si c'est une demande météo (si pas déjà traité par recherche)
    const queryDetection = multiSourceIntegration.detectQueryType(userMessage);
    if (queryDetection.types.includes('weather') && !isSearchRequest) {
      console.log('[StreamingChat] Weather query detected');
      try {
        const enrichedData = await multiSourceIntegration.generateEnrichedContext(userMessage);
        if (enrichedData.context) {
          messages[0] = {
            role: 'system',
            content: messages[0].content + '\n\n## DONNÉES MÉTÉO EN TEMPS RÉEL (Sources: ' + enrichedData.sources.join(', ') + ')\n' + enrichedData.context
          };
          console.log('[StreamingChat] Weather context added');
        }
      } catch (error) {
        console.error('[StreamingChat] Weather error:', error);
      }
    }
    
    // PRIORITÉ 7: Vérifier si c'est une demande de code et l'exécuter DIRECTEMENT
    if (isCodeRequest(userMessage)) {
      console.log('[StreamingChat] Code request detected, executing directly');
      const codeResult = await generateAndExecuteCompleteFlow(userMessage);
      if (codeResult.success && codeResult.fullResponse) {
        // Retourner UNIQUEMENT le code et le résultat, pas la réponse de Phoenix
        console.log('[StreamingChat] Code execution successful, returning result');
        yield codeResult.fullResponse;
        return;
      } else {
        console.log('[StreamingChat] Code execution failed:', codeResult.error);
        // Continuer avec Phoenix si le code échoue
      }
    }
    
    // PRIORITÉ 8: Auto-exécution intelligentete
    console.log('[StreamingChat] Analyzing for auto-execution...');
    const conversationHistory = messages.slice(0, -1).map(m => m.role + ': ' + m.content).join('\n');
    const autoExecResult = await analyzeAndExecuteAutomatically({
      userMessage,
      phoenixResponse: '',
      conversationHistory,
      userId: userId || 0,
      username: username || 'User'
    });
    
    if (autoExecResult.shouldExecute) {
      console.log('[StreamingChat] Auto-execution triggered:', autoExecResult.executionType);
      yield autoExecResult.suggestion + '\n\n';
    }
    
    // Use Groq for faster streaming when available
    const apiKey = process.env.GROG_API_KEY;
    console.log('[StreamingChat] Groq API key available:', !!apiKey);
    
    // Enrichir le system prompt avec les 16 Points
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const enrichedPrompt = createEnrichedSystemPrompt(systemPrompt);
    const enrichedMessages = [
      { role: 'system', content: enrichedPrompt },
      ...messages.filter(m => m.role !== 'system')
    ];
    
    if (apiKey) {
      console.log('[StreamingChat] Using Groq API with tool support');
      yield* streamWithGroq(enrichedMessages, options);
    } else {
      // Fallback to Google AI Studio
      console.log('[StreamingChat] Using Google AI fallback');
      yield* streamWithGoogleAI(enrichedMessages, options);
    }
  } catch (error) {
    console.error('[StreamingChat] Error:', error);
    throw error;
  }
}

/**
 * Stream using Groq API with tool support
 */
async function* streamWithGroq(
  messages: Array<{ role: string; content: string }>,
  options?: StreamingOptions
): AsyncGenerator<string> {
  try {
    console.log('[StreamingChat] Groq: Using tool handler for code execution');
    // Utiliser le tool handler qui gère les tool calls ET le streaming
    yield* streamWithToolHandling(messages as any, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[StreamingChat] Tool handler error:', errorMessage);
    
    // Check if it's a rate limit error
    if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
      console.log('[StreamingChat] Groq rate limit detected, using Google AI fallback');
      yield* streamWithGoogleAI(messages, options);
    } else {
      // Fallback au streaming normal sans tools
      yield* streamWithGroqFallback(messages, options);
    }
  }
}

/**
 * Fallback streaming without tools
 */
async function* streamWithGroqFallback(
  messages: Array<{ role: string; content: string }>,
  options?: StreamingOptions
): AsyncGenerator<string> {
  try {
    console.log('[StreamingChat] Groq: Fallback streaming without tools');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROG_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options?.model || 'llama-3.3-70b-versatile',
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        stream: true
      })
    });
    console.log('[StreamingChat] Groq: Response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[StreamingChat] Groq error response:', errorText);
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }
    if (!response.body) {
      throw new Error('No response body');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines[lines.length - 1];
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              console.log('[StreamingChat] Groq: Stream complete');
              return;
            }
            try {
              const json = JSON.parse(data);
              const chunk = json.choices?.[0]?.delta?.content || '';
              if (chunk) {
                yield chunk;
              }
            } catch (e) {
              // Ignore JSON parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error('[StreamingChat] Groq fallback error:', error);
    yield* streamWithGoogleAI(messages, options);
  }
}

/**
 * Stream with Google AI
 */
async function* streamWithGoogleAI(
  messages: Array<{ role: string; content: string }>,
  options?: StreamingOptions
): AsyncGenerator<string> {
  try {
    console.log('[StreamingChat] Google AI: Sending request WITHOUT tools');
    
    const response = await invokeLLM({
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant' | 'tool',
        content: m.content
      }))
    });

    // Yield the response in chunks to simulate streaming
    const rawContent = response.choices?.[0]?.message?.content || '';
    const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
    const chunkSize = 50;
    for (let i = 0; i < content.length; i += chunkSize) {
      yield content.substring(i, i + chunkSize);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  } catch (error) {
    console.error('[StreamingChat] Google AI error:', error);
    throw error;
  }
}


/**
 * Détecte si le message est une demande de navigation web
 */
interface BrowseRequest {
  shouldBrowse: boolean;
  url?: string;
  action: 'visit' | 'extract' | 'screenshot' | 'search';
  query?: string;
}

function detectBrowseRequest(message: string): BrowseRequest {
  const lowerMessage = message.toLowerCase();
  
  // IMPORTANT: Ne PAS détecter comme navigation si c'est une demande de création
  const creationKeywords = /(?:cr[ée]e|cr[ée]er|fais|faire|g[ée]n[èe]re|g[ée]n[ée]rer|construis|construire|d[ée]veloppe|d[ée]velopper)\s+(?:moi\s+)?(?:un[e]?\s+)?(?:site|page)/i;
  if (creationKeywords.test(message)) {
    return { shouldBrowse: false, action: 'visit' };
  }
  
  // IMPORTANT: Ne PAS détecter comme navigation pour les demandes météo, crypto, questions simples
  const excludePatterns = [
    // Météo
    /(?:quel|quelle)\s+(?:temps|météo)/i,
    /(?:temps|météo|weather)\s+(?:à|a|en|dans|pour|at|in)/i,
    /fait[\s-]*il\s+(?:à|a|en|dans)/i,
    // Crypto
    /(?:prix|cours|valeur)\s+(?:du|de|des)?\s*(?:bitcoin|btc|ethereum|eth|crypto)/i,
    // Questions simples
    /^(?:combien|how much|how many)[\s-]*(?:font|fait|is|are|coûte)/i,
    /^(?:quel|quelle|quels|quelles)\s+(?:est|sont|heure)/i,
    /^(?:qui|what|who|where|when|why|how)\s+(?:est|is|are|was|were)/i,
    // Demandes conversationnelles
    /(?:raconte|dis|explique|décris|résume|traduis|écris|rédige)/i,
  ];
  
  if (excludePatterns.some(p => p.test(message))) {
    return { shouldBrowse: false, action: 'visit' };
  }
  
  // Patterns pour détecter une demande de navigation (SANS les mots de création)
  const browsePatterns = [
    /va\s+sur|vas\s+sur|aller\s+sur|visite|visiter|ouvre|ouvrir|navigue|naviguer/i,
    /go\s+to|visit|open|navigate\s+to|browse/i,
    /montre[\s-]moi|show\s+me|affiche/i,
    /regarde|regarder|voir|check|vérifier|vérifie/i,
    /sur\s+internet|on\s+the\s+web/i,
    /(?:accède|accéder|acceder)\s+(?:à|a)\s+(?:https?:\/\/|www\.)/i
  ];
  
  // Patterns pour extraire une URL
  const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+|\b[a-z0-9-]+\.(com|fr|org|net|io|ai|dev|co|app)\b/i;
  
  // Patterns pour détecter une demande de screenshot
  const screenshotPatterns = [
    /capture|screenshot|écran|screen|image\s+de/i
  ];
  
  // Vérifier si c'est une demande de navigation
  const isBrowseRequest = browsePatterns.some(p => p.test(message));
  const urlMatch = message.match(urlPattern);
  const isScreenshotRequest = screenshotPatterns.some(p => p.test(message));
  
  // Si on détecte une URL ou une demande de navigation explicite
  if (isBrowseRequest || urlMatch) {
    let url = urlMatch ? urlMatch[0] : undefined;
    
    // Normaliser l'URL
    if (url && !url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    return {
      shouldBrowse: true,
      url,
      action: isScreenshotRequest ? 'screenshot' : (url ? 'visit' : 'search'),
      query: !url ? message : undefined
    };
  }
  
  return {
    shouldBrowse: false,
    action: 'visit'
  };
}

/**
 * Exécute une demande de navigation web avec Browserless
 */
async function executeBrowseRequest(request: BrowseRequest, originalMessage: string): Promise<string> {
  console.log('[StreamingChat] Executing browse request:', request);
  
  // Si pas d'URL spécifique, proposer des sites populaires ou demander une URL
  if (!request.url) {
    // Détecter le type de site demandé
    const lowerMessage = originalMessage.toLowerCase();
    
    // Détecter les catégories de sites
    if (/news|actualit|info|journal/i.test(lowerMessage)) {
      request.url = 'https://www.bbc.com';
      console.log('[StreamingChat] Auto-selecting news site: bbc.com');
    } else if (/météo|weather|temps/i.test(lowerMessage)) {
      request.url = 'https://www.meteofrance.com';
      console.log('[StreamingChat] Auto-selecting weather site: meteofrance.com');
    } else if (/sport/i.test(lowerMessage)) {
      request.url = 'https://www.lequipe.fr';
      console.log('[StreamingChat] Auto-selecting sports site: lequipe.fr');
    } else if (/tech|technologie|informatique/i.test(lowerMessage)) {
      request.url = 'https://www.theverge.com';
      console.log('[StreamingChat] Auto-selecting tech site: theverge.com');
    } else if (/recherche|search|google/i.test(lowerMessage)) {
      request.url = 'https://www.google.com';
      console.log('[StreamingChat] Auto-selecting search site: google.com');
    } else {
      // Proposer des options
      return `## 🌐 Navigation Web

Je peux naviguer sur n'importe quel site web pour vous! Voici quelques suggestions:

**Actualités:**
- "Va sur bbc.com" - BBC News
- "Ouvre lemonde.fr" - Le Monde

**Technologie:**
- "Visite theverge.com" - The Verge
- "Ouvre github.com" - GitHub

**Recherche:**
- "Va sur google.com" - Google
- "Ouvre wikipedia.org" - Wikipedia

**Ou donnez-moi une URL spécifique:**
- "Va sur https://example.com"
- "Ouvre le site monsite.fr"

Quel site voulez-vous que j'ouvre?`;
    }
  }
  
  try {
    // Utiliser autonomousBrowser.executeBrowsingSession pour naviguer
    const result = await autonomousBrowser.executeBrowsingSession(
      request.url,
      `Extraire le contenu principal de la page pour répondre à: ${originalMessage}`,
      'default',
      request.action === 'screenshot'
    );
    
    if (!result.success) {
      return `❌ Erreur lors de la navigation vers ${request.url}: ${result.error || 'Erreur inconnue'}`;
    }
    
    // Formater la réponse
    let response = `## 🌐 Navigation vers ${request.url}\n\n`;
    response += `**Méthode utilisée:** ${result.method === 'browserless-chrome' ? 'Browserless.io (Chrome cloud réel)' : result.method}\n\n`;
    
    if (result.extraction?.title) {
      response += `**Titre:** ${result.extraction.title}\n\n`;
    }
    
    if (result.content) {
      // Limiter le contenu à 3000 caractères
      const content = result.content.length > 3000 
        ? result.content.substring(0, 3000) + '...\n\n*[Contenu tronqué]*'
        : result.content;
      response += `### Contenu extrait:\n\n${content}\n\n`;
    }
    
    if (result.extraction?.links && result.extraction.links.length > 0) {
      response += `### Liens trouvés (${result.extraction.links.length}):\n`;
      result.extraction.links.slice(0, 5).forEach((link: { text: string; href: string }) => {
        response += `- [${link.text || link.href}](${link.href})\n`;
      });
      if (result.extraction.links.length > 5) {
        response += `- ... et ${result.extraction.links.length - 5} autres liens\n`;
      }
      response += '\n';
    }
    
    if (result.screenshot) {
      response += `### Screenshot:\n![Screenshot](${result.screenshot})\n\n`;
    }
    
    response += `---\n*Navigation effectuée avec ${result.method === 'browserless-chrome' ? 'Browserless.io - Vrai Chrome dans le cloud' : result.method}*`;
    
    return response;
    
  } catch (error) {
    console.error('[StreamingChat] Browse execution error:', error);
    return `❌ Erreur lors de la navigation: ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
  }
}
