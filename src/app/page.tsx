"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Boxes, Check, ChevronRight,
  CircleDollarSign, Clock3, Command, LayoutDashboard, LogOut, Mail, PackageCheck,
  RefreshCw, Search, ShieldCheck, ShoppingBag, Users, X, ExternalLink, Eye, FileText, ChevronLeft, Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import { api, money } from "@/lib/api";
import type { ContactSubmission, DashboardStats, Order, Software, User } from "@/lib/types";
import { PdfPreview } from "./PdfPreview";
import { ProjectArchiveTree } from "./ProjectArchiveTree";

type Tab = "overview" | "software" | "users" | "orders" | "inquiries";

export default function AdminPage() {
  const [admin, setAdmin] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"identifier" | "otp">("identifier");
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [software, setSoftware] = useState<Software[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inquiries, setInquiries] = useState<ContactSubmission[]>([]);
  const [search, setSearch] = useState("");
  const [selectedListing, setSelectedListing] = useState<Software | null>(null);
  const [updatingInquiryId, setUpdatingInquiryId] = useState<string | null>(null);
  const [updatingUserRoleId, setUpdatingUserRoleId] = useState<string | null>(null);
  const [updatingPayoutId, setUpdatingPayoutId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("marketplace-admin");
      if (saved) {
        const parsed = JSON.parse(saved) as User;
        if (parsed.role === "admin") setAdmin(parsed);
      }
    } catch {
      localStorage.removeItem("marketplace-admin");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboard, allSoftware, allUsers, allOrders, allInquiries] = await Promise.all([
        api<DashboardStats>("/api/admin/dashboard"),
        api<Software[]>("/api/admin/software"),
        api<User[]>("/api/admin/users"),
        api<Order[]>("/api/admin/orders"),
        api<ContactSubmission[]>("/api/admin/contact-submissions"),
      ]);
      setStats(dashboard);
      setSoftware(allSoftware);
      setUsers(allUsers);
      setOrders(allOrders);
      setInquiries(allInquiries);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not load admin data.");
      if (cause instanceof Error && /unauthorized|authenticated|access denied/i.test(cause.message)) {
        localStorage.removeItem("marketplace-admin");
        setAdmin(null);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (admin) void loadDashboard(); }, [admin, loadDashboard]);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      await api<null>("/api/auth/login/request-otp", { method: "POST", body: JSON.stringify({ identifier }) });
      setStep("otp");
      setOtp("");
      setResendSeconds(30);
      toast.success(`A code has been sent to ${identifier}.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not send a sign-in code.");
    } finally { setBusy(false); }
  }

  async function resendCode() {
    if (busy || resendSeconds > 0) return;
    setBusy(true);
    try {
      await api<null>("/api/auth/login/request-otp", { method: "POST", body: JSON.stringify({ identifier }) });
      setOtp("");
      setResendSeconds(30);
      toast.success(`A new code has been sent to ${identifier}.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not resend the sign-in code.");
      if (cause instanceof Error) {
        const seconds = cause.message.match(/wait (\d+) seconds/i);
        if (seconds) setResendSeconds(Number(seconds[1]));
      }
    } finally { setBusy(false); }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await api<{ user: User }>("/api/auth/login/verify-otp", {
        method: "POST", body: JSON.stringify({ identifier, otp }),
      });
      if (result.user.role !== "admin") {
        await api<null>("/api/auth/logout", { method: "POST" });
        toast.error("This account does not have administrator access.");
        return;
      }
      localStorage.setItem("marketplace-admin", JSON.stringify(result.user));
      setAdmin(result.user);
      toast.success(`Welcome, ${result.user.name}.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not verify the sign-in code.");
    } finally { setBusy(false); }
  }

  async function signOut() {
    try {
      await api<null>("/api/auth/logout", { method: "POST" });
      toast.success("You’ve signed out.");
    } catch {
      toast.warning("Signed out on this device, but the server could not clear the session.");
    }
    localStorage.removeItem("marketplace-admin");
    setAdmin(null);
    setStep("identifier");
    setOtp("");
  }

  async function moderate(id: string, action: "approve" | "reject"): Promise<boolean> {
    try {
      await api<Software>(`/api/admin/software/${id}/${action}`, { method: "PATCH" });
      toast.success(`Listing ${action === "approve" ? "approved" : "rejected"}.`);
      await loadDashboard();
      return true;
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update listing.");
      return false;
    }
  }

  async function updateInquiryStatus(inquiry: ContactSubmission, status: ContactSubmission["status"]) {
    setUpdatingInquiryId(inquiry._id);
    try {
      const updated = await api<ContactSubmission>(`/api/admin/contact-submissions/${inquiry._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setInquiries((current) => current.map((item) => item._id === updated._id ? updated : item));
      toast.success("Inquiry status updated.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update inquiry status.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function deleteInquiry(inquiry: ContactSubmission) {
    if (!window.confirm(`Delete the inquiry from ${inquiry.name}? This cannot be undone.`)) return;
    setUpdatingInquiryId(inquiry._id);
    try {
      await api<{ id: string }>(`/api/admin/contact-submissions/${inquiry._id}`, { method: "DELETE" });
      setInquiries((current) => current.filter((item) => item._id !== inquiry._id));
      toast.success("Inquiry deleted.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not delete inquiry.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function updateUserRole(user: User, role: "buyer" | "creator") {
    if (user.role === role) return;
    setUpdatingUserRoleId(user._id);
    try {
      const updated = await api<User>(`/api/admin/users/${user._id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setUsers((current) => current.map((item) => item._id === updated._id ? { ...item, ...updated } : item));
      toast.success(`${user.name} is now a ${role}.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update member role.");
    } finally {
      setUpdatingUserRoleId(null);
    }
  }

  async function recordCreatorPayout(orderId: string, reference: string) {
    setUpdatingPayoutId(orderId);
    try {
      const payout = await api<Pick<Order, "creatorPayoutStatus" | "creatorPayoutReference" | "creatorPayoutAt">>(
        `/api/admin/orders/${orderId}/payout`,
        { method: "PATCH", body: JSON.stringify({ reference }) },
      );
      setOrders((current) => current.map((order) => order._id === orderId ? { ...order, ...payout } : order));
      toast.success("Creator payout recorded.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not record the creator payout.");
    } finally {
      setUpdatingPayoutId(null);
    }
  }

  if (!hydrated) return <div className="admin-loading"><span className="admin-spinner" />Loading administration...</div>;
  if (!admin) return (
    <main className="login-shell">
      <div className="login-decoration"><div className="login-circle circle-one" /><div className="login-circle circle-two" /><div className="login-sign"><Boxes size={28} /></div><span className="floating-note note-one">✳ thoughtful by design</span><span className="floating-note note-two">Built for the builders.</span></div>
      <section className="login-panel">
        <a className="admin-brand" href="http://localhost:3000"><span className="admin-logo"><Boxes size={19} /></span>craft<span>market</span></a>
        <div className="login-content">
          <div className="admin-kicker"><ShieldCheck size={14} /> ADMINISTRATOR ACCESS</div>
          <h1>{step === "otp" ? "One quick check." : "Welcome to your corner."}</h1>
          <p>{step === "otp" ? "Enter the six-digit code sent to your administrator inbox." : "Sign in to keep the marketplace thoughtful, safe, and running smoothly."}</p>
          {step === "identifier" ? <form onSubmit={requestCode}>
            <label>Admin email or mobile<input required value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="admin@example.com" autoComplete="username" /></label>
            <button className="admin-primary" disabled={busy}>{busy ? "Sending code..." : "Continue with email"} <ChevronRight size={16} /></button>
          </form> : <form onSubmit={verifyCode}>
            <label>Six-digit verification code<input required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" /></label>
            <button className="admin-primary" disabled={busy}>{busy ? "Verifying..." : "Verify and sign in"} <ChevronRight size={16} /></button>
            <div className="admin-resend-row"><span>{resendSeconds > 0 ? `Resend available in ${resendSeconds}s` : "Didn’t receive a code?"}<button type="button" disabled={busy || resendSeconds > 0} onClick={() => void resendCode()}>{busy ? "Sending..." : "Resend code"}</button></span><button type="button" className="admin-back" onClick={() => { setStep("identifier"); setResendSeconds(0); }}><Mail size={14} /> Use a different address</button></div>
          </form>}
          <div className="login-footnote"><ShieldCheck size={14} /> Admin access is restricted to assigned accounts.</div>
        </div>
        <div className="login-copyright">© {new Date().getFullYear()} Craftmarket · A little less noise, a little more good work.</div>
      </section>
    </main>
  );

  const filteredSoftware = software.filter((item) => `${item.title} ${typeof item.creator === "string" ? item.creator : item.creator?.name} ${item.status}`.toLowerCase().includes(search.toLowerCase()));
  const filteredUsers = users.filter((item) => `${item.name} ${item.email} ${item.role} ${item.paymentIds?.join(" ") || ""}`.toLowerCase().includes(search.toLowerCase()));
  const filteredOrders = orders.filter((item) => `${item._id} ${typeof item.buyer === "string" ? item.buyer : item.buyer?.name} ${item.status}`.toLowerCase().includes(search.toLowerCase()));
  const filteredInquiries = inquiries.filter((item) => `${item.name} ${item.email} ${item.phone} ${item.subject} ${item.query}`.toLowerCase().includes(search.toLowerCase()));
  const pendingCount = software.filter((item) => item.status === "pending").length;

  return (
    <main className="admin-app min-h-screen">
      <aside className="admin-sidebar">
        <a className="admin-brand sidebar-brand" href="#"><span className="admin-logo"><Boxes size={19} /></span>craft<span>market</span></a>
        <div className="workspace-label">WORKSPACE <span>ADMIN</span></div>
        <nav className="side-nav">
          <button className={tab === "overview" ? "side-link active" : "side-link"} onClick={() => { setTab("overview"); setSearch(""); }}><LayoutDashboard size={17} /> Overview</button>
          <button className={tab === "software" ? "side-link active" : "side-link"} onClick={() => { setTab("software"); setSearch(""); }}><PackageCheck size={17} /> Listings {pendingCount > 0 && <i>{pendingCount}</i>}</button>
          <button className={tab === "users" ? "side-link active" : "side-link"} onClick={() => { setTab("users"); setSearch(""); }}><Users size={17} /> Members</button>
          <button className={tab === "orders" ? "side-link active" : "side-link"} onClick={() => { setTab("orders"); setSearch(""); }}><ShoppingBag size={17} /> Orders</button>
          <button className={tab === "inquiries" ? "side-link active" : "side-link"} onClick={() => { setTab("inquiries"); setSearch(""); }}><Mail size={17} /> Inquiries {inquiries.length > 0 && <i>{inquiries.length}</i>}</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="system-card"><span><Activity size={15} /> MARKETPLACE</span><b><i /> Online</b><small>Marketplace systems look good.</small></div>
          <div className="admin-profile"><div className="profile-avatar">{admin.name.slice(0, 1).toUpperCase()}</div><div><b>{admin.name}</b><small>Administrator</small></div><button title="Sign out" onClick={() => void signOut()}><LogOut size={16} /></button></div>
        </div>
      </aside>
      <section className="admin-content">
        <header className="admin-topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><b>{tab === "overview" ? "Overview" : tab === "software" ? "Listings" : tab === "users" ? "Members" : tab === "orders" ? "Orders" : "Inquiries"}</b></div><div className="topbar-right"><span className="live-indicator"><i /> LIVE</span><button className="refresh-button" onClick={() => void loadDashboard()} disabled={loading}><RefreshCw size={15} className={loading ? "rotate" : ""} /> Refresh</button><span className="topbar-avatar">{admin.name.slice(0, 1).toUpperCase()}</span></div></header>
        <div className="admin-main">
          {tab === "overview" && loading && !stats
            ? <OverviewLoading />
            : tab === "overview" && <Overview stats={stats} software={software} orders={orders} setTab={setTab} moderate={moderate} onView={setSelectedListing} loading={loading} />}
          {tab === "software" && <div className="view-section"><div className="page-heading"><div><div className="admin-kicker">MARKETPLACE CATALOG</div><h1>Product listings</h1><p>Review creator submissions before they go live.</p></div><span className="heading-count">{software.length} total</span></div><SearchBar value={search} onChange={setSearch} placeholder="Search listings by title or creator..." />{loading ? <TableLoading /> : <SoftwareTable items={filteredSoftware} moderate={moderate} onView={setSelectedListing} />}</div>}
          {tab === "users" && <div className="view-section"><div className="page-heading"><div><div className="admin-kicker">YOUR COMMUNITY</div><h1>Members</h1><p>Manage member access and marketplace roles.</p></div><span className="heading-count">{users.length} total</span></div><SearchBar value={search} onChange={setSearch} placeholder="Search people by name, email or role..." />{loading ? <TableLoading /> : <UsersTable users={filteredUsers} adminId={admin._id} updatingId={updatingUserRoleId} onRoleChange={updateUserRole} />}</div>}
          {tab === "orders" && <div className="view-section"><div className="page-heading"><div><div className="admin-kicker">PAYMENTS & ACTIVITY</div><h1>Orders</h1><p>Customers pay through Razorpay. Send creator payouts manually, then record the transfer reference here.</p></div><span className="heading-count">{orders.length} total</span></div><SearchBar value={search} onChange={setSearch} placeholder="Search by order, buyer or status..." />{loading ? <TableLoading /> : <OrdersTable orders={filteredOrders} updatingPayoutId={updatingPayoutId} onRecordPayout={recordCreatorPayout} />}</div>}
          {tab === "inquiries" && <div className="view-section"><div className="page-heading"><div><div className="admin-kicker">MESSAGES FROM THE COMMUNITY</div><h1>Contact inquiries</h1><p>Questions and reports submitted through the marketplace contact form.</p></div><span className="heading-count">{inquiries.length} total</span></div><SearchBar value={search} onChange={setSearch} placeholder="Search name, email, subject or message..." />{loading ? <TableLoading /> : <ContactInquiriesTable inquiries={filteredInquiries} updatingId={updatingInquiryId} onStatusChange={updateInquiryStatus} onDelete={deleteInquiry} />}</div>}
          <footer className="admin-footer"><span>Craftmarket Admin <span>·</span> Thoughtful commerce, carefully managed.</span><span>Need a hand? <a href="mailto:support@example.com">Get support <ArrowUpRight size={12} /></a></span></footer>
        </div>
      </section>
      {selectedListing && <ListingDetails listing={selectedListing} onClose={() => setSelectedListing(null)} moderate={moderate} />}
    </main>
  );
}

function Overview({ stats, software, orders, setTab, moderate, onView, loading }: {
  stats: DashboardStats | null;
  software: Software[];
  orders: Order[];
  setTab: (tab: Tab) => void;
  moderate: (id: string, action: "approve" | "reject") => Promise<boolean>;
  onView: (listing: Software) => void;
  loading: boolean;
}) {
  const pending = software.filter((item) => item.status === "pending").slice(0, 5);
  const latestOrders = orders.slice(0, 5);
  return <div className="view-section">
    <div className="page-heading"><div><div className="admin-kicker">SUNDAY, {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" }).toUpperCase()}</div><h1>Good morning.</h1><p>Here’s what’s happening around the marketplace today.</p></div><div className="overview-day"><Command size={15} /> YOUR ADMIN OVERVIEW</div></div>
    <div className="stats-grid">
      <MetricCard icon={<CircleDollarSign size={17} />} label="TOTAL REVENUE" value={money(stats?.totalRevenue || 0)} sub="Across completed orders" tone="green" />
      <MetricCard icon={<Users size={17} />} label="MEMBERS" value={String(stats?.totalUsers || 0)} sub={`${stats?.totalCreators || 0} creators · ${stats?.totalBuyers || 0} buyers`} tone="blue" />
      <MetricCard icon={<PackageCheck size={17} />} label="PRODUCTS" value={String(stats?.totalSoftware || 0)} sub={`${pending.length} awaiting review`} tone="lilac" />
      <MetricCard icon={<ShoppingBag size={17} />} label="COMPLETED ORDERS" value={String(stats?.totalOrders || 0)} sub={`${money(stats?.platformEarnings || 0)} platform share`} tone="orange" />
    </div>
    {loading && <div className="table-loading"><span className="admin-spinner" /> Refreshing overview...</div>}
    <div className="overview-grid">
      <section className="data-card review-card">
        <div className="card-header"><div><span className="card-kicker">NEEDS A LOOK</span><h2>Review queue <span>{pending.length}</span></h2></div><button className="card-link" onClick={() => setTab("software")}>All listings <ArrowUpRight size={14} /></button></div>
        {pending.length ? pending.map((item) => <div className="review-row" key={item._id}><div className="review-product-icon"><PackageCheck size={16} /></div><div className="review-copy"><b>{item.title}</b><small>by {typeof item.creator === "string" ? "Creator" : item.creator?.name || "Creator"} · {money(item.price)}</small></div><span className="pending-pill"><i /> Pending</span><button className="quick-approve" title="View listing details" aria-label={`View ${item.title} details`} onClick={() => onView(item)}><Eye size={15} /></button><button className="quick-approve" title="Approve listing" aria-label={`Approve ${item.title}`} onClick={() => void moderate(item._id, "approve")}><Check size={16} /></button></div>) : <div className="card-empty"><span>✳</span><b>All caught up.</b><small>No product reviews waiting right now.</small></div>}
      </section>
      <section className="data-card activity-card">
        <div className="card-header"><div><span className="card-kicker">THE LATEST</span><h2>Recent orders</h2></div><button className="card-link" onClick={() => setTab("orders")}>All orders <ArrowUpRight size={14} /></button></div>
        {latestOrders.length ? latestOrders.map((order) => <div className="activity-row" key={order._id}><div className="activity-icon"><ShoppingBag size={15} /></div><div className="activity-copy"><b>{typeof order.software === "string" ? "Software purchase" : order.software?.title || "Software purchase"}</b><small>{typeof order.buyer === "string" ? "Buyer" : order.buyer?.name || "Buyer"} · {new Date(order.createdAt).toLocaleDateString()}</small></div><div className="activity-amount"><b>{money(order.amount)}</b><small>{order.status}</small></div></div>) : <div className="card-empty"><span>↗</span><b>Room to grow.</b><small>Orders will show up here as products sell.</small></div>}
      </section>
    </div>
    <section className="data-card pulse-card"><div className="pulse-copy"><span className="card-kicker">PLATFORM PULSE</span><h2>Good things are taking shape.</h2><p>Every listing is somebody’s hard work. Thanks for helping the right work find the right people.</p></div><div className="pulse-visual"><div className="pulse-arc arc-one" /><div className="pulse-arc arc-two" /><span>✳</span><small><ArrowDownRight size={13} /> SMALL & INDEPENDENT</small></div></section>
  </div>;
}

function MetricCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; tone: string }) {
  return <div className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><span className="metric-label">{label}</span><strong>{value}</strong><small>{sub}</small><span className="metric-trend"><ArrowUpRight size={14} /></span></div>;
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className="table-search"><Search size={17} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />{value && <button onClick={() => onChange("")} aria-label="Clear search"><X size={14} /></button>}</div>;
}

function SoftwareTable({ items, moderate, onView }: { items: Software[]; moderate: (id: string, action: "approve" | "reject") => Promise<boolean>; onView: (listing: Software) => void }) {
  if (!items.length) return <div className="empty-table"><PackageCheck size={22} /><b>Nothing to show</b><span>No listings match this search.</span></div>;
  return <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>CREATOR</th><th>PRICE</th><th>STATUS</th><th>SUBMITTED</th><th>ACTIONS</th></tr></thead><tbody>{items.map((item) => <tr key={item._id}><td><button type="button" className="product-title-button" onClick={() => onView(item)} aria-label={`View all details for ${item.title}`}>{item.title}</button><small>{item.platformType.replace("-", " ")}</small></td><td>{typeof item.creator === "string" ? "Creator" : item.creator?.name || "Creator"}<small>{typeof item.creator === "string" ? "" : item.creator?.email}</small></td><td>{money(item.price)}</td><td><span className={`status-label ${item.status}`}>{item.status}</span></td><td>{new Date(item.createdAt).toLocaleDateString()}</td><td><div className="table-actions"><button className="view-listing-button" onClick={() => onView(item)}><Eye size={13} /> Details</button>{item.status !== "approved" && <button className="approve-button" onClick={() => void moderate(item._id, "approve")}><Check size={13} /> Approve</button>}{item.status !== "rejected" && <button className="reject-button" onClick={() => void moderate(item._id, "reject")}><X size={13} /> Reject</button>}</div></td></tr>)}</tbody></table></div>;
}

function ListingDetails({ listing, onClose, moderate }: {
  listing: Software;
  onClose: () => void;
  moderate: (id: string, action: "approve" | "reject") => Promise<boolean>;
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => setActiveImageIndex(0), [listing._id]);

  const creator = typeof listing.creator === "string" ? null : listing.creator;
  const resources = [
    { label: "Live product demo", url: listing.liveDemoUrl, icon: <ExternalLink size={15} /> },
    { label: "Source repository", url: listing.gitRepository, icon: <ExternalLink size={15} /> },
  ];
  return (
    <div className="listing-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="listing-modal" role="dialog" aria-modal="true" aria-labelledby="listing-modal-title">
        <header className="listing-modal-header">
          <div><span className="admin-kicker">FULL LISTING REVIEW</span><h2 id="listing-modal-title">{listing.title}</h2></div>
          <button className="listing-modal-close" onClick={onClose} aria-label="Close listing details"><X size={18} /></button>
        </header>
        <div className="listing-modal-content">
          <div className="listing-detail-top">
            <span className={`status-label ${listing.status}`}>{listing.status}</span>
            <span>{listing.platformType.replace("-", " ")}</span>
            <b>{money(listing.price)}</b>
            <span>{listing.totalSales} sales · {money(listing.totalRevenue)} revenue</span>
          </div>
          <section className="listing-detail-section">
            <h3>Description</h3>
            <p className="listing-full-description">{listing.description}</p>
          </section>
          <section className="listing-detail-section">
            <h3>Creator & GitHub account</h3>
            {creator ? <div className="listing-creator-details"><b>{creator.name}</b><a href={`mailto:${creator.email}`}>{creator.email}</a><a href={`tel:${creator.mobile}`}>{creator.mobile}</a><small>Creator ID: {creator._id}</small></div> : <p>Creator ID: {typeof listing.creator === "string" ? listing.creator : listing.creator._id}</p>}
            <div className="listing-github-details"><b>Verified GitHub username</b><a href={`https://github.com/${encodeURIComponent(listing.githubUsername || "")}`} target="_blank" rel="noreferrer">@{listing.githubUsername || "Not recorded"} <ExternalLink size={12} /></a></div>
          </section>
          <section className="listing-detail-section">
            <h3>Technology</h3>
            <div className="listing-tech-list">{listing.languages?.length ? listing.languages.map((language) => <span key={language}>{language}</span>) : <small>No technology details provided.</small>}</div>
          </section>
          <section className="listing-detail-section">
            <h3>Product images</h3>
            {listing.images?.length ? <div className="listing-image-gallery">
              <div className="listing-image-current">
                <a className="listing-image-open" href={listing.images[activeImageIndex]} target="_blank" rel="noreferrer" aria-label={`Open product image ${activeImageIndex + 1}`}>
                  <img src={listing.images[activeImageIndex]} alt={`${listing.title} image ${activeImageIndex + 1}`} />
                </a>
                {listing.images.length > 1 && <>
                  <button type="button" className="listing-image-arrow previous" onClick={(event) => { event.preventDefault(); setActiveImageIndex((index) => Math.max(0, index - 1)); }} disabled={activeImageIndex === 0} aria-label="Show previous product image"><ChevronLeft size={20} /></button>
                  <button type="button" className="listing-image-arrow next" onClick={(event) => { event.preventDefault(); setActiveImageIndex((index) => Math.min(listing.images.length - 1, index + 1)); }} disabled={activeImageIndex === listing.images.length - 1} aria-label="Show next product image"><ChevronRight size={20} /></button>
                  <span className="listing-image-count" aria-live="polite">{activeImageIndex + 1} / {listing.images.length}</span>
                </>}
              </div>
              {listing.images.length > 1 && <div className="listing-image-thumbnails" aria-label="Product image selection">{listing.images.map((image, index) => <button type="button" className={index === activeImageIndex ? "active" : ""} onClick={() => setActiveImageIndex(index)} aria-label={`Show product image ${index + 1}`} aria-current={index === activeImageIndex ? "true" : undefined} key={`${image}-${index}`}><img src={image} alt="" /></button>)}</div>}
            </div> : <p>No product images available.</p>}
          </section>
          <section className="listing-detail-section">
            <h3>Demo video</h3>
            {listing.video ? <video className="listing-demo-video" src={listing.video} controls preload="metadata">Your browser does not support video playback.</video> : <p>No demo video available.</p>}
          </section>
          <section className="listing-detail-section">
            <h3>Product guide {listing.pdfDocument && <span className="pdf-file-badge">PDF</span>}</h3>
            {listing.pdfDocument && <PdfPreview listingId={listing._id} title={listing.title} />}
            {!listing.pdfDocument && <p>No product guide was provided.</p>}
          </section>
          {listing.projectArchiveAvailable
            ? <ProjectArchiveTree listingId={listing._id} />
            : <section className="listing-detail-section"><h3>Project folder structure</h3><p>No project archive was provided.</p></section>}
          <section className="listing-detail-section">
            <h3>Product links</h3>
            <div className="listing-resource-list">{resources.map((resource) => resource.url ? <a key={resource.label} href={resource.url} target="_blank" rel="noreferrer">{resource.icon}{resource.label}<ExternalLink size={12} /></a> : <span className="resource-unavailable" key={resource.label}>{resource.icon}{resource.label} <small>Not provided</small></span>)}</div>
          </section>
          <section className="listing-detail-section listing-dates">
            <span><b>Submitted</b>{new Date(listing.createdAt).toLocaleString()}</span>
            {listing.updatedAt && <span><b>Last updated</b>{new Date(listing.updatedAt).toLocaleString()}</span>}
            <span><b>Listing ID</b><code>{listing._id}</code></span>
          </section>
        </div>
        <footer className="listing-modal-footer">
          {listing.status !== "approved" && <button className="approve-button" onClick={async () => { if (await moderate(listing._id, "approve")) onClose(); }}><Check size={14} /> Approve listing</button>}
          {listing.status !== "rejected" && <button className="reject-button" onClick={async () => { if (await moderate(listing._id, "reject")) onClose(); }}><X size={14} /> Reject listing</button>}
          <button className="listing-modal-done" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  );
}

function UsersTable({
  users,
  adminId,
  updatingId,
  onRoleChange,
}: {
  users: User[];
  adminId: string;
  updatingId: string | null;
  onRoleChange: (user: User, role: "buyer" | "creator") => void;
}) {
  if (!users.length) return <div className="empty-table"><Users size={22} /><b>No members found</b><span>Try a different search term.</span></div>;
  return <div className="table-wrap"><table><thead><tr><th>MEMBER</th><th>ROLE</th><th>RAZORPAY PAYMENT IDS</th><th>VERIFIED</th><th>JOINED</th></tr></thead><tbody>{users.map((user) => <tr key={user._id}><td><b>{user.name}</b><small>{user.email}</small></td><td>{user.role === "admin" ? <span className={`role-label ${user.role}`}>Admin</span> : <select className="member-role-select" aria-label={`Change role for ${user.name}`} value={user.role} disabled={user._id === adminId || updatingId === user._id} onChange={(event) => onRoleChange(user, event.target.value as "buyer" | "creator")}><option value="buyer">Buyer</option><option value="creator">Creator</option></select>}</td><td className="member-payment-ids">{user.paymentIds?.length ? user.paymentIds.map((paymentId) => <small className="payment-id" key={paymentId}>{paymentId}</small>) : <small>No completed purchases</small>}</td><td>{user.isVerified ? <span className="verified-label"><Check size={13} /> Verified</span> : "—"}</td><td>{new Date(user.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>;
}

function OrdersTable({ orders, updatingPayoutId, onRecordPayout }: {
  orders: Order[];
  updatingPayoutId: string | null;
  onRecordPayout: (orderId: string, reference: string) => void;
}) {
  if (!orders.length) return <div className="empty-table"><ShoppingBag size={22} /><b>No orders found</b><span>Transactions will appear here.</span></div>;
  return <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>BUYER</th><th>CREATOR & PAYOUT DESTINATION</th><th>SALE</th><th>CREATOR EARNING</th><th>ORDER</th><th>CREATOR PAYOUT</th><th>DATE</th></tr></thead><tbody>{orders.map((order) => {
    const creator = typeof order.creator === "string" ? null : order.creator;
    const payoutDestination = creator?.payoutMethod === "paypal"
      ? creator.paypalEmail
      : creator?.payoutMethod === "upi" ? creator.upiId : null;
    return <tr key={order._id}>
      <td><b>{typeof order.software === "string" ? "Software purchase" : order.software?.title || "Software purchase"}</b><small className="id-text">{order._id}</small></td>
      <td>{typeof order.buyer === "string" ? "Buyer" : order.buyer?.name || "Buyer"}</td>
      <td><b>{creator?.name || "Creator"}</b><small>{creator?.payoutMethod ? `${creator.payoutMethod === "paypal" ? "PayPal" : "UPI"} · ${payoutDestination || "details missing"}` : "Payout details not saved"}</small></td>
      <td><b>{money(order.amount)}</b><small>Platform fee {money(order.platformFee)}</small></td>
      <td><b>{money(order.creatorEarning)}</b></td>
      <td><span className={`status-label ${order.status}`}>{order.status}</span></td>
      <td><PayoutAction order={order} hasDestination={Boolean(payoutDestination)} busy={updatingPayoutId === order._id} onRecordPayout={onRecordPayout} /></td>
      <td>{new Date(order.createdAt).toLocaleDateString()}</td>
    </tr>;
  })}</tbody></table></div>;
}

function PayoutAction({ order, hasDestination, busy, onRecordPayout }: {
  order: Order;
  hasDestination: boolean;
  busy: boolean;
  onRecordPayout: (orderId: string, reference: string) => void;
}) {
  const [reference, setReference] = useState("");
  if (order.status !== "paid") return <span>Available after customer payment</span>;
  if (order.creatorPayoutStatus === "paid") {
    return <><span className="payout-complete">Paid</span><small>{order.creatorPayoutReference}</small><small>{order.creatorPayoutAt ? new Date(order.creatorPayoutAt).toLocaleDateString() : ""}</small></>;
  }
  if (!hasDestination) return <span className="payout-missing">Creator must save payout details</span>;
  return <form className="payout-admin-form" onSubmit={(event) => {
    event.preventDefault();
    onRecordPayout(order._id, reference.trim());
  }}>
    <input aria-label={`Transfer reference for order ${order._id}`} required maxLength={200} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Transfer reference" />
    <button className="payout-mark-button" disabled={busy}>{busy ? "Recording..." : "Record payout"}</button>
  </form>;
}

function ContactInquiriesTable({ inquiries, updatingId, onStatusChange, onDelete }: {
  inquiries: ContactSubmission[];
  updatingId: string | null;
  onStatusChange: (inquiry: ContactSubmission, status: ContactSubmission["status"]) => void;
  onDelete: (inquiry: ContactSubmission) => void;
}) {
  if (!inquiries.length) return <div className="empty-table"><Mail size={22} /><b>No contact inquiries found</b><span>New messages submitted through the contact form will appear here.</span></div>;
  return <div className="table-wrap"><table className="inquiries-table"><thead><tr><th>FROM</th><th>SUBJECT</th><th>MESSAGE</th><th>RECEIVED</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{inquiries.map((inquiry) => <tr key={inquiry._id}><td><b>{inquiry.name}</b><a href={`mailto:${inquiry.email}`}>{inquiry.email}</a><a href={`tel:${inquiry.phone}`}>{inquiry.phone}</a></td><td>{inquiry.subject}</td><td><p className="inquiry-message">{inquiry.query}</p></td><td>{new Date(inquiry.createdAt).toLocaleString()}</td><td><span className={`inquiry-status ${inquiry.status}`}>{inquiry.status === "in-progress" ? "In progress" : inquiry.status}</span></td><td><div className="inquiry-actions"><select aria-label={`Update status for inquiry from ${inquiry.name}`} value={inquiry.status} disabled={updatingId === inquiry._id} onChange={(event) => onStatusChange(inquiry, event.target.value as ContactSubmission["status"])}><option value="new">New</option><option value="in-progress">In progress</option><option value="resolved">Resolved</option></select><button type="button" className="inquiry-delete" aria-label={`Delete inquiry from ${inquiry.name}`} title="Delete inquiry" disabled={updatingId === inquiry._id} onClick={() => onDelete(inquiry)}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>;
}

function TableLoading() {
  return <div className="admin-table-skeleton" role="status" aria-label="Loading data" aria-busy="true">
    <span className="sr-only">Loading your data...</span>
    <div className="skeleton-table-head" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <span className="admin-skeleton-block" key={index} />)}</div>
    {Array.from({ length: 5 }, (_, row) => <div className="skeleton-table-row" aria-hidden="true" key={row}>{Array.from({ length: 5 }, (_, column) => <span className="admin-skeleton-block" key={column} />)}</div>)}
  </div>;
}

function OverviewLoading() {
  return <div className="view-section admin-overview-skeleton" role="status" aria-label="Loading dashboard" aria-busy="true">
    <span className="sr-only">Loading dashboard...</span>
    <div className="admin-skeleton-heading" aria-hidden="true">
      <div><span className="admin-skeleton-block" /><span className="admin-skeleton-block" /><span className="admin-skeleton-block" /></div>
      <span className="admin-skeleton-block" />
    </div>
    <div className="stats-grid" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => <div className="metric-card" key={index}>
        <span className="admin-skeleton-block admin-skeleton-icon" /><span className="admin-skeleton-block admin-skeleton-label" /><span className="admin-skeleton-block admin-skeleton-value" /><span className="admin-skeleton-block admin-skeleton-caption" />
      </div>)}
    </div>
    <div className="overview-grid" aria-hidden="true">
      {Array.from({ length: 2 }, (_, index) => <div className="data-card admin-skeleton-panel" key={index}>
        <span className="admin-skeleton-block admin-skeleton-panel-title" />
        {Array.from({ length: 3 }, (_, row) => <span className="admin-skeleton-block admin-skeleton-panel-row" key={row} />)}
      </div>)}
    </div>
  </div>;
}
