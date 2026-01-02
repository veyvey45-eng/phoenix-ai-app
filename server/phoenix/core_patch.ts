// Patch pour remplacer la section du prompt
const patchedPromptSection = `    // Ajouter l'historique conversationnel (jusqu'a 200 messages)
    if (context.recentUtterances && context.recentUtterances.length > 0) {
      prompt += "\\n## HISTORIQUE DE CONVERSATION\\n";
      prompt += \`Voici les \${context.recentUtterances.length} derniers echanges:\\n\\n\`;
      
      const utterances = context.recentUtterances;
      const summarizeThreshold = 50;
      
      if (utterances.length > summarizeThreshold) {
        // Resume des anciens messages
        const oldMessages = utterances.slice(0, utterances.length - 30);
        const recentMessages = utterances.slice(utterances.length - 30);
        
        prompt += \`[RESUME des \${oldMessages.length} premiers messages]\\n\\n\`;
        
        // Detail des 30 derniers messages
        for (const utterance of recentMessages) {
          const role = utterance.role === 'user' ? 'Utilisateur' : 'Phoenix';
          const content = utterance.content.length > 200 
            ? utterance.content.substring(0, 200) + '...' 
            : utterance.content;
          prompt += \`**\${role}**: \${content}\\n\\n\`;
        }
      } else {
        // Afficher tous les messages si moins de 50
        for (const utterance of utterances) {
          const role = utterance.role === 'user' ? 'Utilisateur' : 'Phoenix';
          const content = utterance.content.length > 300 
            ? utterance.content.substring(0, 300) + '...' 
            : utterance.content;
          prompt += \`**\${role}**: \${content}\\n\\n\`;
        }
      }
      
      prompt += "---\\n\\n";
    }`;
