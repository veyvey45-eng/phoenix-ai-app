import { invokeLLM } from './server/_core/llm.ts';

try {
  console.log('Testing Google AI...');
  const response = await invokeLLM({
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say hello in French' }
    ]
  });
  console.log('Google AI response:', response.choices?.[0]?.message?.content);
} catch (error) {
  console.error('Google AI error:', error.message);
}
