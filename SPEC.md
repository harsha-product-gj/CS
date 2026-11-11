# SleepyHug Customer Support App — Spec v1

_Last updated: 11-Nov-2026 · Status: agreed requirements, ready to build Foundation_

---

## 1. Users & roles

| Role | Who (today) | Can do |
|---|---|---|
| **Agent** | Jhumi, Chanchal, Ankit, Rohit | Search, create & work own tickets. View all tickets; edit others' only via approved edit access or temporary assignment. |
| **Ops** | 2 members | Pickups & Dispatches: view, edit status (single/bulk), download/upload Excel. Read-only tickets/resolutions. |
| **Admin** | 3 members | Everything: users, rosters, SLAs, missed-call upload, assignments, approvals, dashboards. |

- Sign-in: Google, restricted to the company Workspace domain. Users are added by an Admin (no self sign-up).
- One user can have several roles.

---

## 2. Infrastructure (free plans for now)

| Piece | Choice |
|---|---|
| Code | GitHub repo |
| App hosting | Vercel (Hobby), auto-deploy from GitHub |
| Database, auth, scheduled jobs | Supabase (Free): Postgres, Google login, pg_cron |
| App framework | Next.js + TypeScript, Tailwind UI |
| Google access | **Owner's Google account (OAuth)** for now: reads DataBank sheet, writes evidence to Drive. Move to a central/service account later. |
| Evidence storage | Owner's Google Drive, dedicated root folder `SleepyHug CS Evidence`. Path kept stable so it can be moved later. |

Known limits to revisit before scaling: Supabase Free has no automatic backups and pauses after 7 days of no activity. Vercel Hobby is meant for non-commercial use.

---

## 3. Orders data

### 3.1 Source & sync
- Source: Google Sheet **DataBank → tab "Sale Orders"**. It's an Unicommerce export (26 columns), auto-refreshed by Apps Script every ~2.5h, covering the rolling last 30 days.
- Initial load: full CSV (159,945 rows / 158,480 orders, 27-Nov-2024 → 11-Nov-2026).
- Ongoing: a Supabase scheduled job every 2h reads the sheet and upserts. Key = `Display Order Code` + `Item SKU Code`; this was verified to be unique.
- The app never writes to the sheet. Orders are read-only in the app.

### 3.2 Data model
- **Order** (one per `Display Order Code`) → **Items** (one per SKU row). 1,372 orders have more than one SKU.
- Phone is normalised to its last 10 digits. `9999999999` (masked, older Flipkart/E-Kart orders) and encrypted strings (Amazon channels before Jun-2026) are stored as **no phone**.
- `TESTORDER_*` and `SAMPLE_*` orders are excluded.

### 3.3 Channel mapping (`Channel Name` / order code → Order channel)

| Order channel | Code | Rule |
|---|---|---|
| Amazon Self-ship | `AS` | `AMAZON_*`, `Amazon_*`, `AMAZON_EASYSHIP_OMNI` |
| Amazon Seller Flex | `SX` | `SF_XB_*`; CUSTOM ending `-AMZ-SF` |
| Amazon FBA | `AF` | Not in sheet; agent enters manually |
| Amazon RetailEZ | `AR` | `REZ_DF_*`; CUSTOM ending `_REZ`. Usually entered manually from the customer |
| Flipkart Self-ship | `FS` | `FK_*`, `FKXB_*` |
| Flipkart FBF | `FF` | Not in sheet; agent enters manually |
| Website D2C | `WD` | CUSTOM `FS…` and `…-Shopify` / `…-shopify` |
| Other | `OT` | Text box |
| No order (enquiry only) | `NA` | — |

New, unmapped channel names are flagged to Admin.

### 3.4 Linked (replacement/exchange) shipments
CUSTOM orders that point back to an original order are linked to it, not shown as separate customer orders:
- Prefixes: `RPF1_`, `RPA1_`, `RPD1_`, `RPFF1_`, `C_`, … (any `XXn_` before an original ID)
- Suffixes: `/Replace`, `/Replacement`, `/Exchange`, `/Clone`, `/Rex`, `/Def`, `_1`, `-1`, `_REZ`, `-AMZ-SF`

654 of 681 `RP*` orders already resolve to an original order in the sheet. Unresolved ones are listed for Admin review.

---

