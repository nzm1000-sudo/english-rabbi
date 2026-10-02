/**
 * AI provider abstraction.
 *
 * The app never calls a model vendor directly. Features (tutor chat, writing
 * feedback, conversation mode) depend only on this interface, so the backend
 * can be a local model, a model on the home server, a free tier, or a paid
 * API, without rewriting features.
 *
 * Policy: no paid provider is connected without the parent's explicit
 * approval. Learner context sent to any provider is minimized (see
 * tutorContext.ts): first name only, no raw events, no recordings.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Ask for a JSON object (for structured feedback). */
  json?: boolean;
  signal?: AbortSignal;
}

export interface CompletionResult {
  text: string;
  provider: string;
}

export interface AIProviderInfo {
  id: string;
  label: string;
  /** Where data goes: on this device, the home server, or a third party. */
  dataLocation: 'device' | 'home-server' | 'third-party';
  costs: 'free' | 'paid';
}

export interface AIProvider {
  readonly info: AIProviderInfo;
  isAvailable(): Promise<boolean>;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

/** Default: no AI. Core learning works fully without it. */
export class NoAIProvider implements AIProvider {
  readonly info: AIProviderInfo = { id: 'none', label: 'ללא AI', dataLocation: 'device', costs: 'free' };
  async isAvailable() {
    return false;
  }
  async complete(): Promise<CompletionResult> {
    throw new Error('No AI provider configured');
  }
}
