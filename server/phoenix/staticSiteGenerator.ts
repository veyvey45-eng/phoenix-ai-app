/**
 * Static Site Generator - Création de sites statiques SANS E2B
 * 
 * Ce module permet de créer des sites web directement dans la base de données
 * sans passer par E2B. C'est plus rapide, plus fiable, et sans limite!
 * 
 * Utilisé comme fallback quand E2B est indisponible ou pour les sites simples.
 */

import { createHostedSite, getSiteBySlug } from '../hostedSites';

// Types
export interface StaticSiteFile {
  path: string;
  content: string;
  mimeType?: string;
}

export interface StaticSiteConfig {
  name: string;
  description?: string;
  files: StaticSiteFile[];
  siteType?: 'landing' | 'portfolio' | 'business' | 'ecommerce' | 'blog' | 'custom';
  isPublic?: boolean;
}

export interface StaticSiteResult {
  success: boolean;
  slug?: string;
  permanentUrl?: string;
  htmlContent?: string;
  cssContent?: string;
  jsContent?: string;
  error?: string;
}

/**
 * Service de génération de sites statiques
 */
class StaticSiteGeneratorService {
  
  /**
   * Combine les fichiers CSS en un seul contenu
   */
  private combineCSS(files: StaticSiteFile[]): string {
    const cssFiles = files.filter(f => 
      f.path.endsWith('.css') || f.mimeType === 'text/css'
    );
    
    if (cssFiles.length === 0) return '';
    
    return cssFiles.map(f => `/* ${f.path} */\n${f.content}`).join('\n\n');
  }

  /**
   * Combine les fichiers JS en un seul contenu
   */
  private combineJS(files: StaticSiteFile[]): string {
    const jsFiles = files.filter(f => 
      f.path.endsWith('.js') || f.mimeType === 'application/javascript'
    );
    
    if (jsFiles.length === 0) return '';
    
    return jsFiles.map(f => `// ${f.path}\n${f.content}`).join('\n\n');
  }

  /**
   * Trouve le fichier HTML principal
   */
  private findMainHTML(files: StaticSiteFile[]): StaticSiteFile | null {
    // Priorité: index.html > *.html
    const indexHtml = files.find(f => f.path === 'index.html' || f.path.endsWith('/index.html'));
    if (indexHtml) return indexHtml;
    
    const anyHtml = files.find(f => f.path.endsWith('.html'));
    return anyHtml || null;
  }

  /**
   * Injecte le CSS et JS inline dans le HTML
   */
  private injectAssetsIntoHTML(html: string, css: string, js: string): string {
    let result = html;
    
    // Injecter le CSS avant </head> ou au début du body
    if (css) {
      const styleTag = `<style>\n${css}\n</style>`;
      if (result.includes('</head>')) {
        result = result.replace('</head>', `${styleTag}\n</head>`);
      } else if (result.includes('<body>')) {
        result = result.replace('<body>', `<head>${styleTag}</head>\n<body>`);
      } else {
        result = `${styleTag}\n${result}`;
      }
    }
    
    // Injecter le JS avant </body> ou à la fin
    if (js) {
      const scriptTag = `<script>\n${js}\n</script>`;
      if (result.includes('</body>')) {
        result = result.replace('</body>', `${scriptTag}\n</body>`);
      } else {
        result = `${result}\n${scriptTag}`;
      }
    }
    
    return result;
  }

