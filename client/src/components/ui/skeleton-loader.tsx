/**
 * Skeleton Loader Components - Pour les états de chargement
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("skeleton rounded-md bg-muted", className)} />
  );
}

export function SkeletonText({ className, lines = 3 }: SkeletonProps & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            "h-4",
            i === lines - 1 ? "w-3/4" : "w-full"
          )} 
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn("p-4 rounded-lg border border-border", className)}>
      <Skeleton className="h-8 w-1/3 mb-4" />
      <SkeletonText lines={3} />
    </div>
  );
}

export function SkeletonMessage({ className, isUser = false }: SkeletonProps & { isUser?: boolean }) {
  return (
    <div className={cn(
      "flex gap-3 p-4",
      isUser ? "flex-row-reverse" : "",
      className
    )}>
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className={cn("flex-1 space-y-2", isUser ? "items-end" : "")}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className={cn("h-20 rounded-lg", isUser ? "w-2/3 ml-auto" : "w-3/4")} />
      </div>
    </div>
  );
}

export function SkeletonChat({ className }: SkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <SkeletonMessage />
      <SkeletonMessage isUser />
      <SkeletonMessage />
    </div>
  );
}

export function SkeletonCodeBlock({ className }: SkeletonProps) {
  return (
    <div className={cn("p-4 rounded-lg bg-card border border-border", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-4 w-20 ml-auto" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonDashboard({ className }: SkeletonProps) {
  return (
    <div className={cn("grid gap-4", className)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonCodeBlock />
        <SkeletonChat />
      </div>
    </div>
  );
}