## 4. Search & customer view
- **One search bar** that accepts: mobile, order ID, AWB / tracking number, customer name, email. Email only matches tickets, because orders don't carry email.
- The result is a **Customer view**:
  - customer details (name, phone, email, addresses), merged from orders and tickets
  - **Orders list**: each order with items, status, dispatch/delivery dates, AWB, channel, linked shipments, and **the tickets raised on that order**
  - **Tickets without an order** (enquiries)
  - an open ticket on any order/source/owner is highlighted at the top: "Ticket C-FS-2611-0042 open, owner Ankit, last update …"
- **Create ticket** is always available.
  - From an order: details are prefilled.
  - Blank: the agent selects the Order channel and types everything (order ID, name, phone, address, SKU…). This is the path for FBA, FBF, RetailEZ, Seller Flex and orders not found.
- No match → "Create ticket" with the searched value prefilled.

---

## 5. Tickets

### 5.1 Ticket ID
`{Type}-{Channel}-{YYMM}-{seq}`, e.g. **`C-FS-2611-0042`** = Complaint · Flipkart Self-ship · Nov-2026 · #42. Type is `C` complaint or `E` enquiry. The sequence resets monthly.
The ID **never changes**. If an enquiry is converted to a complaint, it keeps its `E-` ID, and its current type is shown separately.

