import * as Dialog from "@radix-ui/react-dialog";
import { ReactNode } from "react";

/**
 * Shared shell for modal dialogs: a centred card with an overlay, title, and description.
 * @param open Whether the modal is visible.
 * @param onDismiss Called when the modal is closed (overlay click, Escape, or explicit close).
 * @param title Text displayed as the modal heading.
 * @param description Subtitle / explanatory text shown beneath the heading.
 * @param children Optional action elements rendered below the description.
 */
export default function ModalShell({
    open,
    onDismiss,
    title,
    description,
    children
}: {
    open: boolean;
    onDismiss: () => void;
    title: string;
    description: string;
    children?: ReactNode;
}) {
    return (
        <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60" />
                <Dialog.Content className="fixed top-1/2 left-1/2 flex w-72 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 rounded-xl bg-gray-800 p-4">
                    <Dialog.Title className="text-xl font-bold underline decoration-2">{title}</Dialog.Title>
                    <Dialog.Description className="text-sm text-gray-400">{description}</Dialog.Description>
                    {children}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
