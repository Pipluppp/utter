import { ArrowRight } from "lucide-react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { Button } from "../../../components/atoms/Button";
import { AppLink } from "../../../components/atoms/Link";
import type { CloneResponse } from "../../../lib/types";

interface CloneSuccessModalProps {
  created: CloneResponse | null;
  onReset: () => void;
}

export function CloneSuccessModal({ created, onReset }: CloneSuccessModalProps) {
  return (
    <ModalOverlay
      isOpen={!!created}
      onOpenChange={(isOpen) => {
        if (!isOpen) onReset();
      }}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overscroll-contain backdrop-blur-sm data-[entering]:animate-in data-[entering]:fade-in data-[exiting]:animate-out data-[exiting]:fade-out"
    >
      <Modal className="w-full max-w-md">
        <Dialog className="border border-border bg-background p-6 shadow-elevated outline-none">
          <Heading slot="title" className="text-sm font-semibold uppercase tracking-wide">
            Clone Success
          </Heading>
          {created ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Voice <span className="text-foreground">{created.name}</span> is ready.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <AppLink
                  href={`/generate?voice=${created.id}`}
                  className="press-scale-sm-y inline-flex items-center justify-center border border-foreground bg-foreground px-6 py-3 text-sm font-medium uppercase tracking-wide text-background hover:bg-foreground/80 hover:border-foreground/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Go to Generate <ArrowRight className="icon-sm" aria-hidden="true" />
                </AppLink>
                <Button variant="secondary" type="button" onPress={onReset}>
                  Clone Another Voice
                </Button>
              </div>
            </>
          ) : null}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
