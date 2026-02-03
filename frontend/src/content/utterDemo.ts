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
    imageUrl: '/static/utter_demo/gojo.jpg',
    audioUrl: '/static/utter_demo/gojo.mp3',
    transcriptUrl: '/static/utter_demo/gojo.txt',
    suggestedCloneName: 'Gojo (demo)',
  },
  {
    id: 'frieren',
    title: 'Frieren',
    vibe: 'Soft-spoken, calm, distant warmth.',
    languageLabel: 'Japanese',
    imageUrl: '/static/utter_demo/frieren.png',
    audioUrl: '/static/utter_demo/frieren.mp3',
    transcriptUrl: '/static/utter_demo/frieren.txt',
    suggestedCloneName: 'Frieren (demo)',
  },
  {
    id: 'parasite',
    title: 'Parasite',
    vibe: 'Quiet tension, intimate realism.',
    languageLabel: 'Korean',
    audioUrl: '/static/utter_demo/parasite.mp3',
    transcriptUrl: '/static/utter_demo/parasite.txt',
    suggestedCloneName: 'Parasite (demo)',
  },
  {
    id: 'chungking',
    title: 'Chungking',
    vibe: 'Streetlight glow, late-night motion.',
    languageLabel: 'Cantonese / Mandarin',
    imageUrl: '/static/utter_demo/chungking.jpg',
    audioUrl: '/static/utter_demo/chungking.mp3',
    suggestedCloneName: 'Chungking (demo)',
  },
  {
    id: 'brutalist',
    title: 'Brutalist',
    vibe: 'Architectural, cold air, concrete echo.',
    languageLabel: 'Unknown',
    imageUrl: '/static/utter_demo/brutalist.jpg',
    audioUrl: '/static/utter_demo/brutalist.mp3',
    transcriptUrl: '/static/utter_demo/brutalist.txt',
    suggestedCloneName: 'Brutalist (demo)',
  },
  {
    id: 'chunking',
    title: 'Long-form sample',
    vibe: 'A stress test for chunking + pacing.',
    languageLabel: 'Chinese',
    transcriptUrl: '/static/utter_demo/chunking.txt',
  },
]

export function getUtterDemo(id: string): UtterDemo | null {
  return UTTER_DEMOS.find((d) => d.id === id) ?? null
}
