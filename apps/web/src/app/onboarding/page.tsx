"use client";

import { OnboardingScreen } from "@/components/OnboardingScreen";
import { fetchAgents, fetchProjects } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OnboardingPage() {
  const router = useRouter();

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  // Once the user has at least one project, onboarding is complete.
  useEffect(() => {
    if (projects.length > 0) {
      router.replace("/");
    }
  }, [projects.length, router]);

  return <OnboardingScreen agents={agents} />;
}
