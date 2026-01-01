import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { splitTextForTTS } from "./tts";

// Mock fetch for TTS API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("TTS Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("splitTextForTTS", () => {
    it("should return single segment for short text", () => {
      const text = "Bonjour, je suis Phoenix.";
      const segments = splitTextForTTS(text);

      expect(segments).toHaveLength(1);
      expect(segments[0]).toBe(text);
    });

    it("should split long text at sentence boundaries", () => {
      const text = "Première phrase. Deuxième phrase. Troisième phrase.";
      const segments = splitTextForTTS(text, 30);

      expect(segments.length).toBeGreaterThan(1);
      // Each segment should end with a sentence
      segments.forEach(segment => {
        expect(segment.length).toBeLessThanOrEqual(30);
      });
    });

    it("should handle text without sentence boundaries", () => {
      const text = "Un très long texte sans ponctuation qui continue encore et encore";
      const segments = splitTextForTTS(text, 30);

      expect(segments.length).toBeGreaterThan(1);
      // Should split at word boundaries
      segments.forEach(segment => {
        expect(segment.length).toBeLessThanOrEqual(30);
      });
    });

    it("should preserve complete sentences when possible", () => {
      const text = "Phrase courte. Une autre phrase un peu plus longue. Fin.";
      const segments = splitTextForTTS(text, 60);

      // Should try to keep sentences together
      expect(segments.some(s => s.includes("Phrase courte"))).toBe(true);
    });

    it("should handle empty text", () => {
      const segments = splitTextForTTS("");
      expect(segments).toHaveLength(1);
      expect(segments[0]).toBe("");
    });

    it("should handle text with newlines", () => {
      const text = "Première ligne.\nDeuxième ligne.\nTroisième ligne.";
      const segments = splitTextForTTS(text, 30);

      expect(segments.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle text with exclamation and question marks", () => {
      const text = "Bonjour! Comment allez-vous? Très bien merci.";
      const segments = splitTextForTTS(text, 25);

      expect(segments.length).toBeGreaterThan(1);
      // Should split at punctuation
    });

    it("should respect maxLength parameter", () => {
      const text = "A".repeat(5000);
      const maxLength = 1000;
      const segments = splitTextForTTS(text, maxLength);

      segments.forEach(segment => {
        expect(segment.length).toBeLessThanOrEqual(maxLength);
      });
    });

    it("should handle Unicode text correctly", () => {
      const text = "Bonjour à tous! Les accents français: é, è, ê, ë. Et les symboles: €, £.";
      const segments = splitTextForTTS(text);

      expect(segments).toHaveLength(1);
      expect(segments[0]).toBe(text);
    });
  });
});

describe("TTS API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should validate text length", async () => {
    // Import dynamically to allow mocking
    const { synthesizeSpeech } = await import("./tts");
    
    // Test with empty text
    await expect(synthesizeSpeech({ text: "" })).rejects.toThrow("Le texte ne peut pas être vide");
    
    // Test with whitespace only
    await expect(synthesizeSpeech({ text: "   " })).rejects.toThrow("Le texte ne peut pas être vide");
  });

  it("should validate text max length", async () => {
    const { synthesizeSpeech } = await import("./tts");
    
    const longText = "A".repeat(5000);
    await expect(synthesizeSpeech({ text: longText })).rejects.toThrow("ne peut pas dépasser 4096 caractères");
  });

  it("should validate speed parameter", async () => {
    const { synthesizeSpeech } = await import("./tts");
    
    // Too slow
    await expect(synthesizeSpeech({ text: "Test", speed: 0.1 })).rejects.toThrow("La vitesse doit être entre 0.25 et 4.0");
    
    // Too fast
    await expect(synthesizeSpeech({ text: "Test", speed: 5.0 })).rejects.toThrow("La vitesse doit être entre 0.25 et 4.0");
  });

  it("should use default parameters when not specified", async () => {
    const { synthesizeSpeech } = await import("./tts");
    
    // Mock successful API response
    const mockAudioBuffer = new ArrayBuffer(100);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockAudioBuffer)
    });

    const result = await synthesizeSpeech({ text: "Test" });

    // Verify fetch was called with correct defaults
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    
    expect(body.voice).toBe("nova");
    expect(body.response_format).toBe("mp3");
    expect(body.speed).toBe(1.0);
  });

  it("should handle API errors gracefully", async () => {
    const { synthesizeSpeech } = await import("./tts");
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("Server error")
    });

    await expect(synthesizeSpeech({ text: "Test" })).rejects.toThrow("TTS synthesis failed");
  });

  it("should return correct MIME type for different formats", async () => {
    const { synthesizeSpeech } = await import("./tts");
    
    const mockAudioBuffer = new ArrayBuffer(100);
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockAudioBuffer)
    });

    // Test MP3
    const mp3Result = await synthesizeSpeech({ text: "Test", format: "mp3" });
    expect(mp3Result.mimeType).toBe("audio/mpeg");

    // Test WAV
    const wavResult = await synthesizeSpeech({ text: "Test", format: "wav" });
    expect(wavResult.mimeType).toBe("audio/wav");

    // Test OPUS
    const opusResult = await synthesizeSpeech({ text: "Test", format: "opus" });
    expect(opusResult.mimeType).toBe("audio/opus");
  });

  it("should estimate duration based on word count", async () => {
    const { synthesizeSpeech } = await import("./tts");
    
    const mockAudioBuffer = new ArrayBuffer(100);
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockAudioBuffer)
    });

    // Test with known word count
    const text = "Un deux trois quatre cinq six sept huit neuf dix"; // 10 words
    const result = await synthesizeSpeech({ text, speed: 1.0 });

    // At 150 words per minute, 10 words = 4 seconds
    expect(result.estimatedDuration).toBeCloseTo(4, 0);
  });

  it("should adjust duration estimate based on speed", async () => {
    const { synthesizeSpeech } = await import("./tts");
    
    const mockAudioBuffer = new ArrayBuffer(100);
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockAudioBuffer)
    });

    const text = "Un deux trois quatre cinq six sept huit neuf dix"; // 10 words

    // At speed 2.0, duration should be half
    const fastResult = await synthesizeSpeech({ text, speed: 2.0 });
    const normalResult = await synthesizeSpeech({ text, speed: 1.0 });

    expect(fastResult.estimatedDuration).toBeLessThan(normalResult.estimatedDuration);
  });
});
