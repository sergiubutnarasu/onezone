"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddMemoryDialog } from "@/components/AddMemoryDialog";

interface AddMemoryButtonProps {
  projectId: string;
  onCreated: (key: string, content: string) => void;
}

export function AddMemoryButton({ projectId, onCreated }: AddMemoryButtonProps) {
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  const handleOpen = () => {
    setDialogKey((key) => key + 1);
    setOpen(true);
  };

  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={handleOpen}
        title="Add memory"
      >
        <Plus />
      </Button>

      <AddMemoryDialog
        key={dialogKey}
        projectId={projectId}
        open={open}
        onOpenChange={setOpen}
        onCreated={onCreated}
      />
    </>
  );
}