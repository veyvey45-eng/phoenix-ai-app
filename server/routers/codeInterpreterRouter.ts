import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { e2bSandbox } from "../phoenix/e2bSandbox";

/**
 * Code Interpreter Router
 * Admin-only code execution endpoints
 */
export const codeInterpreterRouter = router({
  /**
   * Execute Python code in E2B Sandbox (Admin-only)
   */
  executePython: protectedProcedure
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
   * Execute JavaScript code in E2B Sandbox (Admin-only)
   */
  executeJavaScript: protectedProcedure
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
