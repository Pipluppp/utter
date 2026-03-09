import { Link } from 'react-router-dom'
import { FeatureEntryLink } from '../../app/FeatureEntryLink'
import { TextReveal } from '../../components/animation/TextReveal'
import { buttonStyles } from '../../components/ui/Button'

export function LandingHero() {
  return (
    <section className="py-6 md:py-14">
      <div className="mx-auto max-w-4xl text-center">
        <TextReveal
          lines={['Clone voices.', 'Design new ones.', 'Generate speech.']}
        />

        <p className="mx-auto mt-5 max-w-2xl text-sm text-muted-foreground">
          Qwen-powered voice cloning, voice design, and speech generation. Hear
          real demos first, then create voices and queue speech in your own
          workspace. Supports 10 Qwen TTS languages.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to={{ pathname: '/', hash: '#demos' }}
            className={buttonStyles({ variant: 'primary', size: 'md' })}
          >
            {'Hear the demos ->'}
          </Link>
          <FeatureEntryLink
            to="/clone"
            className={buttonStyles({ variant: 'secondary', size: 'md' })}
          >
            {'Clone a voice ->'}
          </FeatureEntryLink>
        </div>
      </div>
    </section>
  )
}
