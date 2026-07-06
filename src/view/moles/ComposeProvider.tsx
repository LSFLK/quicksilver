import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Snackbar } from "@mui/material";
import type { ComposeInitial } from "./ComposePanel";

// Compose pulls in react-email; keep it out of the main bundle and only load it
// once the user actually opens the composer.
const ComposeDialog = lazy(() => import("./ComposeDialog"));

interface ComposeContextValue {
  /** Open the shared compose popup, optionally prefilled. */
  openCompose: (initial?: ComposeInitial) => void;
}

const ComposeContext = createContext<ComposeContextValue | null>(null);

export const useCompose = (): ComposeContextValue => {
  const ctx = useContext(ComposeContext);
  if (!ctx) {
    throw new Error("useCompose must be used within a ComposeProvider");
  }
  return ctx;
};

// Renders a single app-level compose dialog so the Compose button (or anything
// else) can open the full composer as a popup from any page, mirroring the
// reply popup inside a thread.
export const ComposeProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<ComposeInitial | undefined>(undefined);
  const [sentToast, setSentToast] = useState(false);

  const openCompose = useCallback((init?: ComposeInitial) => {
    setInitial(init);
    setOpen(true);
  }, []);

  return (
    <ComposeContext.Provider value={{ openCompose }}>
      {children}
      {open && (
        <Suspense fallback={null}>
          <ComposeDialog
            open
            initial={initial}
            title="New Message"
            onClose={() => setOpen(false)}
            onSent={() => {
              setOpen(false);
              setSentToast(true);
            }}
          />
        </Suspense>
      )}
      <Snackbar
        open={sentToast}
        autoHideDuration={4000}
        onClose={() => setSentToast(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message="Message sent"
      />
    </ComposeContext.Provider>
  );
};
