import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

const profile = { id: "user-1", email: "staff@example.com", display_name: "Staff", role: "staff", active: true, created_at: "" };
const session = { user: { id: "user-1" } } as Session;
const getCurrentProfile = vi.fn();
let emit: (event: AuthChangeEvent, session: Session | null) => void = () => {};

vi.mock("../lib/repository", () => ({ getCurrentProfile: () => getCurrentProfile() }));
vi.mock("../lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session } }),
      onAuthStateChange: (handler: typeof emit) => {
        emit = handler;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: () => Promise.resolve(),
    },
  },
}));

const { AuthProvider, useAuth } = await import("./AuthContext");

function Probe() {
  const { profile: current, loading } = useAuth();
  return <span>{loading && !current ? "gated" : current?.display_name || "none"}</span>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    getCurrentProfile.mockReset();
    getCurrentProfile.mockResolvedValue(profile);
  });

  it("does not clear the profile when a token refresh re-emits the same user", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("Staff");

    // A profile refetch during token rotation can come back empty; clearing the
    // profile would gate the router and unmount the editor mid-edit.
    getCurrentProfile.mockResolvedValue(null);
    emit("TOKEN_REFRESHED", { ...session } as Session);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText("Staff")).toBeInTheDocument();
    expect(getCurrentProfile).toHaveBeenCalledTimes(1);
  });

  it("loads the profile when a different user signs in", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("Staff");

    getCurrentProfile.mockResolvedValue({ ...profile, id: "user-2", display_name: "Other" });
    emit("SIGNED_IN", { user: { id: "user-2" } } as Session);

    await screen.findByText("Other");
  });
});
