const message = "Calcule la factorielle de 5: ```python\nimport math\nprint(math.factorial(5))\n```";

// Test regex
const codeBlockMatch = message.match(/```(?:python|javascript|js)?\s*\n?([\s\S]*?)\n?```/);
console.log('Match:', codeBlockMatch);
if (codeBlockMatch) {
  console.log('Extracted:', codeBlockMatch[1]);
}
