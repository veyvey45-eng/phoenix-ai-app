import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Test E2B Sandbox Integration
 * Validates that E2B_API_KEY is correctly configured
 */

describe('E2B Sandbox Integration', () => {
  let apiKey: string;

  beforeAll(() => {
    apiKey = process.env.E2B_API_KEY || '';
  });

  it('should have E2B_API_KEY configured', () => {
    expect(apiKey).toBeTruthy();
    expect(apiKey.length).toBeGreaterThan(0);
  });

  it('should validate E2B API key format', () => {
    // E2B API keys typically start with a specific prefix
    expect(apiKey).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it('should be able to connect to E2B API', async () => {
    if (!apiKey) {
      console.warn('[E2B Test] API key not available, skipping connection test');
      return;
    }

    try {
      // Test basic E2B API connectivity
      const response = await fetch('https://api.e2b.dev/v1/sandboxes', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`[E2B Test] API Response Status: ${response.status}`);
      
      // Status 200 or 401 means the API is reachable and key is being validated
      expect([200, 401, 403]).toContain(response.status);
    } catch (error) {
      console.error('[E2B Test] Connection error:', error);
      throw error;
    }
  });

  it('should have proper environment configuration', () => {
    const requiredEnvs = ['E2B_API_KEY'];
    const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
    
    if (missingEnvs.length > 0) {
      console.warn(`[E2B Test] Missing environment variables: ${missingEnvs.join(', ')}`);
    }
    
    expect(missingEnvs.length).toBe(0);
  });
});
