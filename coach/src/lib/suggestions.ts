import type { YouTubeSuggestionModel } from '@/models/suggestion.ts'

export const searchYouTube = async (term?: string): Promise<YouTubeSuggestionModel[]> => {
  return [{
    type: 'youtube',
    title: 'Full Body Workout',
    url: 'https://www.youtube.com/watch?v=Tz9d7By2ytQ',
    thumbnailUrl: 'https://i.ytimg.com/vi/Tz9d7By2ytQ/hq720.jpg',
    channelTitle: 'Allblanc TV'
  }, {
    type: 'youtube',
    title: '10 Minute Evening Stretch for Beginners | Better Sleep & Relaxation',
    url: 'https://www.youtube.com/watch?v=BPlCatqZRPI',
    thumbnailUrl: 'https://i.ytimg.com/vi/Tz9d7By2ytQ/hq720.jpg',
    channelTitle: 'Mady Morrison'
  }]

}
