export type Model = 'gpt-4.1-nano'

export interface Assistant {
    model: Model;
    personality: string;

    generatedTexts: { [key: string]: string }
}
