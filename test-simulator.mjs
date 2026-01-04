const code = `import math
print(math.factorial(5))`;

// Remove newlines and extra spaces for easier parsing
const cleanCode = code.replace(/\n\s*/g, ' ').trim();
console.log('Clean code:', cleanCode);

// Extract print statements
const printRegex = /print\s*\(([^)]+)\)/g;
const outputs = [];
let match;

while ((match = printRegex.exec(cleanCode)) !== null) {
  const content = match[1].trim();
  console.log('Found print with content:', content);
  
  if (content.includes('math.factorial')) {
    const numMatch = content.match(/math\.factorial\s*\(\s*(\d+)\s*\)/);
    console.log('Factorial match:', numMatch);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      let result = 1;
      for (let i = 2; i <= num; i++) {
        result *= i;
      }
      outputs.push(result.toString());
    }
  }
}

console.log('Outputs:', outputs);
console.log('Final result:', outputs.length > 0 ? outputs.join('\n') : '[No output]');
