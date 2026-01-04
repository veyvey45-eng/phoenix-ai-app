/**
 * Real Sandbox Test
 * Teste que le sandbox fonctionne RÉELLEMENT, pas en simulation
 */

import { e2bSandbox } from './e2bSandbox';

async function testRealSandbox() {
  console.log('\n🧪 Testing Real Sandbox Execution\n');
  console.log('='.repeat(60));

  // Test 1: Simple Python calculation
  console.log('\n📝 TEST 1: Simple Python Calculation');
  console.log('-'.repeat(60));
  const pythonResult1 = await e2bSandbox.executePython(
    'print(10 + 20 + 30)',
    'test-user-1',
    'test-user'
  );
  console.log('Code: print(10 + 20 + 30)');
  console.log('Output:', pythonResult1.output);
  console.log('Success:', pythonResult1.success);
  console.log('Time:', pythonResult1.executionTime, 'ms');
  
  if (pythonResult1.output.includes('60')) {
    console.log('✅ TEST 1 PASSED');
  } else {
    console.log('❌ TEST 1 FAILED - Expected output to contain "60"');
  }

  // Test 2: Python list generation
  console.log('\n📝 TEST 2: Python List Generation');
  console.log('-'.repeat(60));
  const pythonResult2 = await e2bSandbox.executePython(
    `
primes = []
for n in range(2, 20):
    is_prime = True
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            is_prime = False
            break
    if is_prime:
        primes.append(n)
print(primes)
    `,
    'test-user-2',
    'test-user'
  );
  console.log('Code: Generate primes from 2 to 20');
  console.log('Output:', pythonResult2.output);
  console.log('Success:', pythonResult2.success);
  console.log('Time:', pythonResult2.executionTime, 'ms');
  
  if (pythonResult2.output.includes('2') && pythonResult2.output.includes('19')) {
    console.log('✅ TEST 2 PASSED');
  } else {
    console.log('❌ TEST 2 FAILED - Expected output to contain primes');
  }

  // Test 3: JavaScript calculation
  console.log('\n📝 TEST 3: JavaScript Calculation');
  console.log('-'.repeat(60));
  const jsResult1 = await e2bSandbox.executeJavaScript(
    'console.log(5 * 6 * 7)',
    'test-user-3',
    'test-user'
  );
  console.log('Code: console.log(5 * 6 * 7)');
  console.log('Output:', jsResult1.output);
  console.log('Success:', jsResult1.success);
  console.log('Time:', jsResult1.executionTime, 'ms');
  
  if (jsResult1.output.includes('210')) {
    console.log('✅ TEST 3 PASSED');
  } else {
    console.log('❌ TEST 3 FAILED - Expected output to contain "210"');
  }

  // Test 4: JavaScript loop
  console.log('\n📝 TEST 4: JavaScript Loop');
  console.log('-'.repeat(60));
  const jsResult2 = await e2bSandbox.executeJavaScript(
    `
for (let i = 1; i <= 5; i++) {
  console.log(i);
}
    `,
    'test-user-4',
    'test-user'
  );
  console.log('Code: Loop from 1 to 5');
  console.log('Output:', jsResult2.output);
  console.log('Success:', jsResult2.success);
  console.log('Time:', jsResult2.executionTime, 'ms');
  
  if (jsResult2.output.includes('1') && jsResult2.output.includes('5')) {
    console.log('✅ TEST 4 PASSED');
  } else {
    console.log('❌ TEST 4 FAILED - Expected output to contain 1-5');
  }

  // Test 5: Python with imports
  console.log('\n📝 TEST 5: Python with Imports');
  console.log('-'.repeat(60));
  const pythonResult3 = await e2bSandbox.executePython(
    `
import math
print(f"sqrt(16) = {math.sqrt(16)}")
print(f"pi = {math.pi:.2f}")
    `,
    'test-user-5',
    'test-user'
  );
  console.log('Code: Calculate sqrt(16) and pi');
  console.log('Output:', pythonResult3.output);
  console.log('Success:', pythonResult3.success);
  console.log('Time:', pythonResult3.executionTime, 'ms');
  
  if (pythonResult3.output.includes('4') && pythonResult3.output.includes('3.14')) {
    console.log('✅ TEST 5 PASSED');
  } else {
    console.log('❌ TEST 5 FAILED - Expected output to contain sqrt and pi');
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 All tests completed!\n');
}

// Run tests
testRealSandbox().catch(console.error);
