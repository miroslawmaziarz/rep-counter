import { useEffect, useState } from "react";

type ApiHealth = "checking" | "ok" | "unreachable";

export function App() {
  const [health, setHealth] = useState<ApiHealth>("checking");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/health", { signal: controller.signal })
      .then((response) => (response.ok ? "ok" : "unreachable"))
      .catch(() => "unreachable" as const)
      .then((result) => {
        if (!controller.signal.aborted) setHealth(result);
      });

    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>Rep Counter</h1>
      <p>API: {health}</p>
    </main>
  );
}
