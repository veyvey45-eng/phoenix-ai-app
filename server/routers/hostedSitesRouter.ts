/**
 * Hosted Sites Router - API pour la gestion des sites hébergés
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import {
  createHostedSite,
  getSiteBySlug,
  getUserSites,
  updateSite,
  deleteSite,
  incrementViewCount,
  getPublicSites,
} from "../hostedSites";

export const hostedSitesRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      siteType: z.enum(["landing", "portfolio", "business", "ecommerce", "blog", "custom"]).optional(),
      htmlContent: z.string().min(1),
      cssContent: z.string().optional(),
      jsContent: z.string().optional(),
      isPublic: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const site = await createHostedSite({
        userId: ctx.user.id,
        ...input,
      });
      
      if (!site) {
        return { success: false, error: "Failed to create site" };
      }
      
      return {
        success: true,
        site,
        url: `/sites/${site.slug}`,
      };
    }),

  getBySlug: publicProcedure
    .input(z.object({
      slug: z.string(),
    }))
    .query(async ({ input }) => {
      const site = await getSiteBySlug(input.slug);
      
      if (!site) {
        return { success: false, error: "Site not found" };
      }
      
      await incrementViewCount(input.slug);
      
      return { success: true, site };
    }),

  getMySites: protectedProcedure.query(async ({ ctx }) => {
    const sites = await getUserSites(ctx.user.id);
    return { success: true, sites };
  }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      htmlContent: z.string().optional(),
      cssContent: z.string().optional(),
      jsContent: z.string().optional(),
      isPublic: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const site = await updateSite(id, ctx.user.id, updates);
      
      if (!site) {
        return { success: false, error: "Site not found or unauthorized" };
      }
      
      return { success: true, site };
    }),

  delete: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const success = await deleteSite(input.id, ctx.user.id);
      return { success };
    }),

  getPublic: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional(),
    }))
    .query(async ({ input }) => {
      const sites = await getPublicSites(input.limit);
      return { success: true, sites };
    }),
});
