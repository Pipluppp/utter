import { useEffect, useMemo, useState } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import { useAccountPageData } from "./accountData";
import { AccountProfileSkeleton } from "./accountSkeletons";
import { AccountNotice, AccountPanel } from "./accountUi";

type FormState = {
  displayName: string;
};

function buildFormState(
  profile: {
    display_name: string | null;
  } | null,
): FormState {
  return {
    displayName: profile?.display_name ?? "",
  };
}

function previewInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return "UT";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function AccountProfilePage() {
  const { authEmail, profile, saveProfile, signOut } = useAccountPageData();
  const [form, setForm] = useState<FormState>(() => buildFormState(profile));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const original = useMemo(() => buildFormState(profile), [profile]);

  useEffect(() => {
    setForm(original);
  }, [original]);

  const hasChanges = form.displayName !== original.displayName;

  useBeforeUnload((event) => {
    if (!hasChanges) return;
    event.preventDefault();
    event.returnValue = "";
  });

  const blocker = useBlocker(hasChanges);

  useEffect(() => {
    if (blocker.state !== "blocked") return;

    const proceed = window.confirm("You have unsaved profile changes. Leave this page?");

    if (proceed) {
      blocker.proceed();
      return;
    }

    blocker.reset();
  }, [blocker]);

  async function onSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      await saveProfile(form);
      setSaveSuccess("Changes saved.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function onSignOut() {
    setSaveError(null);
    setSaveSuccess(null);

    try {
      await signOut();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to sign out.");
    }
  }

  const displayName = form.displayName.trim() || authEmail || "Utter account";

  return (
    <div className="space-y-5">
      {saveError ? <AccountNotice tone="error">{saveError}</AccountNotice> : null}
      {saveSuccess ? <AccountNotice tone="success">{saveSuccess}</AccountNotice> : null}

      {!profile && !authEmail ? <AccountProfileSkeleton /> : null}

      {profile || authEmail ? (
        <>
          <AccountPanel kicker="Profile" title="Account identity">
            <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
              <div className="space-y-4">
                <div className="flex items-center gap-4 lg:flex-col lg:items-start">
                  <div className="grid size-20 place-items-center overflow-hidden rounded-full border border-border bg-subtle text-lg font-medium uppercase shadow-elevated">
                    {previewInitials(displayName)}
                  </div>
                  <div>
                    <div className="text-base font-medium text-foreground md:text-lg">
                      {displayName}
                    </div>
                    <div className="mt-2 text-[15px] leading-6 text-foreground/68">
                      {authEmail || "Unavailable"}
                    </div>
                    <div className="mt-2 break-all text-[13px] leading-6 text-foreground/56">
                      {profile?.id ?? "Unavailable"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="display_name">Display name</Label>
                  <Input
                    id="display_name"
                    autoComplete="name"
                    value={form.displayName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                    placeholder="Your name"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void onSave()} loading={saving}>
                Save changes
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setForm(original)}
                disabled={!hasChanges || saving}
              >
                Reset
              </Button>
            </div>
          </AccountPanel>

          <AccountPanel title="Sign out">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" size="sm" onClick={() => void onSignOut()}>
                Sign out
              </Button>
            </div>
          </AccountPanel>
        </>
      ) : null}
    </div>
  );
}
