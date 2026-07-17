import { useCallback, useEffect, useRef, useState } from "react";
import { getCompatibility } from "../../lib/compatibility";
import { activateVaultSession, defaultInfrastructure } from "../activate-vault";
import type { VaultSession, VaultStartup } from "../vault-session";
import type { OpenNoteState } from "../view-models";
import { toNoteListItems, type NoteListItem } from "../view-models";

const compat = getCompatibility();

export interface UseVaultSessionOptions {
  flushBeforeSwitch?: () => void;
}

export interface UseVaultSessionResult {
  session: VaultSession | null;
  noteItems: NoteListItem[];
  current: OpenNoteState | null;
  setCurrent: (current: OpenNoteState | null) => void;
  error: string | null;
  setError: (error: string | null) => void;
  booting: boolean;
  handlePick: () => Promise<void>;
  refreshSummaries: () => Promise<void>;
}

function applyStartup(
  setSession: (s: VaultSession) => void,
  setSummaries: (s: VaultStartup["summaries"]) => void,
  setCurrent: (c: OpenNoteState | null) => void,
  session: VaultSession,
  startup: VaultStartup,
): void {
  setSession(session);
  setSummaries(startup.summaries);
  setCurrent(startup.current);
}

export function useVaultSession(
  options: UseVaultSessionOptions = {},
): UseVaultSessionResult {
  const { flushBeforeSwitch } = options;
  const [session, setSession] = useState<VaultSession | null>(null);
  const sessionRef = useRef<VaultSession | null>(null);
  sessionRef.current = session;
  const [summaries, setSummaries] = useState<VaultStartup["summaries"]>([]);
  const [current, setCurrent] = useState<OpenNoteState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  const refreshSummaries = useCallback(async () => {
    if (!sessionRef.current) return;
    setSummaries(await sessionRef.current.listSummaries());
  }, []);

  const activateFromHandle = useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      sessionRef.current?.dispose();
      const result = await activateVaultSession(handle);
      applyStartup(setSession, setSummaries, setCurrent, result.session, result.startup);
    },
    [],
  );

  useEffect(() => {
    if (!compat.supported) {
      setBooting(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const handle = await defaultInfrastructure.handleStore.load();
        if (!handle || cancelled) return;
        if (!(await defaultInfrastructure.vaultGateway.hasPermission(handle))) {
          return;
        }
        const result = await activateVaultSession(handle);
        if (cancelled) {
          result.session.dispose();
          return;
        }
        applyStartup(setSession, setSummaries, setCurrent, result.session, result.startup);
      } catch {
        await defaultInfrastructure.handleStore.clear();
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePick = useCallback(async () => {
    try {
      setError(null);
      const handle = await defaultInfrastructure.folderPicker.pick();
      if (!handle) return;
      flushBeforeSwitch?.();
      await activateFromHandle(handle);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [activateFromHandle, flushBeforeSwitch]);

  useEffect(() => {
    if (!session) setCurrent(null);
  }, [session]);

  return {
    session,
    noteItems: toNoteListItems(summaries),
    current,
    setCurrent,
    error,
    setError,
    booting,
    handlePick,
    refreshSummaries,
  };
}
