import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-border bg-background p-5 shadow-elevated">
      <div className="text-[12px] font-semibold uppercase tracking-wide">
        {title}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function AccountProfilePage() {
  return (
    <div className="space-y-4">
      <section className="border border-border bg-subtle p-4 text-sm text-muted-foreground shadow-elevated">
        Sign in will be added with Supabase Auth. Until then, profile settings
        are read-only.
      </section>

      <Card title="Identity">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-full border border-border bg-subtle text-sm font-semibold">
              —
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide">
                Signed out
              </div>
              <div className="text-sm text-muted-foreground">
                Connect an account to edit
              </div>
            </div>
          </div>

          <div className="grid flex-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                defaultValue=""
                placeholder="—"
                disabled
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" defaultValue="" placeholder="—" disabled />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="handle">Handle</Label>
              <Input id="handle" defaultValue="" placeholder="—" disabled />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" disabled>
            Save changes
          </Button>
        </div>
      </Card>

      <Card title="Preferences">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="default_format">Default export</Label>
            <Input id="default_format" defaultValue="WAV" disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="default_language">Default language</Label>
            <Input id="default_language" defaultValue="Auto" disabled />
          </div>
        </div>
      </Card>

      <Card title="Danger zone">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" disabled>
            Sign out
          </Button>
          <Button variant="secondary" size="sm" disabled>
            Delete account
          </Button>
        </div>
      </Card>
    </div>
  )
}
