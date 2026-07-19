"use client";

import { useParams } from "next/navigation";
import { MemoryManager } from "@/components/MemoryManager";

export default function ProjectMemorySettingsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="min-h-full md:h-full md:min-h-0">
      <MemoryManager projectId={id} />
    </div>
  );
}