### 5.2 Common fields (Enquiry & Complaint)
- Ticket ID, Type, **Order channel**, Order ID (required for complaints, optional for enquiries), **Affected item(s)** (pick from the order's SKUs; free text if entered manually)
- Customer: name, mobile, alternate mobile, email, address (editable copy; the original order data is untouched)
- **Source**: Inbound call · Amazon · Flipkart · Email · WhatsApp · Social media (YouTube, LinkedIn, Instagram, Facebook, X, Threads, Reddit, Other + text) · Other source (text)
- Owner, Temporary owner (+ from/to), Created by
- Created / Last updated / Resolved / Closed timestamps
- Status (by type, below), **SLA flag**, **Open/Closed flag**
- **Contact log** (§5.5), **Notes** (append-only, timestamp + agent), **Next follow-up** (§5.6)
- **Invoice upload** (optional; expected for manually entered orders)
- **Reference to previous ticket(s)** (link, since tickets can't be reopened)
- **Marketplace fields** (for Amazon/Flipkart):
  - Marketplace request / return ID
  - Panel action: Accepted / Rejected / Not applicable
  - Panel comments
  - Panel updated (yes + timestamp)
  - Marketplace replacement order ID (optional; if filled, no offline dispatch is created)
- **Policy exception** flag (auto-set for FBA / FBF / RetailEZ / Seller Flex; editable)

### 5.3 Enquiry
- Enquiry type: Delivery · Product info · Service · Policy · Other
- Query (text)
- **Outcome / closing response** (text, required to resolve)
- Status: **Open** (default) → **In progress** → **Resolved**
- SLA: **24h** from creation
- Resolved = Closed

### 5.4 Complaint
- Complaint type: Order delivery · Product damaged · Product quality · Wrong product · Other
- Complaint details (text)
- **Evidence**: view and upload images/videos, max **100 MB** per file
- Status:
  - **Open** (default)
  - **In progress** (set automatically on the owner's first update)
  - **Awaiting evidence** (agent)
  - **Follow up for evidence** (set automatically 24h after Awaiting evidence)
  - **Resolved** (agent sets resolution)
- SLA: **48h** from creation, **paused while waiting on the customer** (§5.7)
- **Resolution**:
  - Convinced
  - Return & refund
  - Replacement (same SKU)
  - Exchange (different SKU)
  - Partial refund
  - Goodwill coupon
  - Refund without return
  - Complaint rejected
  - Customer unresponsive
  - Duplicate ticket
- Resolution details: replacement/exchange SKU, refund amount, coupon code, rejection reason (as applicable)
- **Review status** (for Convinced, Replacement, Exchange, Goodwill coupon): Not asked · Agreed · Will not review · Review posted · Review verified

### 5.5 Contact log
- Agent clicks **Log call / contact** and picks:
  - direction (Inbound / Outbound)
  - mode (Call, WhatsApp, Email, Panel message)
  - outcome (Answered / Not responded / Not reachable)
  - optional note
- Derived fields: **"X of Y answered"**, **Last call status**, last contact time.
- Later: calls are imported automatically from the Tata dialer sheet (dialled, answered, missed, duration).

### 5.6 Next follow-up (required on every open ticket)
- Every save of an open ticket requires a next follow-up date/time and a reason:
  - Customer gave a time
  - Not reachable — retry (same/next day, per the Not Contactable protocol)
  - Awaiting evidence (default now + 24h)
  - Internal follow-up
- Drives: the agent's **"Due today / Overdue"** queue, and the Admin's daily view for re-assignment.

### 5.7 Clocks & TATs
- **Customer wait time**: total time paused. Pauses while:
  - status is Awaiting evidence / Follow up for evidence
  - follow-up reason is "Customer asked to call later", from when it's logged until the scheduled time
- **Deadline** = created + SLA + customer wait time.
- **Resolution TAT** = created → Resolved (the agent's part).
- **Closure TAT** = created → Closed (end to end, including ops).
- Both are reported with and without customer wait time.
- **SLA hours are configurable by Admin and snapshotted on the ticket at creation.** Later changes don't affect existing tickets.

### 5.8 SLA flag (separate from status)
- **On track**
- **Needs attention**, if any of:
  - follow-up overdue or missing
  - less than 25% of SLA time left
  - Awaiting evidence for more than 48h
- **Delayed**: deadline passed and not Resolved

The Admin dashboard shows a daily **Needs attention** list.

### 5.9 Open/Closed flag (automatic)

| Resolution | Closes when |
|---|---|
| Enquiry resolved, Convinced, Complaint rejected, Customer unresponsive, Duplicate ticket | Immediately on Resolved |
| Return & refund, Refund without return, Partial refund | Refund issued (Payment status) |
| Replacement, Exchange | Replacement delivered (Dispatch status), or marketplace replacement order ID recorded and marked delivered |
| Goodwill coupon | Coupon code recorded |

Closed tickets can't be reopened. A new ticket is created and linked to the old one.

### 5.10 Enquiry → Complaint conversion
- Everything is kept.
- The deadline is **recomputed from the original creation time** with the 48h complaint SLA.
- The TAT clock never resets.

### 5.11 Duplicate tickets
- When a customer already has an open ticket, the agent sees it at search time and tells the customer its status.
- If a duplicate must be logged (e.g. it came through another source), it is created as a **child** of the open ticket:
  - it shows the parent's info and status
  - it closes when the parent closes
  - all work happens on the parent

### 5.12 Audit log
Every field change is recorded: who, what (old → new), when. It's visible on the ticket's History tab.

---

## 6. Assignment & workload

- **Processes**: Inbound calls, Missed calls, WhatsApp, Email, Amazon, Flipkart, Social media, etc. (Admin-editable list).
- **Roster**: Admin sets, per date, which agents are working and which processes each covers. An agent can be in several processes. Excel upload of the roster comes later.
- **Owner on creation**: the agent who creates the ticket.
- **Missed-call upload** (Admin): upload a list of numbers + call time. The app looks up customers and creates tickets (Source = Inbound call, Status = Open), assigned **round-robin** among agents rostered on "Missed calls" that day.
- **Temporary assignment** (for leave):
  - Admin picks tickets that need attention that day, then either uses round-robin among present agents or selects a specific agent.
  - Sets a from–to window. During the window the temporary owner can work the ticket. The primary owner stays unchanged.
- **Edit access request**:
  - An agent requests edit access on another agent's ticket, and an Admin approves it for a duration.
  - Same mechanism as temporary assignment.
- **Agent home**: My tickets (own + temporary), tagged by source, with filters for Due today / Overdue / Needs attention / Status.
- **Admin approvals queue**: edit-access requests, dispatch-before-pickup overrides.

---

## 7. Resolutions module

One row per complaint with resolution **Return & refund, Replacement, Exchange, Partial refund, Refund without return**. It shows all ticket details and timestamps, and the statuses below are updated from Pickups / Dispatches / Payments.

| Type | Return status | Dispatch status | Payment status |
|---|---|---|---|
| **Return & refund** | ✓ | — | Refund pending · Refund delayed · Refund issued · Partial refund issued |
| **Replacement** (same SKU) | ✓ | ✓ | Not applicable · Payment pending · Payment collected _(logistics charges for customer-caused cases)_ |
| **Exchange** (different SKU) | ✓ | ✓ | Payment pending · Payment collected · Refund pending · Refund delayed · Partial refund issued _(downgrade)_ |
| **Partial refund / Refund without return** | — | — | Refund pending · Refund delayed · Refund issued |

- **Return status**: Pickup created · Pickup delayed · Pickup failed (customer unavailable) · Pickup cancelled · Pickup successful · Return in-transit delayed · Return received · Return received – QC failed · RTO
- **Dispatch status**: Replacement delayed · Replacement dispatched · Replacement delivered
- **SLAs** (Admin-configurable, snapshotted per case):
  - pickup within **2 days** of resolution
  - return in-transit **7 days**
  - dispatch **1 day** after pickup successful
  - refund **1 day** after pickup successful

  "Delayed" values are set automatically when these are breached.

---

## 8. Pickups module
- **Created automatically** when a resolution needs a return (Return & refund, Replacement, Exchange). For marketplace orders, this happens after Panel action = Accepted.
- Fields:
  - Pickup ID, Ticket ID, Order ID, channel, item(s)/SKU, qty
  - customer name, phone, pickup address, pincode
  - courier (Delhivery primary / Xpressbees), AWB, weight, dimensions, COD/prepaid, invoice value
  - status, timestamps
- Ops can:
  - filter and multi-select
  - bulk-update status
  - **download Excel → edit → upload Excel** (matched by Pickup ID; only status/AWB/courier columns are applied)
- Feeds Return status in Resolutions.
- _Later_: courier bulk-upload format, courier API tracking, logistics zone (A–E), estimated cost.

## 9. Dispatches module
- **Created automatically** when a Replacement/Exchange pickup is **successful**, unless a marketplace replacement order ID exists.
- Admin can approve **dispatch before pickup** (override).
- Fields: Dispatch ID, Ticket ID, original Order ID, SKU to send, customer, address, courier, AWB, status, timestamps.
- Same bulk update and Excel download/upload as Pickups.
- Feeds Dispatch status.
- Replacement orders that later appear in DataBank (`RPF1_…` etc.) are linked automatically.

## 10. Payments module
To be defined later. Until then, payment status is updated manually on the Resolutions screen.

---

## 11. Evidence & files
- Stored in Google Drive under the owner's account: `SleepyHug CS Evidence/<Order ID or NO-ORDER>/<Ticket ID>/<file>`
- Files upload **directly from the browser to Drive** (resumable upload), so 100 MB videos don't pass through Vercel.
- The app stores the file ID, name, type, size, uploader, time, and kind (Evidence / Invoice).
- _Later_: a naming convention for filtering by date/type/product/channel, a customer self-upload page on the website, and a move to a central storage/media library.

---

## 12. Dashboards (v1)
- **Today**: new, open, due today, overdue, needs attention, delayed, by agent and by source
- **SLA**: on-track vs delayed %, average Resolution TAT and Closure TAT (with/without customer wait)
- **Mix**: complaints by type, SKU, channel; resolution mix; review status funnel
- **Agent productivity**: tickets handled, contacts logged, answer rate, resolutions
- **Ops**: pickups/dispatches by status, delayed counts

---

## 13. Later iterations (parked)
- Tata dialer call-log import
- Customer WhatsApp/SMS notifications; Interakt WABA chat-assignment sync
- Customer evidence self-upload page; evidence naming convention / media library
- Courier bulk-upload formats, Delhivery/Xpressbees APIs, zones & cost grid
- Roster Excel upload
- Payments module
- Ratings & Reviews calling process
- Google Sheet two-way sync for Pickups/Dispatches
- Central Google account / service account, paid plans, backups

---

## 14. Build order
1. **Foundation**: repo, Supabase schema, Google login & roles, orders import + 2-hourly sync, channel mapping, search & customer view
2. **Tickets**: enquiry/complaint, contact log, follow-ups, notes, evidence & invoice, SLA flags & clocks, assignment/roster/temporary owner, missed-call upload, audit log
3. **Resolutions**
4. **Pickups**
5. **Dispatches**
6. **Dashboards**
7. **Payments** (later)

---

## 15. Setup checklist (owner)
- [ ] GitHub account/repo access for the project
- [ ] Supabase project (Free), region Mumbai `ap-south-1`
- [ ] Vercel account linked to GitHub
- [ ] Google Cloud project → OAuth consent screen set to **Internal** → OAuth client (Web). Used for team sign-in and the owner's Sheets/Drive connection.
- [ ] Create Drive folder `SleepyHug CS Evidence`
