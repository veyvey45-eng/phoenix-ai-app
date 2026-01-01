import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface TormentGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  animated?: boolean;
}

export function TormentGauge({ 
  score, 
  size = "md", 
  showLabel = true,
  animated = true 
}: TormentGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  
  const getColorClass = () => {
    if (clampedScore < 25) return "torment-low";
    if (clampedScore < 50) return "torment-medium";
    if (clampedScore < 75) return "torment-high";
    return "torment-critical";
  };

  const getGradient = () => {
    if (clampedScore < 25) return "from-green-500 to-green-400";
    if (clampedScore < 50) return "from-yellow-500 to-yellow-400";
    if (clampedScore < 75) return "from-orange-500 to-orange-400";
    return "from-red-500 to-red-400";
  };

  const getLabel = () => {
    if (clampedScore < 25) return "Serein";
    if (clampedScore < 50) return "Attentif";
    if (clampedScore < 75) return "Préoccupé";
    return "Critique";
  };

  const sizeClasses = {
    sm: { container: "w-16 h-16", text: "text-sm", label: "text-xs" },
    md: { container: "w-24 h-24", text: "text-xl", label: "text-sm" },
    lg: { container: "w-32 h-32", text: "text-3xl", label: "text-base" }
  };

  const { container, text, label } = sizeClasses[size];
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("relative", container)}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/30"
          />
          {/* Progress circle */}
          <motion.circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="url(#tormentGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: animated ? strokeDashoffset : strokeDashoffset }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="tormentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={clampedScore < 50 ? "#22c55e" : "#f97316"} />
              <stop offset="100%" stopColor={clampedScore < 50 ? "#84cc16" : "#ef4444"} />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span 
            className={cn("font-bold", text, getColorClass())}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {Math.round(clampedScore)}
          </motion.span>
        </div>
      </div>
      
      {showLabel && (
        <div className="text-center">
          <span className={cn("font-medium", label, getColorClass())}>
            {getLabel()}
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">Score de Tourment</p>
        </div>
      )}
    </div>
  );
}

interface TormentBarProps {
  score: number;
  showChange?: number;
}

export function TormentBar({ score, showChange }: TormentBarProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  
  const getColorClass = () => {
    if (clampedScore < 25) return "bg-green-500";
    if (clampedScore < 50) return "bg-yellow-500";
    if (clampedScore < 75) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium">Tourment</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{Math.round(clampedScore)}/100</span>
          {showChange !== undefined && showChange !== 0 && (
            <span className={cn(
              "text-xs",
              showChange > 0 ? "text-red-400" : "text-green-400"
            )}>
              {showChange > 0 ? "+" : ""}{showChange.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", getColorClass())}
          initial={{ width: 0 }}
          animate={{ width: `${clampedScore}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
