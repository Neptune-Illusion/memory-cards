import type { AIProvider, AIProviderConfig, ProviderType } from './aiProvider';
import { AnthropicProvider } from './anthropicProvider';
import { OpenAIProvider } from './openaiProvider';
import { GeminiProvider } from './geminiProvider';

export function createProvider(config: AIProviderConfig): AIProvider {
  // Migrate legacy 0.2.0 config where provider was 'claude'
  const provider = config.provider === ('claude' as ProviderType) ? 'anthropic' : config.provider;
  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
