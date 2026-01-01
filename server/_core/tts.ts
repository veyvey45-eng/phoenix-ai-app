/**
 * Text-to-Speech (TTS) Module - Server-side synthesis
 * 
 * Ce module utilise l'API OpenAI-compatible pour générer de l'audio
 * à partir de texte, permettant la synthèse vocale sur tous les navigateurs.
 */

import { ENV } from "./env";

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
export type TTSFormat = "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";

export interface TTSOptions {
  /** Texte à synthétiser (max 4096 caractères) */
  text: string;
  /** Voix à utiliser (default: nova) */
  voice?: TTSVoice;
  /** Format audio de sortie (default: mp3) */
  format?: TTSFormat;
  /** Vitesse de parole (0.25 à 4.0, default: 1.0) */
  speed?: number;
}

export interface TTSResult {
  /** Audio en base64 */
  audioBase64: string;
  /** Type MIME de l'audio */
  mimeType: string;
  /** Durée estimée en secondes */
  estimatedDuration: number;
}

const MIME_TYPES: Record<TTSFormat, string> = {
  mp3: "audio/mpeg",
  opus: "audio/opus",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  pcm: "audio/pcm"
};

/**
 * Génère de l'audio à partir de texte via l'API TTS
 */
export async function synthesizeSpeech(options: TTSOptions): Promise<TTSResult> {
  const { text, voice = "nova", format = "mp3", speed = 1.0 } = options;

  // Validation
  if (!text || text.trim().length === 0) {
    throw new Error("Le texte ne peut pas être vide");
  }
  
  if (text.length > 4096) {
    throw new Error("Le texte ne peut pas dépasser 4096 caractères");
  }

  if (speed < 0.25 || speed > 4.0) {
    throw new Error("La vitesse doit être entre 0.25 et 4.0");
  }

  // Construire l'URL de l'API TTS
  const baseUrl = ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? ENV.forgeApiUrl.replace(/\/$/, "")
    : "https://forge.manus.im";
  
  const ttsUrl = `${baseUrl}/v1/audio/speech`;

  const response = await fetch(ttsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice,
      response_format: format,
      speed
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS synthesis failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  // Convertir la réponse en base64
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  // Estimer la durée (environ 150 mots par minute à vitesse 1.0)
  const wordCount = text.split(/\s+/).length;
  const estimatedDuration = (wordCount / 150) * 60 / speed;

  return {
    audioBase64: base64,
    mimeType: MIME_TYPES[format],
    estimatedDuration
  };
}

/**
 * Vérifie si le service TTS est disponible
 */
export async function checkTTSAvailability(): Promise<boolean> {
  try {
    // Faire une requête minimale pour vérifier la disponibilité
    const baseUrl = ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
      ? ENV.forgeApiUrl.replace(/\/$/, "")
      : "https://forge.manus.im";
    
    const response = await fetch(`${baseUrl}/v1/models`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${ENV.forgeApiKey}`
      }
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Divise un texte long en segments pour la synthèse
 * Respecte les limites de l'API (4096 caractères)
 */
export function splitTextForTTS(text: string, maxLength: number = 4000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const segments: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      segments.push(remaining);
      break;
    }

    // Trouver un point de coupure naturel (fin de phrase)
    let cutPoint = maxLength;
    const sentenceEnders = [". ", "! ", "? ", ".\n", "!\n", "?\n"];
    
    for (const ender of sentenceEnders) {
      const lastIndex = remaining.lastIndexOf(ender, maxLength);
      if (lastIndex > maxLength * 0.5) {
        cutPoint = lastIndex + ender.length;
        break;
      }
    }

    // Si pas de fin de phrase, couper au dernier espace
    if (cutPoint === maxLength) {
      const lastSpace = remaining.lastIndexOf(" ", maxLength);
      if (lastSpace > maxLength * 0.5) {
        cutPoint = lastSpace + 1;
      }
    }

    segments.push(remaining.substring(0, cutPoint).trim());
    remaining = remaining.substring(cutPoint).trim();
  }

  return segments;
}
