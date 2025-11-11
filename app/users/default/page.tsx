"use client";
import { useEffect, useState } from "react";

type User = { id: string; email?: string | null; name?: string | null; timezone?: string | null };

export default function DefaultUserPanel() {
  const [defaultUserId, setDefaultUserId] = useState<string>("...");
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [setId, setSetId] = useState("");
  const [status, setStatus] = useState<string>("");

  async function refreshDefault() {
    const res = await fetch("/api/users/default");
    const data = await res.json();
    setDefaultUserId(data.defaultUserId || "default");
  }

  useEffect(() => {
    refreshDefault();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Creating user...");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: createName, email: createEmail }),
    });
    const data = await res.json();
    if (data?.user) {
      setCreatedUser(data.user);
      setSetId(data.user.id);
      setStatus(`Created user ${data.user.id}`);
    } else {
      setStatus("Failed to create user");
    }
  }

  async function handleSetDefault(e: React.FormEvent) {
    e.preventDefault();
    if (!setId.trim()) return;
    setStatus("Setting default user...");
    const res = await fetch("/api/users/default", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: setId.trim() }),
    });
    const data = await res.json();
    if (data?.success) {
      setStatus("Default user updated");
      refreshDefault();
    } else {
      setStatus("Failed to set default user");
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1>Default User</h1>
      <p>Current default: <code>{defaultUserId}</code></p>

      <form onSubmit={handleSetDefault} style={{ margin: "12px 0", display: "flex", gap: 8 }}>
        <input
          placeholder="User ID to set as default"
          value={setId}
          onChange={(e) => setSetId(e.target.value)}
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" style={{ padding: "8px 12px" }}>Set Default</button>
      </form>

      <hr style={{ margin: "16px 0" }} />
      <h2>Create User</h2>
      <form onSubmit={handleCreate} style={{ display: "grid", gap: 8 }}>
        <input
          placeholder="Name"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          style={{ padding: 8 }}
        />
        <input
          placeholder="Email"
          value={createEmail}
          onChange={(e) => setCreateEmail(e.target.value)}
          style={{ padding: 8 }}
        />
        <button type="submit" style={{ padding: "8px 12px", width: 200 }}>Create</button>
      </form>

      {createdUser && (
        <div style={{ marginTop: 16 }}>
          <strong>New user:</strong>
          <div><code>{createdUser.id}</code></div>
          <button onClick={() => setSetId(createdUser.id)} style={{ marginTop: 8, padding: "6px 10px" }}>
            Use this ID above
          </button>
        </div>
      )}

      {status && <p style={{ marginTop: 16 }}>{status}</p>}
    </div>
  );
}

