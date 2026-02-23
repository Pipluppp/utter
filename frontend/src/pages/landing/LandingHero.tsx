import { Link, NavLink } from 'react-router-dom'
import { TextReveal } from '../../components/animation/TextReveal'
import { buttonStyles } from '../../components/ui/Button'
import { useLanguages } from '../hooks'

export function LandingHero() {
  const { languages } = useLanguages()

  return (
    <section className="py-6 md:py-14">
      <div className="mx-auto max-w-4xl text-center">
        <TextReveal
          lines={['Clone voices.', 'Design new ones.', 'Generate speech.']}
        />

        <p className="mx-auto mt-5 max-w-2xl text-sm text-muted-foreground">
          A minimal workflow for voice cloning + generation. Hear real demos
          first, then try it yourself. {languages.length} languages supported.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to={{ pathname: '/', hash: '#demos' }}
            className={buttonStyles({ variant: 'primary', size: 'md' })}
          >
            Hear the demos →
          </Link>
          <NavLink
            to="/clone"
            className={buttonStyles({ variant: 'secondary', size: 'md' })}
          >
            Clone a voice →
          </NavLink>
        </div>
      </div>
    </section>
  )
}
