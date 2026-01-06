/**
 * Image Generator Module for Phoenix AI
 */

import { generateImage } from '../_core/imageGeneration';

export type ImageStyle = 'realistic' | 'artistic' | 'cartoon' | 'anime' | 'watercolor' |
  'oil-painting' | 'digital-art' | 'sketch' | 'minimalist' | '3d-render' | 'photography' | 'cinematic';

export interface ImageGenerationRequest {
  prompt: string;
  style?: ImageStyle;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
}

export interface GeneratedImage {
  url: string;
  prompt: string;
  style: ImageStyle;
  generatedAt: Date;
}

export function detectImageRequest(message: string): {
  isImageRequest: boolean;
  action?: 'generate' | 'edit' | 'variation';
  style?: ImageStyle;
  prompt?: string;
} {
  const lowerMessage = message.toLowerCase();
  
  const generateTriggers = ['génère', 'crée', 'dessine', 'imagine', 'generate', 'create', 'draw', 'make an image', 'image de', 'photo de'];
  
  const isImageRequest = generateTriggers.some(t => lowerMessage.includes(t)) &&
    (lowerMessage.includes('image') || lowerMessage.includes('photo') || lowerMessage.includes('dessin') ||
     lowerMessage.includes('illustration') || lowerMessage.includes('picture'));
  
  if (!isImageRequest) {
    return { isImageRequest: false };
  }
  
  let style: ImageStyle = 'realistic';
  const styleMap: Record<string, ImageStyle> = {
    'réaliste': 'realistic', 'realistic': 'realistic', 'artistique': 'artistic', 'artistic': 'artistic',
    'cartoon': 'cartoon', 'anime': 'anime', 'manga': 'anime', 'aquarelle': 'watercolor', 'watercolor': 'watercolor',
    'peinture': 'oil-painting', 'oil': 'oil-painting', 'digital': 'digital-art', 'numérique': 'digital-art',
    'croquis': 'sketch', 'sketch': 'sketch', 'minimaliste': 'minimalist', 'minimalist': 'minimalist',
    '3d': '3d-render', 'photo': 'photography', 'cinematic': 'cinematic', 'cinématique': 'cinematic',
  };
  
  for (const [keyword, styleValue] of Object.entries(styleMap)) {
    if (lowerMessage.includes(keyword)) {
      style = styleValue;
      break;
    }
  }
  
  return { isImageRequest: true, action: 'generate', style, prompt: message };
}

export function getAvailableStyles(): { id: ImageStyle; name: string; description: string }[] {
  return [
    { id: 'realistic', name: 'Réaliste', description: 'Images photoréalistes' },
    { id: 'artistic', name: 'Artistique', description: 'Style artistique créatif' },
    { id: 'cartoon', name: 'Cartoon', description: 'Style dessin animé' },
    { id: 'anime', name: 'Anime', description: 'Style manga/anime japonais' },
    { id: 'watercolor', name: 'Aquarelle', description: 'Effet peinture aquarelle' },
    { id: 'oil-painting', name: 'Peinture à l\'huile', description: 'Style peinture classique' },
    { id: 'digital-art', name: 'Art numérique', description: 'Art digital moderne' },
    { id: 'sketch', name: 'Croquis', description: 'Style dessin au crayon' },
    { id: 'minimalist', name: 'Minimaliste', description: 'Design épuré et simple' },
    { id: '3d-render', name: 'Rendu 3D', description: 'Images 3D rendues' },
    { id: 'photography', name: 'Photographie', description: 'Style photo professionnelle' },
    { id: 'cinematic', name: 'Cinématique', description: 'Style film/cinéma' },
  ];
}

export async function generateImageFromPrompt(request: ImageGenerationRequest): Promise<GeneratedImage> {
  const { prompt, style = 'realistic' } = request;
  console.log(`[ImageGenerator] Generating image: ${prompt} (style: ${style})`);
  
  const stylePrompts: Record<ImageStyle, string> = {
    'realistic': 'photorealistic, highly detailed, 8k resolution',
    'artistic': 'artistic style, creative, expressive',
    'cartoon': 'cartoon style, vibrant colors, fun',
    'anime': 'anime style, manga art, Japanese animation',
    'watercolor': 'watercolor painting, soft colors, artistic',
    'oil-painting': 'oil painting style, classical art, textured',
    'digital-art': 'digital art, modern, clean lines',
    'sketch': 'pencil sketch, hand-drawn, artistic',
    'minimalist': 'minimalist design, simple, clean',
    '3d-render': '3D render, CGI, realistic lighting',
    'photography': 'professional photography, DSLR, high quality',
    'cinematic': 'cinematic, movie still, dramatic lighting',
  };
  
  const enhancedPrompt = `${prompt}, ${stylePrompts[style]}`;
  
  try {
    const result = await generateImage({ prompt: enhancedPrompt });
    return { url: result.url || '', prompt, style, generatedAt: new Date() };
  } catch (error) {
    console.error('[ImageGenerator] Error:', error);
    throw new Error('Erreur lors de la génération de l\'image');
  }
}
