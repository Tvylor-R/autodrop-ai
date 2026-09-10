"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getUser, updateUser, changePassword, getStoreInfo } from "@/lib/api";

interface UserProfile {
  id: number;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export default function SettingsPage() {
  const { token, shop, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"profile" | "store">("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [storeInfo, setStoreInfo] = useState<{
    shop_domain: string;
    connected: boolean;
    created_at: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setError("");
    try {
      const me = (await getUser(token)) as UserProfile;
      setProfile(me);
      setFullName(me.full_name);
      setEmail(me.email);

      if (shop) {
        const info = (await getStoreInfo(token, shop)) as typeof storeInfo;
        setStoreInfo(info);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [token, shop]);

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    loadData();
  }, [token, router, loadData]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = (await updateUser(token, {
        full_name: fullName,
        email,
      })) as UserProfile;
      setProfile(updated);
      setFullName(updated.full_name);
      setEmail(updated.email);
      setSuccess("Profile updated");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await changePassword(token, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setSuccess("Password updated");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterWebhooks = async () => {
    if (!token || !shop || !storeInfo) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const webhookUrl = `${window.location.origin.replace(
        ":3000",
        ":8000"
      )}/webhooks/shopify`;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/store/webhooks/register?shop=${encodeURIComponent(
          shop
        )}&webhook_url=${encodeURIComponent(webhookUrl)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to register webhooks");
      }
      const data = await res.json();
      setSuccess(
        `${data.total} webhooks registered: ${data.registered.join(", ")}`
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to register webhooks"
      );
    } finally {
      setSaving(false);
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          Auto<span className="text-blue-500">Drop</span> AI
        </h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-gray-400 hover:text-white text-sm transition"
          >
            Dashboard
          </button>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-white text-sm transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Settings</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("profile")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === "profile"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setTab("store")}
              disabled={!shop}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                tab === "store"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              Store
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900/50 border border-green-700 text-green-300 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : tab === "profile" ? (
          <div className="space-y-6">
            <form
              onSubmit={handleSaveProfile}
              className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4"
            >
              <h3 className="text-lg font-medium">Profile</h3>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </form>

            <form
              onSubmit={handleChangePassword}
              className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4"
            >
              <h3 className="text-lg font-medium">Change Password</h3>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
              >
                {saving ? "Updating..." : "Change Password"}
              </button>
            </form>

            {profile && (
              <p className="text-xs text-gray-500">
                Member since{" "}
                {new Date(profile.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-medium">Store</h3>
            {storeInfo ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Shop Domain</p>
                    <p className="font-medium">{storeInfo.shop_domain}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Connection</p>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        storeInfo.connected
                          ? "bg-green-900/50 text-green-400"
                          : "bg-red-900/50 text-red-400"
                      }`}
                    >
                      {storeInfo.connected ? "Connected" : "Not Connected"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Connected Since</p>
                  <p className="font-medium">
                    {new Date(storeInfo.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-800">
                  <p className="text-sm text-gray-400 mb-3">
                    Webhooks deliver real-time order, product, and inventory
                    updates from Shopify.
                  </p>
                  <button
                    onClick={handleRegisterWebhooks}
                    disabled={saving || !storeInfo.connected}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
                  >
                    {saving ? "Registering..." : "Re-register Webhooks"}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400">
                No store connected.{" "}
                <button
                  onClick={() => router.push("/dashboard/connect")}
                  className="text-blue-400 hover:text-blue-300 transition"
                >
                  Connect a Shopify store
                </button>
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}