  /**
   * Crée un site statique directement dans la base de données
   */
  async createStaticSite(
    userId: number,
    config: StaticSiteConfig
  ): Promise<StaticSiteResult> {
    try {
      // Trouver le fichier HTML principal
      const mainHtml = this.findMainHTML(config.files);
      if (!mainHtml) {
        return {
          success: false,
          error: 'Aucun fichier HTML trouvé dans le projet'
        };
      }

      // Combiner CSS et JS
      const combinedCSS = this.combineCSS(config.files);
      const combinedJS = this.combineJS(config.files);

      // Créer le HTML final avec assets inline
      const finalHTML = this.injectAssetsIntoHTML(mainHtml.content, combinedCSS, combinedJS);

      // Sauvegarder dans la base de données
      const site = await createHostedSite({
        userId,
        name: config.name,
        description: config.description || `Site généré par Phoenix AI`,
        siteType: config.siteType || 'custom',
        htmlContent: finalHTML,
        cssContent: combinedCSS || undefined,
        jsContent: combinedJS || undefined,
        isPublic: config.isPublic ?? true
      });

      if (!site) {
        return {
          success: false,
          error: 'Erreur lors de la sauvegarde dans la base de données'
        };
      }

      const permanentUrl = `/sites/${site.slug}`;

      console.log(`[StaticSiteGenerator] Site créé: ${config.name} -> ${permanentUrl}`);

      return {
        success: true,
        slug: site.slug,
        permanentUrl,
        htmlContent: finalHTML,
        cssContent: combinedCSS,
        jsContent: combinedJS
      };
    } catch (error: any) {
      console.error('[StaticSiteGenerator] Erreur:', error);
      return {
        success: false,
        error: error.message || 'Erreur inconnue'
      };
    }
  }

  /**
   * Crée un site à partir d'un HTML complet (avec CSS/JS inline)
   */
  async createFromHTML(
    userId: number,
    name: string,
    htmlContent: string,
    options?: {
      description?: string;
      siteType?: StaticSiteConfig['siteType'];
      isPublic?: boolean;
    }
  ): Promise<StaticSiteResult> {
    try {
      const site = await createHostedSite({
        userId,
        name,
        description: options?.description || `Site généré par Phoenix AI`,
        siteType: options?.siteType || 'custom',
        htmlContent,
        isPublic: options?.isPublic ?? true
      });

      if (!site) {
        return {
          success: false,
          error: 'Erreur lors de la sauvegarde dans la base de données'
        };
      }

      return {
        success: true,
        slug: site.slug,
        permanentUrl: `/sites/${site.slug}`,
        htmlContent
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erreur inconnue'
      };
    }
  }

  /**
   * Génère un HTML de base pour un site d'hôtel
   */
  generateHotelTemplate(hotelInfo: {
    name: string;
    address: string;
    city?: string;
    description?: string;
    features?: string[];
    phone?: string;
    email?: string;
  }): string {
    const features = hotelInfo.features || [
      'WiFi gratuit',
      'Petit-déjeuner inclus',
      'Parking privé',
      'Réception 24h/24',
      'Chambres climatisées'
    ];

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${hotelInfo.name} - Hôtel de Luxe</title>
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
    
    /* Hero Section */
    .hero {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: white;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 2rem;
      position: relative;
      overflow: hidden;
    }
    
    .hero::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/></svg>') repeat;
      opacity: 0.5;
    }
    
    .hero-content {
      position: relative;
      z-index: 1;
      max-width: 800px;
    }
    
