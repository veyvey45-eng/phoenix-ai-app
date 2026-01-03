import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, X, FileText } from "lucide-react";
import { Streamdown } from "streamdown";

export interface DocumentAnalysisProps {
  fileName: string;
  analysis: string;
  isLoading?: boolean;
  onClose?: () => void;
}

export function DocumentAnalysis({
  fileName,
  analysis,
  isLoading = false,
  onClose
}: DocumentAnalysisProps) {
  return (
    <Card className="border-2 border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-500" />
            <div>
              <CardTitle className="text-lg">Analyse du document</CardTitle>
              <p className="text-sm text-gray-400 mt-1">{fileName}</p>
            </div>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
              <p className="text-sm text-gray-400">Analyse en cours...</p>
            </div>
          </div>
        ) : (
          <div className="prose prose-invert max-w-none">
            <Streamdown>{analysis}</Streamdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
