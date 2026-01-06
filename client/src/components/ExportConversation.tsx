/**
 * ExportConversation - Composant pour exporter les conversations
 */

import React, { useState } from 'react';
import { Download, FileText, FileCode, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

interface ExportConversationProps {
  messages: Message[];
  conversationTitle?: string;
}

export function ExportConversation({ messages, conversationTitle = 'Conversation Phoenix' }: ExportConversationProps) {
  const [copied, setCopied] = useState(false);

  const formatAsMarkdown = (): string => {
    const date = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let markdown = `# ${conversationTitle}\n\n`;
    markdown += `*Exporté le ${date}*\n\n---\n\n`;

    messages.forEach((msg, index) => {
      const role = msg.role === 'user' ? '👤 **Vous**' : '🤖 **Phoenix**';
      const time = msg.timestamp 
        ? new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : '';
      
      markdown += `### ${role} ${time ? `(${time})` : ''}\n\n`;
      markdown += `${msg.content}\n\n`;
      
      if (index < messages.length - 1) {
        markdown += '---\n\n';
      }
    });

    return markdown;
  };

  const formatAsText = (): string => {
    const date = new Date().toLocaleDateString('fr-FR');
    let text = `${conversationTitle}\nExporté le ${date}\n${'='.repeat(50)}\n\n`;

    messages.forEach((msg) => {
      const role = msg.role === 'user' ? 'Vous' : 'Phoenix';
      text += `[${role}]\n${msg.content}\n\n`;
    });

    return text;
  };

  const formatAsJSON = (): string => {
    return JSON.stringify({
      title: conversationTitle,
      exportDate: new Date().toISOString(),
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp?.toISOString()
      }))
    }, null, 2);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Conversation exportée en ${filename.split('.').pop()?.toUpperCase()}`);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formatAsMarkdown());
      setCopied(true);
      toast.success('Conversation copiée dans le presse-papiers');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erreur lors de la copie');
    }
  };

  const handleExportMarkdown = () => {
    const filename = `${conversationTitle.replace(/\s+/g, '_')}_${Date.now()}.md`;
    downloadFile(formatAsMarkdown(), filename, 'text/markdown');
  };

  const handleExportText = () => {
    const filename = `${conversationTitle.replace(/\s+/g, '_')}_${Date.now()}.txt`;
    downloadFile(formatAsText(), filename, 'text/plain');
  };

  const handleExportJSON = () => {
    const filename = `${conversationTitle.replace(/\s+/g, '_')}_${Date.now()}.json`;
    downloadFile(formatAsJSON(), filename, 'application/json');
  };

  if (messages.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Exporter</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleExportMarkdown} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4" />
          Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportText} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4" />
          Texte brut (.txt)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJSON} className="gap-2 cursor-pointer">
          <FileCode className="w-4 h-4" />
          JSON (.json)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyToClipboard} className="gap-2 cursor-pointer">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          Copier
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
