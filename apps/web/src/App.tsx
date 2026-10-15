import { useEffect, useState } from "react";

type ApiHealth = "checking" | "ok" | "unreachable";

const HEALTH_POLL_MS = 3000;

export function App() {
  const [health, setHealth] = useState<ApiHealth>("checking");

  useEffect(() => {
    const controller = new AbortController();

    const check = () =>
      fetch("/api/health", { signal: controller.signal })
        .then((response) => (response.ok ? "ok" : "unreachable"))
        .catch(() => "unreachable" as const)
        .then((result) => {
          if (!controller.signal.aborted) setHealth(result);
        });

    check();
    const interval = setInterval(check, HEALTH_POLL_MS);

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  return (
    <main>
      <h1>Rep Counter</h1>
      <p>API: {health}</p>
    </main>
  );
}
