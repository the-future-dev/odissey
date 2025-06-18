// AI interfaces and types
export * from './interfaces';

// AI service manager
export { AIServiceManager } from './aiService';

// AI providers
export { HuggingFaceProvider } from './providers/huggingface';
export type { HuggingFaceConfig } from './providers/huggingface';
export { OpenAIProvider } from './providers/openai';
export type { OpenAIConfig } from './providers/openai';
export { GeminiProvider } from './providers/gemini';
export type { GeminiConfig } from './providers/gemini';
export { LocalFallbackProvider } from './providers/localFallback';