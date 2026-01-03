import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { streamChatEndpoint, fastStreamChatEndpoint } from "./streamingEndpoint";


function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Streaming endpoints for real-time responses (support both GET and POST)
  app.get("/api/stream/chat", streamChatEndpoint);
  app.post("/api/stream/chat", streamChatEndpoint);
  app.get("/api/stream/fast-chat", fastStreamChatEndpoint);
  app.post("/api/stream/fast-chat", fastStreamChatEndpoint);
  
  // Endpoint to save conversation messages
  app.post("/api/save-message", async (req, res) => {
    try {
      const { conversationId, role, content } = req.body;
      
      if (!conversationId || !role || !content) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const { saveConversationMessage } = await import('../db');
      const result = await saveConversationMessage(conversationId, role, content);
      
      res.json({ success: true, message: result });
    } catch (error) {
      console.error('Error saving message:', error);
      res.status(500).json({ error: 'Failed to save message' });
    }
  });
  // Document analysis endpoint
  app.post("/api/analyze-document", async (req, res) => {
    try {
      const { fileId } = req.body;
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      if (!fileId) {
        return res.status(400).json({ error: 'Missing fileId' });
      }
      
      const { getFileProcessor } = await import('../phoenix/fileProcessor');
      const { processPhoenixQuery } = await import('../phoenix/phoenixSimple');
      
      const processor = getFileProcessor();
      const file = processor.getFile(fileId);
      
      if (!file || file.userId !== user.id) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      if (!file.extractedText) {
        return res.status(400).json({ error: 'No text content to analyze' });
      }
      
      // Prepare analysis prompt
      const analysisPrompt = `Veuillez analyser le document suivant et fournir une analyse complete et structuree:\n\n--- DOCUMENT: ${file.originalName} ---\n${file.extractedText}\n--- FIN DU DOCUMENT ---\n\nFournissez:\n1. Un resume executif (2-3 paragraphes)\n2. Les points cles identifies\n3. Les insights importants\n4. Les recommandations (le cas echeant)`;
      
      // Process through Phoenix
      const analysis = await processPhoenixQuery(analysisPrompt, [{
        role: 'user' as const,
        content: analysisPrompt
      }]);
      
      res.json({
        success: true,
        fileId,
        fileName: file.originalName,
        analysis: typeof analysis === 'string' ? analysis : JSON.stringify(analysis)
      });
    } catch (error) {
      console.error('Error analyzing document:', error);
      res.status(500).json({ error: 'Failed to analyze document' });
    }
  });

  // File retrieval endpoint for client-side file content loading
  app.get("/api/files/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const { getFileProcessor } = await import('../phoenix/fileProcessor');
      const processor = getFileProcessor();
      const file = processor.getFile(fileId);
      
      if (!file || file.userId !== user.id) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      res.json({
        id: file.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        extractedText: file.extractedText,
        metadata: file.metadata,
        storageUrl: file.storageUrl,
        uploadedAt: file.uploadedAt
      });
    } catch (error) {
      console.error('Error retrieving file:', error);
      res.status(500).json({ error: 'Failed to retrieve file' });
    }
  });

  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
