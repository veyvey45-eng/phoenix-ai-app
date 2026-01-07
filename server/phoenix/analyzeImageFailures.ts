import { detectIntent } from './intentDetector';

const IMAGE_TESTS = [
  "Génère une image", "Crée une image",
  "Fais-moi une image", "Dessine-moi quelque chose",
  "Image de chat", "Photo de paysage",
  "Generate an image", "Create an image",
  "Make me an image", "Draw something",
  "Image of a cat", "Photo of landscape",
  "Image style impressionniste", "Vintage style photo",
  "Image d'un dragon", "Dragon illustration",
];

console.log("\n=== IMAGE FAILURES ===");
let fails = 0;
for (const q of IMAGE_TESTS) {
  const r = detectIntent(q);
  if (r.type !== 'image_generation') {
    console.log(`FAIL: "${q}" -> ${r.type}`);
    fails++;
  }
}
console.log(`\nImage: ${IMAGE_TESTS.length - fails}/${IMAGE_TESTS.length} passed`);
