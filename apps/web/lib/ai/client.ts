import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const MODELS = {
  analysis: 'claude-sonnet-4-6',
  fast: 'claude-haiku-4-5-20251001',
} as const
