export type SuggestionType = 'youtube' | 'other';

export interface SuggestionModel {
    type: SuggestionType;
    title: string;
    description?: string;
    url: string;
    thumbnailUrl: string;
    duration?: string;
    durationInSeconds?: number;
}

export interface YouTubeSuggestionModel extends SuggestionModel {
    channelTitle: string;
    type: 'youtube';
}
