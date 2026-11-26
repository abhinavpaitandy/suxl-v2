/**
 * Shared experiment-creation draft store.
 *
 * Uses React Context so the draft survives navigation between the wizard
 * steps (Setup → Variants → Targets → Simulation). No external state
 * library — just Context + useReducer.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";

import { DEMO_VARIANTS, demoScreenshotMatchesUrl } from "./demo-variants";
import { isCompletedDemo, saveCompletedExample, SAVED_EXAMPLE_KEY } from "./saved-example";

import type {
  ExperimentDraft,
  DraftVariant,
  DetectedTarget,
  BoundingBox,
  DeviceType,
  PilotSize,
  BehaviourDiversity,
  TargetStatus,
} from "./types";

// ─── State ────────────────────────────────────────────────────────

const DEFAULT_DRAFT: ExperimentDraft = {
  name: "PDP page comparison with comparable product detail",
  persona:
    "Fashion Aspirer: a highly fashion-engaged shopper who cares about personal style and trends, finds inspiration in everyday life and culture, and shops across brands and channels. They engage directly with fashion brands through social media and websites, and look for inspiring, creative fashion that fits their style. Based on the 2023 US Fashion Aspirer survey; adapt for the market and experiment.",
  task: "Find and add the T-shirt to the shopping bag.",
  successEvent: "Select the Add to bag or Add button.",
  device: "mobile",
  variants: DEMO_VARIANTS.map((variant) => ({ ...variant })),
  pilotSize: 500,
  behaviourDiversity: "medium",
};

// ─── Actions ──────────────────────────────────────────────────────

type DraftAction =
  | { type: "RESTORE"; draft: ExperimentDraft }
  | {
      type: "UPDATE_DETAILS";
      patch: Partial<
        Pick<
          ExperimentDraft,
          "name" | "persona" | "task" | "successEvent" | "hypothesis" | "device"
        >
      >;
    }
  | { type: "SET_VARIANTS"; variants: DraftVariant[] }
  | { type: "UPDATE_VARIANT"; variantId: string; patch: Partial<DraftVariant> }
  | { type: "ADD_VARIANT" }
  | { type: "REMOVE_VARIANT"; variantId: string }
  | { type: "SET_PILOT_RUNS"; runs: NonNullable<ExperimentDraft["pilotRuns"]> }
  | { type: "CLEAR_ANALYSIS_RESULTS" }
  | { type: "SET_SIMULATED_CLICKS"; clicks: NonNullable<ExperimentDraft["simulatedClicks"]> }
  | { type: "SET_VISUAL_OBSERVATIONS"; observations: Array<{ title: string; detail: string }> }
  | { type: "SET_DETECTED_TARGET"; variantId: string; target: DetectedTarget }
  | { type: "SET_TARGET_STATUS"; variantId: string; status: TargetStatus }
  | { type: "ADJUST_TARGET_BOX"; variantId: string; boundingBox: BoundingBox }
  | { type: "SET_PILOT_SIZE"; size: PilotSize }
  | { type: "SET_BEHAVIOUR_DIVERSITY"; diversity: BehaviourDiversity }
  | { type: "SET_DEVICE"; device: DeviceType }
  | { type: "RESET" };

// ─── Reducer ──────────────────────────────────────────────────────

const VARIANT_NAMES = ["Variant A", "Variant B", "Variant C"];

function withoutVisualObservations(state: ExperimentDraft): ExperimentDraft {
  const next = { ...state };
  delete next.visualObservations;
  delete next.simulatedClicks;
  delete next.pilotRuns;
  return next;
}

function reducer(state: ExperimentDraft, action: DraftAction): ExperimentDraft {
  switch (action.type) {
    case "RESTORE":
      return action.draft;
    case "UPDATE_DETAILS":
      return { ...withoutVisualObservations(state), ...action.patch };

    case "SET_VARIANTS":
      return { ...withoutVisualObservations(state), variants: action.variants };

    case "UPDATE_VARIANT":
      return {
        ...withoutVisualObservations(state),
        variants: state.variants.map((v) =>
          v.id === action.variantId
            ? action.patch.pageUrl !== undefined &&
              !demoScreenshotMatchesUrl(v.screenshotUrl, action.patch.pageUrl)
              ? { ...v, ...action.patch, screenshotUrl: undefined, detectedTarget: undefined }
              : { ...v, ...action.patch }
            : v,
        ),
      };

    case "ADD_VARIANT": {
      if (state.variants.length >= 3) return state;
      const idx = state.variants.length;
      const id = ["v-a", "v-b", "v-c"][idx] ?? `v-${idx}`;
      return {
        ...withoutVisualObservations(state),
        variants: [
          ...state.variants,
          { id, name: VARIANT_NAMES[idx] ?? `Variant ${idx + 1}`, description: "" },
        ],
      };
    }

    case "REMOVE_VARIANT": {
      if (state.variants.length <= 2) return state;
      return {
        ...withoutVisualObservations(state),
        variants: state.variants
          .filter((v) => v.id !== action.variantId)
          .map((v, i) => ({ ...v, name: VARIANT_NAMES[i] ?? v.name })),
      };
    }

    case "SET_PILOT_RUNS":
      return { ...state, pilotRuns: action.runs };

    case "CLEAR_ANALYSIS_RESULTS":
      return withoutVisualObservations(state);

    case "SET_SIMULATED_CLICKS":
      return { ...state, simulatedClicks: action.clicks };

    case "SET_VISUAL_OBSERVATIONS":
      return { ...state, visualObservations: action.observations };

    case "SET_DETECTED_TARGET":
      return {
        ...state,
        variants: state.variants.map((v) =>
          v.id === action.variantId ? { ...v, detectedTarget: action.target } : v,
        ),
      };

    case "SET_TARGET_STATUS":
      return {
        ...state,
        variants: state.variants.map((v) =>
          v.id === action.variantId && v.detectedTarget
            ? { ...v, detectedTarget: { ...v.detectedTarget, status: action.status } }
            : v,
        ),
      };

    case "ADJUST_TARGET_BOX":
      return {
        ...state,
        variants: state.variants.map((v) =>
          v.id === action.variantId && v.detectedTarget
            ? {
                ...v,
                detectedTarget: {
                  ...v.detectedTarget,
                  boundingBox: action.boundingBox,
                  status: "adjusted",
                },
              }
            : v,
        ),
      };

    case "SET_PILOT_SIZE":
      return { ...state, pilotSize: action.size };

    case "SET_BEHAVIOUR_DIVERSITY":
      return { ...state, behaviourDiversity: action.diversity };

    case "SET_DEVICE":
      return { ...state, device: action.device };

    case "RESET":
      return { ...DEFAULT_DRAFT };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────

interface DraftContextValue {
  draft: ExperimentDraft;
  updateExperimentDetails: (
    patch: Partial<
      Pick<ExperimentDraft, "name" | "persona" | "task" | "successEvent" | "hypothesis" | "device">
    >,
  ) => void;
  setVariants: (variants: DraftVariant[]) => void;
  updateVariant: (variantId: string, patch: Partial<DraftVariant>) => void;
  addVariant: () => void;
  removeVariant: (variantId: string) => void;
  setPilotRuns: (runs: NonNullable<ExperimentDraft["pilotRuns"]>) => void;
  clearAnalysisResults: () => void;
  setSimulatedClicks: (clicks: NonNullable<ExperimentDraft["simulatedClicks"]>) => void;
  setVisualObservations: (observations: Array<{ title: string; detail: string }>) => void;
  setDetectedTarget: (variantId: string, target: DetectedTarget) => void;
  confirmTarget: (variantId: string) => void;
  adjustTarget: (variantId: string, boundingBox: BoundingBox) => void;
  setPilotSize: (size: PilotSize) => void;
  setBehaviourDiversity: (diversity: BehaviourDiversity) => void;
  setDevice: (device: DeviceType) => void;
  resetDraft: () => void;
}

const DraftContext = createContext<DraftContextValue | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, dispatch] = useReducer(reducer, DEFAULT_DRAFT);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("suxl-experiment-draft-v1");
      if (stored) {
        const value = JSON.parse(stored) as ExperimentDraft;
        if (typeof value.name === "string" && Array.isArray(value.variants)) {
          dispatch({ type: "RESTORE", draft: value });
          // Recover an existing completed tab when no shared example exists. An
          // older tab must not overwrite a newer shared pilot during restoration.
          if (!localStorage.getItem(SAVED_EXAMPLE_KEY) && isCompletedDemo(value)) saveCompletedExample(value);
        }
      }
    } catch { /* The draft remains usable if browser storage is unavailable. */ }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem("suxl-experiment-draft-v1", JSON.stringify(draft)); }
    catch { /* Large uploaded screenshots can exceed browser storage limits. */ }
  }, [draft, restored]);

  const updateExperimentDetails = useCallback(
    (
      patch: Partial<
        Pick<
          ExperimentDraft,
          "name" | "persona" | "task" | "successEvent" | "hypothesis" | "device"
        >
      >,
    ) => dispatch({ type: "UPDATE_DETAILS", patch }),
    [],
  );

  const setVariants = useCallback(
    (variants: DraftVariant[]) => dispatch({ type: "SET_VARIANTS", variants }),
    [],
  );

  const updateVariant = useCallback(
    (variantId: string, patch: Partial<DraftVariant>) =>
      dispatch({ type: "UPDATE_VARIANT", variantId, patch }),
    [],
  );

  const addVariant = useCallback(() => dispatch({ type: "ADD_VARIANT" }), []);
  const removeVariant = useCallback(
    (variantId: string) => dispatch({ type: "REMOVE_VARIANT", variantId }),
    [],
  );

  const setPilotRuns = useCallback(
    (runs: NonNullable<ExperimentDraft["pilotRuns"]>) => dispatch({ type: "SET_PILOT_RUNS", runs }),
    [],
  );
  const clearAnalysisResults = useCallback(() => dispatch({ type: "CLEAR_ANALYSIS_RESULTS" }), []);

  const setSimulatedClicks = useCallback(
    (clicks: NonNullable<ExperimentDraft["simulatedClicks"]>) =>
      dispatch({ type: "SET_SIMULATED_CLICKS", clicks }),
    [],
  );

  const setVisualObservations = useCallback(
    (observations: Array<{ title: string; detail: string }>) =>
      dispatch({ type: "SET_VISUAL_OBSERVATIONS", observations }),
    [],
  );

  const setDetectedTarget = useCallback(
    (variantId: string, target: DetectedTarget) =>
      dispatch({ type: "SET_DETECTED_TARGET", variantId, target }),
    [],
  );

  const confirmTarget = useCallback(
    (variantId: string) => dispatch({ type: "SET_TARGET_STATUS", variantId, status: "confirmed" }),
    [],
  );

  const adjustTarget = useCallback(
    (variantId: string, boundingBox: BoundingBox) =>
      dispatch({ type: "ADJUST_TARGET_BOX", variantId, boundingBox }),
    [],
  );

  const setPilotSize = useCallback(
    (size: PilotSize) => dispatch({ type: "SET_PILOT_SIZE", size }),
    [],
  );
  const setBehaviourDiversity = useCallback(
    (diversity: BehaviourDiversity) => dispatch({ type: "SET_BEHAVIOUR_DIVERSITY", diversity }),
    [],
  );
  const setDevice = useCallback(
    (device: DeviceType) => dispatch({ type: "SET_DEVICE", device }),
    [],
  );
  const resetDraft = useCallback(() => dispatch({ type: "RESET" }), []);

  const value = useMemo(
    () => ({
      draft,
      updateExperimentDetails,
      setVariants,
      updateVariant,
      addVariant,
      removeVariant,
      setVisualObservations,
      setSimulatedClicks,
      clearAnalysisResults,
      setPilotRuns,
      setDetectedTarget,
      confirmTarget,
      adjustTarget,
      setPilotSize,
      setBehaviourDiversity,
      setDevice,
      resetDraft,
    }),
    [
      draft,
      updateExperimentDetails,
      setVariants,
      updateVariant,
      addVariant,
      removeVariant,
      setVisualObservations,
      setSimulatedClicks,
      clearAnalysisResults,
      setPilotRuns,
      setDetectedTarget,
      confirmTarget,
      adjustTarget,
      setPilotSize,
      setBehaviourDiversity,
      setDevice,
      resetDraft,
    ],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftContextValue {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft must be used within a DraftProvider");
  return ctx;
}
