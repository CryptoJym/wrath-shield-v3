"use client";

import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#05060a" }}>
      <SignUp appearance={{ elements: { formButtonPrimary: "bg-emerald-600 hover:bg-emerald-500" } }} />
    </div>
  );
}