    .hero h1 {
      font-size: 3.5rem;
      margin-bottom: 1rem;
      font-weight: 300;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    
    .hero .tagline {
      font-size: 1.3rem;
      opacity: 0.9;
      margin-bottom: 2rem;
      font-style: italic;
    }
    
    .hero .address {
      font-size: 1.1rem;
      opacity: 0.8;
      margin-bottom: 3rem;
    }
    
    .cta-button {
      background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
      color: white;
      padding: 1rem 3rem;
      border: none;
      border-radius: 50px;
      font-size: 1.1rem;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      transition: transform 0.3s, box-shadow 0.3s;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    
    .cta-button:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 30px rgba(233, 69, 96, 0.4);
    }
    
    /* Features Section */
    .features {
      padding: 5rem 2rem;
      background: #f8f9fa;
    }
    
    .features h2 {
      text-align: center;
      font-size: 2.5rem;
      margin-bottom: 3rem;
      color: #1a1a2e;
    }
    
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .feature-card {
      background: white;
      padding: 2rem;
      border-radius: 15px;
      text-align: center;
      box-shadow: 0 5px 20px rgba(0,0,0,0.1);
      transition: transform 0.3s;
    }
    
    .feature-card:hover {
      transform: translateY(-10px);
    }
    
    .feature-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    
    .feature-card h3 {
      color: #1a1a2e;
      margin-bottom: 0.5rem;
    }
    
    /* Contact Section */
    .contact {
      padding: 5rem 2rem;
      background: #1a1a2e;
      color: white;
      text-align: center;
    }
    
    .contact h2 {
      font-size: 2.5rem;
      margin-bottom: 2rem;
    }
    
    .contact-info {
      font-size: 1.2rem;
      margin-bottom: 1rem;
    }
    
    .contact-info a {
      color: #e94560;
      text-decoration: none;
    }
    
    /* Footer */
    footer {
      background: #0f0f1a;
      color: rgba(255,255,255,0.6);
      text-align: center;
      padding: 2rem;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .hero h1 {
        font-size: 2rem;
      }
      
      .hero .tagline {
        font-size: 1rem;
      }
    }
  </style>
</head>
<body>
  <section class="hero">
    <div class="hero-content">
      <h1>${hotelInfo.name}</h1>
      <p class="tagline">${hotelInfo.description || 'Une expérience unique au cœur de la ville'}</p>
      <p class="address">📍 ${hotelInfo.address}${hotelInfo.city ? `, ${hotelInfo.city}` : ''}</p>
      <a href="#contact" class="cta-button">Réserver maintenant</a>
    </div>
  </section>
  
  <section class="features">
    <h2>Nos Services</h2>
    <div class="features-grid">
      ${features.map((feature, i) => `
      <div class="feature-card">
        <div class="feature-icon">${['🌐', '🍳', '🚗', '🛎️', '❄️', '🏊', '🍷', '🎯'][i % 8]}</div>
        <h3>${feature}</h3>
      </div>`).join('')}
    </div>
  </section>
  
  <section class="contact" id="contact">
    <h2>Contactez-nous</h2>
    <p class="contact-info">📍 ${hotelInfo.address}</p>
    ${hotelInfo.phone ? `<p class="contact-info">📞 <a href="tel:${hotelInfo.phone}">${hotelInfo.phone}</a></p>` : ''}
    ${hotelInfo.email ? `<p class="contact-info">✉️ <a href="mailto:${hotelInfo.email}">${hotelInfo.email}</a></p>` : ''}
  </section>
  
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${hotelInfo.name}. Tous droits réservés.</p>
    <p>Site généré par Phoenix AI</p>
  </footer>
</body>
</html>`;
  }

  /**
   * Génère un template de landing page générique
   */
  generateLandingTemplate(info: {
    title: string;
    subtitle?: string;
    description?: string;
    ctaText?: string;
    features?: Array<{ icon: string; title: string; description: string }>;
  }): string {
    const features = info.features || [
      { icon: '🚀', title: 'Rapide', description: 'Performance optimale' },
      { icon: '🔒', title: 'Sécurisé', description: 'Protection maximale' },
      { icon: '💡', title: 'Innovant', description: 'Technologies modernes' }
    ];

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${info.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; }
    .hero {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
    }
    .hero h1 { font-size: 3rem; margin-bottom: 1rem; }
    .hero p { font-size: 1.2rem; opacity: 0.9; margin-bottom: 2rem; }
    .btn {
      background: white;
      color: #667eea;
      padding: 1rem 2rem;
      border-radius: 30px;
      text-decoration: none;
      font-weight: bold;
      transition: transform 0.3s;
    }
    .btn:hover { transform: scale(1.05); }
    .features {
      padding: 4rem 2rem;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      max-width: 1000px;
      margin: 0 auto;
    }
    .feature {
      text-align: center;
      padding: 2rem;
    }
    .feature .icon { font-size: 3rem; margin-bottom: 1rem; }
    .feature h3 { margin-bottom: 0.5rem; }
    footer {
      background: #333;
      color: white;
      text-align: center;
      padding: 2rem;
    }
  </style>
</head>
<body>
  <section class="hero">
    <div>
      <h1>${info.title}</h1>
      <p>${info.subtitle || info.description || 'Bienvenue sur notre site'}</p>
      <a href="#features" class="btn">${info.ctaText || 'Découvrir'}</a>
    </div>
  </section>
  <section class="features" id="features">
    ${features.map(f => `
    <div class="feature">
      <div class="icon">${f.icon}</div>
      <h3>${f.title}</h3>
      <p>${f.description}</p>
    </div>`).join('')}
  </section>
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${info.title}. Généré par Phoenix AI.</p>
  </footer>
</body>
</html>`;
  }
}

// Singleton
export const staticSiteGenerator = new StaticSiteGeneratorService();
export default staticSiteGenerator;
