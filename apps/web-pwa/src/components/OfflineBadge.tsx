import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";

export function OfflineBadge() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/15 px-2 py-0.5 font-mono text-[10px] uppercase text-warning">
      <CloudOff className="h-3 w-3" /> Hors ligne — projets locaux
    </span>
  );
}
