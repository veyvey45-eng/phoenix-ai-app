import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { e2bSandbox } from "../phoenix/e2bSandbox";

/**
 * Code Interpreter Router
 * Code execution endpoints
 */
export const codeInterpreterRouter = router({
  /**
   * Execute Python code (Public - for Phoenix to use)
   */
  executePythonPublic: publicProcedure
    .input(z.object({
      code: z.string().min(1),
      language: z.literal('python').optional().default('python'),
    }))
    .mutation(async ({ ctx, input }) => {
      console.log(`[CodeInterpreter] Executing Python code`);
      
      const result = await e2bSandbox.executePython(
        input.code,
        String(ctx.user?.id || 'anonymous'),
        ctx.user?.email || 'anonymous@system.local'
      );

      return result;
    }),
  /**
   * Execute Python code in E2B Sandbox (Protected - Admin-only)
   */
  executePythonAdmin: protectedProcedure
    .input(z.object({
      code: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Admin-only check
      if (ctx.user.role !== 'admin') {
        throw new Error('Only administrators can execute code');
      }

      console.log(`[CodeInterpreter] Admin ${ctx.user.email} executing Python code`);
      
      const result = await e2bSandbox.executePython(
        input.code,
        String(ctx.user.id),
        ctx.user.email || 'unknown'
      );

      return result;
    }),

  /**
   * Execute JavaScript code (Public - for Phoenix to use)
   */
  executeJavaScriptPublic: publicProcedure
    .input(z.object({
      code: z.string().min(1),
      language: z.literal('javascript').optional().default('javascript'),
    }))
    .mutation(async ({ ctx, input }) => {
      console.log(`[CodeInterpreter] Executing JavaScript code`);
      
      const result = await e2bSandbox.executeJavaScript(
        input.code,
        String(ctx.user?.id || 'anonymous'),
        ctx.user?.email || 'anonymous@system.local'
      );

      return result;
    }),

  /**
   * Execute JavaScript code in E2B Sandbox (Protected - Admin-only)
   */
  executeJavaScriptAdmin: protectedProcedure
    .input(z.object({
      code: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Admin-only check
      if (ctx.user.role !== 'admin') {
        throw new Error('Only administrators can execute code');
      }

      console.log(`[CodeInterpreter] Admin ${ctx.user.email} executing JavaScript code`);
      
      const result = await e2bSandbox.executeJavaScript(
        input.code,
        String(ctx.user.id),
        ctx.user.email || 'unknown'
      );

      return result;
    }),

  /**
   * Get audit logs for code execution (Admin-only)
   */
  getAuditLogs: protectedProcedure
    .query(({ ctx }) => {
      // Admin-only check
      if (ctx.user.role !== 'admin') {
        throw new Error('Only administrators can view audit logs');
      }

      return e2bSandbox.getAuditLogs();
    }),

  /**
   * Get audit logs for current user
   */
  getMyAuditLogs: protectedProcedure
    .query(({ ctx }) => {
      return e2bSandbox.getAuditLogsForUser(String(ctx.user.id));
    }),
});
