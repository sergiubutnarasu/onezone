"use client";

import { useParams } from "next/navigation";
import { MemoryManager } from "@/components/MemoryManager";

export default function ProjectMemorySettingsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="h-full min-h-0">
      <MemoryManager projectId={id} />
    </div>
  );
}
