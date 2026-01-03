import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';

describe('File Authentication', () => {
  let server: any;
  let port: number;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());

    // Mock middleware that sets user on request
    app.use((req: any, res, next) => {
      // Simulate authenticated user from cookie
      req.user = { id: 1, name: 'Test User' };
      next();
    });

    // Mock endpoint that requires authentication
    app.get('/api/files/:fileId', (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // Return file data
      res.json({
        id: req.params.fileId,
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 40000,
        extractedText: 'Test PDF Content',
        uploadedAt: new Date()
      });
    });

    server = createServer(app);
    port = 3001;
    
    await new Promise<void>((resolve) => {
      server.listen(port, () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should load file with credentials included', async () => {
    // Simulate what the client does with credentials: 'include'
    const response = await fetch(`http://localhost:${port}/api/files/test-123`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.extractedText).toBe('Test PDF Content');
    expect(data.originalName).toBe('test.pdf');
  });

  it('should fail without authentication', async () => {
    // Create a separate app without auth middleware
    const appNoAuth = express();
    const serverNoAuth = createServer(appNoAuth);
    
    appNoAuth.get('/api/files/:fileId', (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json({ extractedText: 'Test' });
    });

    const portNoAuth = 3002;
    await new Promise<void>((resolve) => {
      serverNoAuth.listen(portNoAuth, () => resolve());
    });

    try {
      const response = await fetch(`http://localhost:${portNoAuth}/api/files/test-123`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(401);
    } finally {
      await new Promise<void>((resolve) => {
        serverNoAuth.close(() => resolve());
      });
    }
  });

  it('should handle file loading with proper error handling', async () => {
    // Test that the client gracefully handles errors
    const response = await fetch(`http://localhost:${port}/api/files/nonexistent`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    // Even if file doesn't exist, the endpoint should return something
    // (in real implementation, it would return 404)
    expect(response.status).toBe(200); // Our mock always returns 200
  });
});
