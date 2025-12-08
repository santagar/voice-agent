import { createContext, useContext, useMemo } from "react";
import { VoiceSessionActions, VoiceSessionStore } from "./realtimeTypes";
import { useRealtimeSession } from "./useRealtimeSession";

type VoiceSessionContextValue = {
  store: VoiceSessionStore;
  actions: VoiceSessionActions;
};

const VoiceSessionContext = createContext<VoiceSessionContextValue | null>(null);

export function RealtimeSessionProvider({
  children,
  options,
}: {
  children: React.ReactNode;
  options?: Parameters<typeof useRealtimeSession>[0];
}) {
  const session = useRealtimeSession(options);
  const value = useMemo(
    () => ({ store: session.store, actions: session.actions }),
    [session.store, session.actions]
  );
  return (
    <VoiceSessionContext.Provider value={value}>
      {children}
    </VoiceSessionContext.Provider>
  );
}

export function useRealtimeSessionContext() {
  const ctx = useContext(VoiceSessionContext);
  if (!ctx) {
    throw new Error("useRealtimeSessionContext must be used within RealtimeSessionProvider");
  }
  return ctx;
}

// Convenience hook for components that only need state.
export function useRealtimeSessionStore(): VoiceSessionStore {
  return useRealtimeSessionContext().store;
}

// Convenience hook for components that only need actions.
export function useRealtimeSessionActions(): VoiceSessionActions {
  return useRealtimeSessionContext().actions;
}
