import { Button as AriaButton, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  isOpen,
  onOpenChange,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <Modal className="mx-4 w-full max-w-sm border border-border bg-background p-6 shadow-elevated">
        <Dialog role="alertdialog" className="outline-none">
          {({ close }) => (
            <>
              <Heading slot="title" className="text-sm font-semibold uppercase tracking-wide">
                {title}
              </Heading>
              <p className="mt-3 text-sm text-muted-foreground">{message}</p>
              <div className="mt-6 flex justify-end gap-2">
                <AriaButton
                  onPress={close}
                  className={buttonStyle({ variant: "secondary", size: "sm" })}
                >
                  Cancel
                </AriaButton>
                <AriaButton
                  onPress={() => {
                    onConfirm();
                    close();
                  }}
                  className={buttonStyle({ variant: "primary", size: "sm" })}
                >
                  {confirmLabel}
                </AriaButton>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
