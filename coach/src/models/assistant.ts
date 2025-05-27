export type Model = 'gpt-4.1-nano'

export interface Assistant {
  model: Model,
  openAiApiKey: string,
  personality: string
}
