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
    imageUrl: '/static/utter_demo_v2/gojo.png',
    audioUrl: '/static/utter_demo_v2/gojo.mp3',
    transcriptUrl: '/static/utter_demo_v2/gojo.txt',
    suggestedCloneName: 'Gojo (demo)',
  },
  {
    id: 'frieren',
    title: 'Frieren',
    vibe: 'Soft-spoken, calm, distant warmth.',
    languageLabel: 'Japanese',
    imageUrl: '/static/utter_demo_v2/frieren.png',
    audioUrl: '/static/utter_demo_v2/frieren.mp3',
    transcriptUrl: '/static/utter_demo_v2/frieren.txt',
    suggestedCloneName: 'Frieren (demo)',
  },
  {
    id: 'parasite',
    title: 'Parasite',
    vibe: 'Quiet tension, intimate realism.',
    languageLabel: 'Korean',
    audioUrl: '/static/utter_demo_v2/parasite.mp3',
    transcriptUrl: '/static/utter_demo_v2/parasite.txt',
    suggestedCloneName: 'Parasite (demo)',
  },
  {
    id: 'chungking',
    title: 'Chungking',
    vibe: 'Streetlight glow, late-night motion.',
    languageLabel: 'Cantonese / Mandarin',
    imageUrl: '/static/utter_demo_v2/chungking.png',
    audioUrl: '/static/utter_demo_v2/chungking.mp3',
    suggestedCloneName: 'Chungking (demo)',
  },
  {
    id: 'brutalist',
    title: 'Brutalist',
    vibe: 'Architectural, cold air, concrete echo.',
    languageLabel: 'Unknown',
    imageUrl: '/static/utter_demo_v2/brutalist.png',
    audioUrl: '/static/utter_demo_v2/brutalist.mp3',
    transcriptUrl: '/static/utter_demo_v2/brutalist.txt',
    suggestedCloneName: 'Brutalist (demo)',
  },
  {
    id: 'chunking',
    title: 'Long-form sample',
    vibe: 'A stress test for chunking + pacing.',
    languageLabel: 'Chinese',
    transcriptUrl: '/static/utter_demo_v2/chunking.txt',
  },
]

export function getUtterDemo(id: string): UtterDemo | null {
  return UTTER_DEMOS.find((d) => d.id === id) ?? null
}
