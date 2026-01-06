import { describe, it, expect } from 'vitest';

describe('Browserless.io Integration', () => {
  const apiToken = process.env.BROWSERLESS_API_KEY;

  it('should have BROWSERLESS_API_KEY configured', () => {
    expect(apiToken).toBeDefined();
    expect(apiToken).not.toBe('');
    console.log('API Token configured:', apiToken ? 'Yes' : 'No');
  });

  it('should successfully fetch content from example.com using Browserless', async () => {
    if (!apiToken) {
      console.log('Skipping test: No API token');
      return;
    }

    const response = await fetch(`https://production-sfo.browserless.io/content?token=${apiToken}`, {
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
    
    expect(response.ok).toBe(true);
    
    const html = await response.text();
    console.log('HTML length:', html.length);
    
    expect(html).toContain('Example Domain');
    expect(html.length).toBeGreaterThan(100);
  }, { timeout: 30000 });

  it('should successfully take a screenshot using Browserless', async () => {
    if (!apiToken) {
      console.log('Skipping test: No API token');
      return;
    }

    const response = await fetch(`https://production-sfo.browserless.io/screenshot?token=${apiToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        url: 'https://example.com/',
        options: {
          type: 'png'
        }
      })
    });

    console.log('Screenshot response status:', response.status);
    
    expect(response.ok).toBe(true);
    
    const buffer = await response.arrayBuffer();
    console.log('Screenshot size:', buffer.byteLength, 'bytes');
    
    // Un screenshot PNG valide fait au moins quelques KB
    expect(buffer.byteLength).toBeGreaterThan(1000);
  }, { timeout: 30000 });
});
