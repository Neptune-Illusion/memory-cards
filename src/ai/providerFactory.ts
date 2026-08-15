import type { AIProvider, AIProviderConfig } from './aiProvider';
import { AnthropicProvider } from './anthropicProvider';
import { OpenAIProvider } from './openaiProvider';

export function createProvider(config: AIProviderConfig): AIProvider {
  // Migrate legacy configs: 'claude' → 'anthropic', 'gemini' → 'anthropic' default
  let provider = config.provider;
  if (provider === ('claude' as never) || provider === ('gemini' as never)) {
    provider = 'anthropic';
  }
  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
