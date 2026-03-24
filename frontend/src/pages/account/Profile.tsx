import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useAccountPageData } from "./accountData";
import { AccountProfileSkeleton } from "./accountSkeletons";
import { AccountNotice, AccountPanel } from "./accountUi";
import { ChangePasswordSection } from "./ChangePasswordSection";

function previewInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return "UT";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function AccountProfilePage() {
  const { authEmail, identities, profile, signOut } = useAccountPageData();
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    setError(null);

    try {
      await signOut();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to sign out.");
    }
  }

  const displayName = authEmail || "Utter account";

  return (
    <div className="space-y-5">
      {error ? <AccountNotice tone="error">{error}</AccountNotice> : null}

      {!profile && !authEmail ? <AccountProfileSkeleton /> : null}

      {profile || authEmail ? (
        <>
          <AccountPanel kicker="Profile" title="Account identity">
            <div className="flex items-center gap-4">
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
          </AccountPanel>

          <ChangePasswordSection identities={identities} />

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
