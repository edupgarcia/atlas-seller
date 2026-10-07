import { useEffect, useState } from "react";
import { getStoredSeller, type Seller } from "@/lib/auth";

export function useSeller() {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setSeller(getStoredSeller());
    setReady(true);
    const on = () => setSeller(getStoredSeller());
    window.addEventListener("atlas-auth-change", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("atlas-auth-change", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return { seller, ready };
}
