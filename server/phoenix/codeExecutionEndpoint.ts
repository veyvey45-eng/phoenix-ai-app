/**
 * Code Execution Endpoint
 * Endpoint API pour exécuter le code réellement via E2B Sandbox
 * 
 * Utilisation:
 * POST /api/execute-code
 * {
 *   "code": "print(5 + 3)",
 *   "language": "python"
 * }
 */

import { Router } from 'express';
import { executeCodeFromGroq } from './codeInterpreterTool';

const router = Router();

/**
 * POST /api/execute-code
 * Exécute le code fourni et retourne le résultat réel
 */
router.post('/execute-code', async (req, res) => {
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

    console.log(`[CodeExecutionEndpoint] Executing ${language} code (${code.length} chars)`);

    // Exécuter le code
    const result = await executeCodeFromGroq({
      language: language as 'python' | 'javascript',
      code,
      userId: 'api-user',
      username: 'api-executor',
    });

    // Retourner le résultat
    res.json({
      success: !result.error,
      code,
      language,
      output: result.output,
      error: result.error,
      executionTime: result.executionTime,
    });
  } catch (error) {
    console.error('[CodeExecutionEndpoint] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
