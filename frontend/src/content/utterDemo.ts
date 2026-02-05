export type UtterDemo = {
  id: string
  title: string
  vibe: string
  languageLabel: string
  imageUrl?: string
  audioUrl?: string
  transcriptUrl?: string
  suggestedCloneName?: string
}

export const UTTER_DEMOS: UtterDemo[] = [
  {
    id: 'gojo',
    title: 'Gojo',
    vibe: 'Sharp, confident, anime-cinematic.',
    languageLabel: 'Japanese',
    imageUrl: '/static/utter_demo/gojo/still.png',
    audioUrl: '/static/utter_demo/gojo/reference.mp3',
    transcriptUrl: '/static/utter_demo/gojo/reference.txt',
    suggestedCloneName: 'Gojo (demo)',
  },
  {
    id: 'frieren',
    title: 'Frieren',
    vibe: 'Soft-spoken, calm, distant warmth.',
    languageLabel: 'Japanese',
    imageUrl: '/static/utter_demo/frieren/still.png',
    audioUrl: '/static/utter_demo/frieren/reference.mp3',
    transcriptUrl: '/static/utter_demo/frieren/reference.txt',
    suggestedCloneName: 'Frieren (demo)',
  },
  {
    id: 'eeaao',
    title: 'EEAAO',
    vibe: 'Grounded, tender, close-mic realism.',
    languageLabel: 'Chinese',
    imageUrl: '/static/utter_demo/eeaao/still.jpg',
    audioUrl: '/static/utter_demo/eeaao/reference.mp3',
    transcriptUrl: '/static/utter_demo/eeaao/reference.txt',
    suggestedCloneName: 'EEAAO (demo)',
  },
  {
    id: 'chungking',
    title: 'Chungking',
    vibe: 'Streetlight glow, late-night motion.',
    languageLabel: 'Cantonese / Mandarin',
    imageUrl: '/static/utter_demo/chungking/still.png',
    audioUrl: '/static/utter_demo/chungking/reference.mp3',
    suggestedCloneName: 'Chungking (demo)',
  },
  {
    id: 'brutalist',
    title: 'Brutalist',
    vibe: 'Architectural, cold air, concrete echo.',
    languageLabel: 'Unknown',
    imageUrl: '/static/utter_demo/brutalist/still.png',
    audioUrl: '/static/utter_demo/brutalist/reference.mp3',
    transcriptUrl: '/static/utter_demo/brutalist/reference.txt',
    suggestedCloneName: 'Brutalist (demo)',
  },
]

export function getUtterDemo(id: string): UtterDemo | null {
  return UTTER_DEMOS.find((d) => d.id === id) ?? null
}
