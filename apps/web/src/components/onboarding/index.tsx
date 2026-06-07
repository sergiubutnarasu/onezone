"use client";

import { useState } from "react";
import { Bot, FolderOpen, Monitor } from "lucide-react";
import { StepIndicator } from "./StepIndicator";
import { ConnectTerminalStep } from "./ConnectTerminalStep";
import { ConfigureAgentsStep } from "./ConfigureAgentsStep";
import { CreateProjectStep } from "./CreateProjectStep";
import type { Agent } from "@/lib/api";

const STEPS = [
  { id: 1, label: "Terminal", icon: Monitor },
  { id: 2, label: "Agents", icon: Bot },
  { id: 3, label: "Project", icon: FolderOpen },
];

interface OnboardingScreenProps {
  agents: Agent[];
}

export function OnboardingScreen({ agents }: OnboardingScreenProps) {
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-[calc(100dvh-3rem)] md:min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-display text-balance">
            Welcome to Onezone
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Let&apos;s get you set up in three steps.
          </p>
        </div>

        <StepIndicator steps={STEPS} currentStep={step} />

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {step === 1 && <ConnectTerminalStep onNext={() => setStep(2)} />}
          {step === 2 && (
            <ConfigureAgentsStep agents={agents} onNext={() => setStep(3)} />
          )}
          {step === 3 && <CreateProjectStep agents={agents} />}
        </div>
      </div>
    </div>
  );
}
