"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getUser, updateUser, changePassword, getStoreInfo } from "@/lib/api";
import {
  updateStoreSettings,
  getNotifications,
  markNotificationRead,
  deliverNotifications,
  getAutomationRules,
  createAutomationRule,
  toggleAutomationRule,
  deleteAutomationRule,
  runAutomationRule,
  getAutomationRuns,
  AutomationRule,
  NotificationItem,
  AutomationRun,
} from "@/lib/api";

interface UserProfile {
  id: number;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

interface StoreSettings {
  shop_domain: string;
  connected: boolean;
  notification_email: string | null;
  notification_webhook_url: string | null;
  low_stock_threshold: number | null;
  created_at: string;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  auto_fulfill: "Auto Fulfill",
  repricing: "AI Repricing",
  low_stock: "Low Stock Alerts",
};

type Tab = "profile" | "store" | "notifications" | "automation";

export default function SettingsPage() {
  const { token, shop, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [storeInfo, setStoreInfo] = useState<StoreSettings | null>(null);
  const [notifEmail, setNotifEmail] = useState("");
  const [notifWebhook, setNotifWebhook] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);

  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState("auto_fulfill");
  const [ruleConfig, setRuleConfig] = useState("");

  const loadData = useCallback(async () => {
    if (!token) return;
    setError("");
    try {
      const me = (await getUser(token)) as UserProfile;
      setProfile(me);
      setFullName(me.full_name);
      setEmail(me.email);

      if (shop) {
        const info = (await getStoreInfo(token, shop)) as StoreSettings;
        setStoreInfo(info);
        setNotifEmail(info.notification_email || "");
        setNotifWebhook(info.notification_webhook_url || "");
        setLowStockThreshold(info.low_stock_threshold ?? 5);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [token, shop]);

  const loadNotifications = useCallback(async () => {
    if (!token || !shop) return;
    try {
      const data = (await getNotifications(token, shop)) as NotificationItem[];
      setNotifications(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    }
  }, [token, shop]);

  const loadAutomation = useCallback(async () => {
    if (!token || !shop) return;
    try {
      const ruleData = (await getAutomationRules(token, shop)) as AutomationRule[];
      setRules(ruleData);
      const runData = (await getAutomationRuns(token, shop)) as AutomationRun[];
      setRuns(runData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load automation");
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

  useEffect(() => {
    if (tab === "notifications") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on tab change
      loadNotifications();
    }
  }, [tab, loadNotifications]);

  useEffect(() => {
    if (tab === "automation") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on tab change
      loadAutomation();
    }
  }, [tab, loadAutomation]);

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

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !shop) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const info = (await updateStoreSettings(token, shop, {
        notification_email: notifEmail,
        notification_webhook_url: notifWebhook,
        low_stock_threshold: lowStockThreshold,
      })) as StoreSettings;
      setStoreInfo(info);
      setSuccess("Store settings saved");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDeliverNotifications = async () => {
    if (!token || !shop) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = (await deliverNotifications(token, shop)) as {
        count: number;
      };
      setSuccess(`Delivered ${result.count} notification(s)`);
      await loadNotifications();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to deliver");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !shop) return;
    setSaving(true);
    setError("");
    setSuccess("");
    let config: Record<string, unknown> = {};
    if (ruleConfig.trim()) {
      try {
        config = JSON.parse(ruleConfig);
      } catch {
        setError("Config must be valid JSON");
        setSaving(false);
        return;
      }
    }
    try {
      await createAutomationRule(token, shop, {
        name: ruleName,
        rule_type: ruleType,
        config,
      });
      setRuleName("");
      setRuleConfig("");
      setSuccess("Rule created");
      await loadAutomation();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRule = async (rule: AutomationRule) => {
    if (!token || !shop) return;
    try {
      await toggleAutomationRule(token, shop, rule.id);
      await loadAutomation();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to toggle rule");
    }
  };

  const handleRunRule = async (rule: AutomationRule) => {
    if (!token || !shop) return;
    setError("");
    setSuccess("");
    try {
      const result = (await runAutomationRule(token, shop, rule.id)) as {
        status: string;
        count: number;
        summary: string | null;
      };
      setSuccess(
        `Rule ran: ${result.status}${result.count ? ` (${result.count})` : ""}${
          result.summary ? ` - ${result.summary}` : ""
        }`
      );
      await loadAutomation();
      await loadNotifications();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to run rule");
    }
  };

  const handleDeleteRule = async (rule: AutomationRule) => {
    if (!token || !shop) return;
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      await deleteAutomationRule(token, shop, rule.id);
      setSuccess("Rule deleted");
      await loadAutomation();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete rule");
    }
  };

  const handleMarkRead = async (notification: NotificationItem) => {
    if (!token || !shop) return;
    try {
      await markNotificationRead(token, shop, notification.id);
      await loadNotifications();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  if (!token) return null;

  const tabButton = (key: Tab, label: string, disabled = false) => (
    <button
      onClick={() => setTab(key)}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
        tab === key
          ? "bg-blue-600 text-white"
          : "bg-gray-800 text-gray-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

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

      <main className="max-w-4xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-2xl font-semibold">Settings</h2>
          <div className="flex gap-2 flex-wrap">
            {tabButton("profile", "Profile")}
            {tabButton("store", "Store", !shop)}
            {tabButton("notifications", "Notifications", !shop)}
            {tabButton("automation", "Automation", !shop)}
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
        ) : (
          <>
            {tab === "profile" && (
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
            )}

            {tab === "store" && (
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

                    <form
                      onSubmit={handleSaveStoreSettings}
                      className="pt-4 border-t border-gray-800 space-y-4"
                    >
                      <h4 className="text-sm font-medium text-gray-300">
                        Notification Channels & Alerts
                      </h4>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Notification Email
                        </label>
                        <input
                          type="email"
                          value={notifEmail}
                          onChange={(e) => setNotifEmail(e.target.value)}
                          placeholder="owner@example.com"
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Notification Webhook URL
                        </label>
                        <input
                          type="url"
                          value={notifWebhook}
                          onChange={(e) => setNotifWebhook(e.target.value)}
                          placeholder="https://hooks.example.com/endpoint"
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Low Stock Threshold
                        </label>
                        <input
                          type="number"
                          value={lowStockThreshold}
                          onChange={(e) =>
                            setLowStockThreshold(Number(e.target.value))
                          }
                          min={1}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
                      >
                        {saving ? "Saving..." : "Save Store Settings"}
                      </button>
                    </form>
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

            {tab === "notifications" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Notifications</h3>
                  <button
                    onClick={handleDeliverNotifications}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
                  >
                    {saving ? "Sending..." : "Deliver Now"}
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">
                    No notifications yet. Orders, fulfillments, and low-stock
                    alerts will appear here.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {notifications.map((n) => (
                      <li
                        key={n.id}
                        className={`bg-gray-900 border rounded-lg p-4 ${
                          n.is_read ? "border-gray-800" : "border-blue-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 text-xs rounded ${
                                  n.severity === "warning"
                                    ? "bg-yellow-900/50 text-yellow-400"
                                    : n.severity === "critical"
                                    ? "bg-red-900/50 text-red-400"
                                    : "bg-gray-800 text-gray-300"
                                }`}
                              >
                                {n.severity}
                              </span>
                              <span className="text-xs text-gray-500">
                                {n.type}
                              </span>
                            </div>
                            <p className="mt-1 font-medium">{n.title}</p>
                            <p className="text-sm text-gray-400">{n.message}</p>
                            <p className="mt-1 text-xs text-gray-600">
                              {new Date(n.created_at).toLocaleString()}
                            </p>
                          </div>
                          {!n.is_read && (
                            <button
                              onClick={() => handleMarkRead(n)}
                              className="shrink-0 px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === "automation" && (
              <div className="space-y-6">
                <form
                  onSubmit={handleCreateRule}
                  className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4"
                >
                  <h3 className="text-lg font-medium">New Automation Rule</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={ruleName}
                        onChange={(e) => setRuleName(e.target.value)}
                        required
                        placeholder="Fulfill paid orders"
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Type
                      </label>
                      <select
                        value={ruleType}
                        onChange={(e) => setRuleType(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                      >
                        {Object.entries(RULE_TYPE_LABELS).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Config (JSON)
                    </label>
                    <input
                      type="text"
                      value={ruleConfig}
                      onChange={(e) => setRuleConfig(e.target.value)}
                      placeholder='{"margin_pct": 100} or {"threshold": 5} or {"notify_customer": true}'
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      auto_fulfill: notify_customer • repricing: margin_pct,
                      use_ai • low_stock: threshold
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
                  >
                    {saving ? "Creating..." : "Create Rule"}
                  </button>
                </form>

                <div>
                  <h3 className="text-lg font-medium mb-3">Active Rules</h3>
                  {rules.length === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">
                      No rules yet. Create one above to start automating.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {rules.map((rule) => (
                        <li
                          key={rule.id}
                          className="bg-gray-900 border border-gray-800 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{rule.name}</p>
                                <span className="px-2 py-0.5 text-xs rounded bg-blue-900/50 text-blue-300">
                                  {RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}
                                </span>
                                <span
                                  className={`px-2 py-0.5 text-xs rounded ${
                                    rule.enabled
                                      ? "bg-green-900/50 text-green-400"
                                      : "bg-gray-800 text-gray-400"
                                  }`}
                                >
                                  {rule.enabled ? "Enabled" : "Disabled"}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1 font-mono">
                                {JSON.stringify(rule.config)}
                              </p>
                              {rule.last_run_at && (
                                <p className="text-xs text-gray-600 mt-1">
                                  Last run:{" "}
                                  {new Date(rule.last_run_at).toLocaleString()}{" "}
                                  - {rule.last_status}
                                  {rule.last_count !== null
                                    ? ` (${rule.last_count})`
                                    : ""}
                                  {rule.last_error
                                    ? ` - ${rule.last_error}`
                                    : ""}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => handleRunRule(rule)}
                                className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded-lg transition"
                              >
                                Run now
                              </button>
                              <button
                                onClick={() => handleToggleRule(rule)}
                                className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                              >
                                {rule.enabled ? "Disable" : "Enable"}
                              </button>
                              <button
                                onClick={() => handleDeleteRule(rule)}
                                className="px-3 py-1 text-xs bg-red-900/50 hover:bg-red-900 text-red-300 rounded-lg transition"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-3">Recent Runs</h3>
                  {runs.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">
                      No runs recorded yet.
                    </p>
                  ) : (
                    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-400 border-b border-gray-800">
                            <th className="px-4 py-2">Rule</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Summary</th>
                            <th className="px-4 py-2">When</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runs.map((run) => {
                            const rule = rules.find(
                              (r) => r.id === Number(run.rule_id)
                            );
                            return (
                              <tr
                                key={run.id}
                                className="border-b border-gray-800/50"
                              >
                                <td className="px-4 py-2">
                                  {rule?.name || `Rule #${run.rule_id}`}
                                </td>
                                <td className="px-4 py-2">
                                  <span
                                    className={`px-2 py-0.5 text-xs rounded ${
                                      run.status === "success"
                                        ? "bg-green-900/50 text-green-400"
                                        : run.status === "error"
                                        ? "bg-red-900/50 text-red-400"
                                        : "bg-yellow-900/50 text-yellow-400"
                                    }`}
                                  >
                                    {run.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-gray-400">
                                  {run.summary}
                                  {run.error ? ` (${run.error})` : ""}
                                </td>
                                <td className="px-4 py-2 text-gray-500">
                                  {new Date(run.ran_at).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}