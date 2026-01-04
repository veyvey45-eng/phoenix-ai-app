/**
 * Code Execution Endpoint
 * Handles real-time code execution via E2B Sandbox
 */

import { Request, Response } from 'express';
import { e2bSandbox } from '../phoenix/e2bSandbox';

export async function handleCodeExecution(req: Request, res: Response) {
  try {
    const { code, language = 'python' } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Code is required',
      });
    }

    if (!['python', 'javascript'].includes(language)) {
      return res.status(400).json({
        success: false,
        error: 'Language must be python or javascript',
      });
    }

    // Get user info from session
    const userId = (req as any).user?.id || 'anonymous';
    const username = (req as any).user?.name || 'Anonymous';

    // Execute code
    let result;
    if (language === 'python') {
      result = await e2bSandbox.executePython(code, userId, username);
    } else {
      result = await e2bSandbox.executeJavaScript(code, userId, username);
    }

    // Return result
    res.json(result);
  } catch (error) {
    console.error('[Code Execution] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Execute code found in Phoenix response
 */
export async function executePhoenixCodeEndpoint(req: Request, res: Response) {
  try {
    const { response } = req.body;
    
    if (!response || typeof response !== 'string') {
      res.status(400).json({ error: 'Response text is required' });
      return;
    }
    
    const userId = (req as any).user?.id || 'anonymous';
    
    console.log('[CodeExecutionEndpoint] Processing response for code execution');
    console.log('[CodeExecutionEndpoint] Response length:', response.length);
    
    // Import the handler
    const { executeAllCodeBlocks } = await import('../phoenix/postExecutionHandler');
    
    // Execute all code blocks found in the response
    const result = await executeAllCodeBlocks(response, String(userId));
    
    console.log('[CodeExecutionEndpoint] Execution complete');
    console.log('[CodeExecutionEndpoint] Results:', {
      blocksFound: result.executionResults.length,
      allSuccessful: result.executionResults.every(r => r.success)
    });
    
    // Return the modified response with real execution results
    res.json({
      success: true,
      originalResponse: result.originalResponse,
      modifiedResponse: result.modifiedResponse,
      executionResults: result.executionResults,
      executionCount: result.executionResults.length
    });
    
  } catch (error) {
    console.error('[CodeExecutionEndpoint] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function handleCodeExecutionStream(req: Request, res: Response) {
  try {
    const { code, language = 'python' } = req.body;

    if (!code) {
      res.write('data: ' + JSON.stringify({ error: 'Code is required' }) + '\n\n');
      res.end();
      return;
    }

    if (!['python', 'javascript'].includes(language)) {
      res.write('data: ' + JSON.stringify({ error: 'Language must be python or javascript' }) + '\n\n');
      res.end();
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Get user info from session
    const userId = (req as any).user?.id || 'anonymous';
    const username = (req as any).user?.name || 'Anonymous';

    // Send execution start
    res.write('data: ' + JSON.stringify({ status: 'executing', message: `Executing ${language} code...` }) + '\n\n');

    // Execute code
    let result;
    if (language === 'python') {
      result = await e2bSandbox.executePython(code, userId, username);
    } else {
      result = await e2bSandbox.executeJavaScript(code, userId, username);
    }

    // Send result
    res.write('data: ' + JSON.stringify(result) + '\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[Code Execution Stream] Error:', error);
    res.write('data: ' + JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }) + '\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
