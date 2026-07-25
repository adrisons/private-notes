import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCompatibility } from "../../lib/compatibility";
import { defaultInfrastructure } from "../composition";
import { openVaultUserError, reportUserError, vaultIncompatibleCause } from "../errors";
import { openVault } from "../use-cases/open-vault";
import { repairVault } from "../use-cases/repair-vault";
import type { VaultSession, VaultStartup } from "../vault-session";
import type { OpenNoteState } from "../view-models";
import { toNoteListItems, type NoteListItem } from "../view-models";

const compat = getCompatibility();

export type VaultOpenIssue =
  | { kind: "repair"; handle: FileSystemDirectoryHandle; noteCount: number }
  | { kind: "blocked"; message: string; fixHint: string };

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
  openIssue: VaultOpenIssue | null;
  repairing: boolean;
  booting: boolean;
  handlePick: () => Promise<void>;
  repairAndOpen: () => Promise<void>;
  dismissOpenIssue: () => void;
  chooseAnotherFolder: () => void;
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

function clearActiveVault(
  setSession: (s: VaultSession | null) => void,
  setSummaries: (s: VaultStartup["summaries"]) => void,
  setCurrent: (c: OpenNoteState | null) => void,
  sessionRef: { current: VaultSession | null },
): void {
  sessionRef.current?.dispose();
  sessionRef.current = null;
  setSession(null);
  setSummaries([]);
  setCurrent(null);
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
  const [openIssue, setOpenIssue] = useState<VaultOpenIssue | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [booting, setBooting] = useState(true);

  const refreshSummaries = useCallback(async () => {
    if (!sessionRef.current) return;
    setSummaries(await sessionRef.current.listSummaries());
  }, []);

  const activateFromHandle = useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      clearActiveVault(setSession, setSummaries, setCurrent, sessionRef);
      try {
        const result = await openVault(handle);
        applyStartup(setSession, setSummaries, setCurrent, result.session, result.startup);
      } catch (err) {
        clearActiveVault(setSession, setSummaries, setCurrent, sessionRef);
        throw err;
      }
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
        const result = await openVault(handle);
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

  const handleOpenFailure = useCallback(async (err: unknown, handle: FileSystemDirectoryHandle) => {
    const incompatible = vaultIncompatibleCause(err);
    if (incompatible?.code === "not-a-vault") {
      const assessment = await defaultInfrastructure.vaultGateway.assessRepair(handle);
      if (assessment.eligible) {
        setOpenIssue({ kind: "repair", handle, noteCount: assessment.noteCount });
        setError(null);
        return;
      }
      setOpenIssue({
        kind: "blocked",
        message: "This folder is not a private-notes vault.",
        fixHint:
          "Choose an empty folder to create a new vault, or one that already contains note files under notes/.",
      });
      setError(null);
      return;
    }

    const payload =
      incompatible !== null ? openVaultUserError(incompatible) : reportUserError(err);
    setOpenIssue({
      kind: "blocked",
      message: payload.message,
      fixHint: payload.fixHint,
    });
    setError(null);
  }, []);

  const handlePick = useCallback(async () => {
    try {
      setError(null);
      setOpenIssue(null);
      const handle = await defaultInfrastructure.folderPicker.pick();
      if (!handle) return;
      flushBeforeSwitch?.();
      try {
        await activateFromHandle(handle);
      } catch (err) {
        await handleOpenFailure(err, handle);
      }
    } catch (err) {
      const payload = reportUserError(err);
      setError(`${payload.message} ${payload.fixHint}`);
    }
  }, [activateFromHandle, flushBeforeSwitch, handleOpenFailure]);

  const repairAndOpen = useCallback(async () => {
    if (openIssue?.kind !== "repair" || repairing) return;
    const { handle } = openIssue;
    setRepairing(true);
    setError(null);
    try {
      flushBeforeSwitch?.();
      await repairVault(handle);
      setOpenIssue(null);
      await activateFromHandle(handle);
    } catch (err) {
      await handleOpenFailure(err, handle);
    } finally {
      setRepairing(false);
    }
  }, [activateFromHandle, flushBeforeSwitch, handleOpenFailure, openIssue, repairing]);

  const dismissOpenIssue = useCallback(() => {
    setOpenIssue(null);
  }, []);

  const chooseAnotherFolder = useCallback(() => {
    setOpenIssue(null);
    void handlePick();
  }, [handlePick]);

  useEffect(() => {
    if (!session) setCurrent(null);
  }, [session]);

  // Mapping the summaries is cheap, but returning a fresh array on every render
  // turns every consumer's `useMemo([noteItems])` into a permanent miss — e.g.
  // `buildSpaceListItems` would walk every note × space on each keystroke.
  const noteItems = useMemo(() => toNoteListItems(summaries), [summaries]);

  return {
    session,
    noteItems,
    current,
    setCurrent,
    error,
    setError,
    openIssue,
    repairing,
    booting,
    handlePick,
    repairAndOpen,
    dismissOpenIssue,
    chooseAnotherFolder,
    refreshSummaries,
  };
}
