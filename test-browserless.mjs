// Test Browserless.io API
const apiToken = process.env.BROWSERLESS_API_KEY;
console.log('API Token configured:', apiToken ? 'Yes (length: ' + apiToken.length + ')' : 'No');

if (!apiToken) {
  console.log('ERROR: No API token');
  process.exit(1);
}

async function test() {
  console.log('\nTest 1: Fetching content from example.com...');
  
  const response = await fetch('https://production-sfo.browserless.io/content?token=' + apiToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    },
    body: JSON.stringify({
      url: 'https://example.com/'
    })
  });

  console.log('Response status:', response.status);
  
  if (!response.ok) {
    const error = await response.text();
    console.log('Error:', error);
    process.exit(1);
  }
  
  const html = await response.text();
  console.log('HTML length:', html.length);
  console.log('Contains Example Domain:', html.includes('Example Domain'));
  
  console.log('\n✅ BROWSERLESS FONCTIONNE!');
}

test().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
