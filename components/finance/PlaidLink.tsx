"use client";

import { useCallback, useState } from "react";

type PlaidLinkProps = {
  onSuccess?: () => void;
  onExit?: () => void;
};

export function PlaidLink({ onSuccess, onExit }: PlaidLinkProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializePlaidLink = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get link token from API
      const tokenResponse = await fetch("/api/finance/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to create link token");
      }

      const { link_token } = await tokenResponse.json();

      // Load Plaid Link script dynamically if not already loaded
      if (!(window as any).Plaid) {
        const script = document.createElement("script");
        script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
        script.async = true;
        document.body.appendChild(script);

        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      // Initialize Plaid Link
      const handler = (window as any).Plaid.create({
        token: link_token,
        onSuccess: async (public_token: string, metadata: any) => {
          console.log("Plaid Link success:", metadata);

          try {
            // Exchange public token for access token
            const exchangeResponse = await fetch("/api/finance/plaid/exchange", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ public_token }),
            });

            if (!exchangeResponse.ok) {
              throw new Error("Failed to exchange token");
            }

            // Trigger transaction sync
            const syncResponse = await fetch("/api/finance/plaid/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });

            if (!syncResponse.ok) {
              throw new Error("Failed to sync transactions");
            }

            const syncData = await syncResponse.json();
            console.log("Sync complete:", syncData);

            onSuccess?.();
          } catch (err) {
            console.error("Error after Plaid success:", err);
            setError(err instanceof Error ? err.message : "Failed to complete setup");
          }
        },
        onExit: (err: any, metadata: any) => {
          console.log("Plaid Link exited:", err, metadata);
          onExit?.();
        },
      });

      handler.open();
    } catch (err) {
      console.error("Error initializing Plaid Link:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize Plaid Link");
    } finally {
      setLoading(false);
    }
  }, [onSuccess, onExit]);

  return (
    <div className="space-y-2">
      <button
        onClick={initializePlaidLink}
        disabled={loading}
        className="px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        {loading ? "Loading..." : "Connect Bank Account"}
      </button>
      {error && (
        <p className="text-xs text-red-400">
          Error: {error}
        </p>
      )}
      <p className="text-xs text-slate-500">
        Connect your bank account securely via Plaid to automatically sync transactions.
      </p>
    </div>
  );
}
