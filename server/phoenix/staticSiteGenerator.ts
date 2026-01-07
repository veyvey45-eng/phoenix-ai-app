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

/**
 * Templates de sites spécialisés
 */
export const siteTemplates = {
  /**
   * Template Restaurant - Menu, réservations, horaires
   */
  restaurant: (info: {
    name: string;
    cuisine?: string;
    address?: string;
    phone?: string;
    hours?: string;
    description?: string;
    menuItems?: Array<{ name: string; price: string; description?: string }>;
  }) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${info.name} - Restaurant ${info.cuisine || 'Gastronomique'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', serif; line-height: 1.8; color: #2c2c2c; background: #faf8f5; }
    .hero {
      background: linear-gradient(135deg, #2c1810 0%, #4a2c1a 100%);
      color: #f5e6d3;
      min-height: 80vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 2rem;
    }
    .hero h1 { font-size: 4rem; font-weight: 300; letter-spacing: 8px; text-transform: uppercase; margin-bottom: 1rem; }
    .hero .cuisine { font-size: 1.5rem; font-style: italic; opacity: 0.9; margin-bottom: 2rem; }
    .btn {
      display: inline-block;
      padding: 1rem 3rem;
      background: #c9a959;
      color: #2c1810;
      text-decoration: none;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: bold;
      transition: all 0.3s;
    }
    .btn:hover { background: #f5e6d3; }
    .section { padding: 5rem 2rem; max-width: 1000px; margin: 0 auto; }
    .section-title { text-align: center; font-size: 2.5rem; margin-bottom: 3rem; color: #4a2c1a; }
    .menu-grid { display: grid; gap: 2rem; }
    .menu-item {
      display: flex;
      justify-content: space-between;
      padding: 1.5rem;
      background: white;
      border-left: 4px solid #c9a959;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    .menu-item h3 { color: #4a2c1a; margin-bottom: 0.5rem; }
    .menu-item .price { font-size: 1.5rem; color: #c9a959; font-weight: bold; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; text-align: center; }
    .info-item { padding: 2rem; background: white; }
    .info-item h3 { color: #c9a959; margin-bottom: 1rem; }
    footer { background: #2c1810; color: #f5e6d3; text-align: center; padding: 3rem; }
  </style>
</head>
<body>
  <section class="hero">
    <h1>${info.name}</h1>
    <p class="cuisine">${info.cuisine || 'Cuisine Gastronomique'}</p>
    <a href="#menu" class="btn">Voir le Menu</a>
  </section>
  
  <section class="section" id="menu">
    <h2 class="section-title">Notre Menu</h2>
    <div class="menu-grid">
      ${(info.menuItems || [
        { name: 'Entree du Chef', price: '15EUR', description: 'Creation saisonniere' },
        { name: 'Plat Signature', price: '35EUR', description: 'Notre specialite maison' },
        { name: 'Dessert Gourmand', price: '12EUR', description: 'Douceur artisanale' }
      ]).map(item => `
      <div class="menu-item">
        <div>
          <h3>${item.name}</h3>
          <p>${item.description || ''}</p>
        </div>
        <span class="price">${item.price}</span>
      </div>`).join('')}
    </div>
  </section>
  
  <section class="section">
    <h2 class="section-title">Informations</h2>
    <div class="info-grid">
      <div class="info-item">
        <h3>Adresse</h3>
        <p>${info.address || '123 Rue de la Gastronomie, Paris'}</p>
      </div>
      <div class="info-item">
        <h3>Reservation</h3>
        <p>${info.phone || '01 23 45 67 89'}</p>
      </div>
      <div class="info-item">
        <h3>Horaires</h3>
        <p>${info.hours || 'Mar-Sam: 12h-14h, 19h-22h'}</p>
      </div>
    </div>
  </section>
  
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${info.name}. Cree avec Phoenix AI.</p>
  </footer>
</body>
</html>`,

  /**
   * Template Portfolio - Galerie, projets, CV
   */
  portfolio: (info: {
    name: string;
    title?: string;
    bio?: string;
    skills?: string[];
    projects?: Array<{ name: string; description: string; image?: string }>;
    email?: string;
    social?: { github?: string; linkedin?: string; twitter?: string };
  }) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${info.name} - Portfolio</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; background: #0a0a0a; }
    .hero {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 4rem;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
      color: white;
    }
    .hero h1 { font-size: 5rem; font-weight: 800; margin-bottom: 1rem; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero .title { font-size: 1.8rem; color: #888; margin-bottom: 2rem; }
    .hero .bio { max-width: 600px; font-size: 1.2rem; color: #aaa; }
    .skills { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 2rem; }
    .skill { padding: 0.5rem 1.5rem; background: rgba(102, 126, 234, 0.2); border: 1px solid #667eea; border-radius: 30px; color: #667eea; }
    .section { padding: 6rem 4rem; }
    .section-title { font-size: 3rem; font-weight: 800; margin-bottom: 3rem; color: white; }
    .projects-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 2rem; }
    .project {
      background: #1a1a1a;
      border-radius: 20px;
      overflow: hidden;
      transition: transform 0.3s, box-shadow 0.3s;
    }
    .project:hover { transform: translateY(-10px); box-shadow: 0 20px 40px rgba(102, 126, 234, 0.2); }
    .project-image { height: 200px; background: linear-gradient(135deg, #667eea, #764ba2); }
    .project-content { padding: 2rem; }
    .project h3 { color: white; font-size: 1.5rem; margin-bottom: 1rem; }
    .project p { color: #888; }
    .contact { text-align: center; background: #1a1a1a; }
    .contact-links { display: flex; justify-content: center; gap: 2rem; margin-top: 2rem; }
    .contact-links a { color: #667eea; text-decoration: none; font-size: 1.2rem; transition: color 0.3s; }
    .contact-links a:hover { color: #764ba2; }
    footer { background: #0a0a0a; color: #666; text-align: center; padding: 2rem; }
  </style>
</head>
<body>
  <section class="hero">
    <h1>${info.name}</h1>
    <p class="title">${info.title || 'Developpeur Full-Stack & Designer'}</p>
    <p class="bio">${info.bio || 'Passionne par la creation d experiences numeriques uniques et innovantes.'}</p>
    <div class="skills">
      ${(info.skills || ['React', 'TypeScript', 'Node.js', 'UI/UX Design', 'Python']).map(s => `<span class="skill">${s}</span>`).join('')}
    </div>
  </section>
  
  <section class="section">
    <h2 class="section-title">Projets</h2>
    <div class="projects-grid">
      ${(info.projects || [
        { name: 'Projet Alpha', description: 'Application web moderne avec React et Node.js' },
        { name: 'Projet Beta', description: 'Design system complet pour une startup' },
        { name: 'Projet Gamma', description: 'API RESTful haute performance' }
      ]).map(p => `
      <div class="project">
        <div class="project-image"></div>
        <div class="project-content">
          <h3>${p.name}</h3>
          <p>${p.description}</p>
        </div>
      </div>`).join('')}
    </div>
  </section>
  
  <section class="section contact">
    <h2 class="section-title">Contact</h2>
    <p style="color: #888; font-size: 1.2rem;">Interesse par une collaboration ?</p>
    <div class="contact-links">
      <a href="mailto:${info.email || 'contact@example.com'}">Email</a>
      <a href="#">GitHub</a>
      <a href="#">LinkedIn</a>
    </div>
  </section>
  
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${info.name}. Portfolio cree avec Phoenix AI.</p>
  </footer>
</body>
</html>`,

  /**
   * Template E-commerce - Produits, panier, paiement
   */
  ecommerce: (info: {
    name: string;
    tagline?: string;
    products?: Array<{ name: string; price: string; image?: string; description?: string }>;
    categories?: string[];
  }) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${info.name} - Boutique en Ligne</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; line-height: 1.6; color: #333; background: #f8f9fa; }
    header {
      background: white;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .logo { font-size: 1.8rem; font-weight: 800; color: #2d3436; }
    nav { display: flex; gap: 2rem; }
    nav a { color: #636e72; text-decoration: none; font-weight: 500; transition: color 0.3s; }
    nav a:hover { color: #0984e3; }
    .cart-btn {
      background: #0984e3;
      color: white;
      padding: 0.8rem 1.5rem;
      border-radius: 30px;
      text-decoration: none;
      font-weight: 600;
      transition: background 0.3s;
    }
    .cart-btn:hover { background: #0770c2; }
    .hero {
      background: linear-gradient(135deg, #0984e3 0%, #6c5ce7 100%);
      color: white;
      padding: 6rem 2rem;
      text-align: center;
    }
    .hero h1 { font-size: 3.5rem; margin-bottom: 1rem; }
    .hero p { font-size: 1.3rem; opacity: 0.9; margin-bottom: 2rem; }
    .hero .btn {
      display: inline-block;
      background: white;
      color: #0984e3;
      padding: 1rem 3rem;
      border-radius: 30px;
      text-decoration: none;
      font-weight: 700;
      transition: transform 0.3s;
    }
    .hero .btn:hover { transform: scale(1.05); }
    .section { padding: 5rem 2rem; max-width: 1200px; margin: 0 auto; }
    .section-title { text-align: center; font-size: 2.5rem; margin-bottom: 3rem; color: #2d3436; }
    .products-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; }
    .product {
      background: white;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 5px 20px rgba(0,0,0,0.05);
      transition: transform 0.3s, box-shadow 0.3s;
    }
    .product:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
    .product-image { height: 250px; background: linear-gradient(135deg, #dfe6e9, #b2bec3); }
    .product-content { padding: 1.5rem; }
    .product h3 { font-size: 1.2rem; margin-bottom: 0.5rem; }
    .product .price { font-size: 1.5rem; font-weight: 800; color: #0984e3; margin-bottom: 1rem; }
    .product .add-btn {
      display: block;
      width: 100%;
      padding: 1rem;
      background: #0984e3;
      color: white;
      border: none;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.3s;
    }
    .product .add-btn:hover { background: #0770c2; }
    footer { background: #2d3436; color: white; text-align: center; padding: 3rem; }
  </style>
</head>
<body>
  <header>
    <div class="logo">${info.name}</div>
    <nav>
      <a href="#">Accueil</a>
      <a href="#products">Produits</a>
      <a href="#">A propos</a>
      <a href="#">Contact</a>
    </nav>
    <a href="#" class="cart-btn">Panier (0)</a>
  </header>
  
  <section class="hero">
    <h1>${info.name}</h1>
    <p>${info.tagline || 'Decouvrez notre collection exclusive'}</p>
    <a href="#products" class="btn">Voir les produits</a>
  </section>
  
  <section class="section" id="products">
    <h2 class="section-title">Nos Produits</h2>
    <div class="products-grid">
      ${(info.products || [
        { name: 'Produit Premium', price: '99EUR', description: 'Qualite exceptionnelle' },
        { name: 'Produit Classic', price: '49EUR', description: 'Le choix populaire' },
        { name: 'Produit Essentiel', price: '29EUR', description: 'Indispensable' },
        { name: 'Produit Luxe', price: '199EUR', description: 'Pour les connaisseurs' }
      ]).map(p => `
      <div class="product">
        <div class="product-image"></div>
        <div class="product-content">
          <h3>${p.name}</h3>
          <p style="color: #636e72; margin-bottom: 1rem;">${p.description || ''}</p>
          <div class="price">${p.price}</div>
          <button class="add-btn">Ajouter au panier</button>
        </div>
      </div>`).join('')}
    </div>
  </section>
  
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${info.name}. Boutique creee avec Phoenix AI.</p>
  </footer>
</body>
</html>`,

  /**
   * Template Blog - Articles, categories, commentaires
   */
  blog: (info: {
    name: string;
    tagline?: string;
    author?: string;
    posts?: Array<{ title: string; excerpt: string; date?: string; category?: string }>;
  }) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${info.name} - Blog</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', serif; line-height: 1.8; color: #333; background: #fafafa; }
    header {
      background: white;
      padding: 2rem;
      text-align: center;
      border-bottom: 1px solid #eee;
    }
    .logo { font-size: 2.5rem; font-weight: 700; color: #1a1a1a; margin-bottom: 0.5rem; }
    .tagline { color: #888; font-style: italic; }
    nav { margin-top: 1.5rem; }
    nav a { color: #666; text-decoration: none; margin: 0 1rem; transition: color 0.3s; }
    nav a:hover { color: #e74c3c; }
    .hero {
      background: linear-gradient(135deg, #1a1a1a 0%, #2c3e50 100%);
      color: white;
      padding: 5rem 2rem;
      text-align: center;
    }
    .hero h1 { font-size: 3rem; font-weight: 400; margin-bottom: 1rem; }
    .hero p { font-size: 1.3rem; opacity: 0.8; }
    .container { max-width: 800px; margin: 0 auto; padding: 4rem 2rem; }
    .posts { display: flex; flex-direction: column; gap: 3rem; }
    .post {
      background: white;
      padding: 2.5rem;
      border-radius: 10px;
      box-shadow: 0 2px 15px rgba(0,0,0,0.05);
      transition: box-shadow 0.3s;
    }
    .post:hover { box-shadow: 0 5px 25px rgba(0,0,0,0.1); }
    .post-meta { color: #888; font-size: 0.9rem; margin-bottom: 1rem; }
    .post-meta .category { background: #e74c3c; color: white; padding: 0.2rem 0.8rem; border-radius: 20px; font-size: 0.8rem; }
    .post h2 { font-size: 1.8rem; margin-bottom: 1rem; color: #1a1a1a; }
    .post h2 a { color: inherit; text-decoration: none; transition: color 0.3s; }
    .post h2 a:hover { color: #e74c3c; }
    .post p { color: #555; }
    .read-more { display: inline-block; margin-top: 1.5rem; color: #e74c3c; text-decoration: none; font-weight: 600; }
    .read-more:hover { text-decoration: underline; }
    footer { background: #1a1a1a; color: white; text-align: center; padding: 3rem; margin-top: 4rem; }
  </style>
</head>
<body>
  <header>
    <div class="logo">${info.name}</div>
    <p class="tagline">${info.tagline || 'Pensees, idees et decouvertes'}</p>
    <nav>
      <a href="#">Accueil</a>
      <a href="#">Articles</a>
      <a href="#">A propos</a>
      <a href="#">Contact</a>
    </nav>
  </header>
  
  <section class="hero">
    <h1>Bienvenue sur ${info.name}</h1>
    <p>Par ${info.author || 'Un passionne'}</p>
  </section>
  
  <div class="container">
    <div class="posts">
      ${(info.posts || [
        { title: 'Premier article', excerpt: 'Decouvrez les dernieres tendances et reflexions sur notre domaine.', date: 'Janvier 2026', category: 'Actualites' },
        { title: 'Reflexions sur le futur', excerpt: 'Une analyse approfondie des evolutions a venir et de leur impact.', date: 'Janvier 2026', category: 'Opinion' },
        { title: 'Guide pratique', excerpt: 'Tout ce que vous devez savoir pour maitriser ce sujet passionnant.', date: 'Decembre 2025', category: 'Tutoriel' }
      ]).map(p => `
      <article class="post">
        <div class="post-meta">
          <span class="category">${p.category || 'Article'}</span>
          <span> - ${p.date || 'Recent'}</span>
        </div>
        <h2><a href="#">${p.title}</a></h2>
        <p>${p.excerpt}</p>
        <a href="#" class="read-more">Lire la suite</a>
      </article>`).join('')}
    </div>
  </div>
  
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${info.name}. Blog cree avec Phoenix AI.</p>
  </footer>
</body>
</html>`
};
