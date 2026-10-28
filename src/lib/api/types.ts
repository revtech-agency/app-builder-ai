export type CompanyStatus = "provisioning" | "active" | "paused";

export type Company = {
  id: string;
  slug: string;
  name: string;
  status: CompanyStatus;
  plan: string;
  credits_balance: number;
  live_url: string | null;
};

export type Chat = {
  id: string;
  company_id: string;
  title: string;
};

export type StepStatus = "done" | "running" | "failed";
export type TurnStatus = "running" | "completed" | "failed";
export type TurnOutcome = "shipped" | "failed" | "no_change" | "asked_founder";

export type TurnStep = {
  label: string;
  status: StepStatus;
};

export type Turn = {
  id: string;
  status: TurnStatus;
  steps: TurnStep[];
  outcome: TurnOutcome | null;
  preview_url: string | null;
  cost_usd: number;
  started_at: string;
  ended_at: string | null;
};

export type ChatMessage = {
  id: string;
  chat_id: string;
  role: "founder" | "agent";
  text: string;
  created_at: string;
  turn?: Turn;
};

export type BindingConstraint = "found" | "used" | "paid";

export type GrowthLedger = {
  company_id: string;
  business_read: string;
  binding_constraint: BindingConstraint;
  updated_at: string;
};

export type GrowthStepStatus = "planned" | "in_progress" | "live" | "dead";

export type GrowthStep = {
  id: string;
  company_id: string;
  title: string;
  status: GrowthStepStatus;
  detail: string;
  evidence_url: string | null;
};

export type DraftStatus = "draft" | "approved" | "sent" | "rejected";

// Mail row. Inbound rows use received_at + dmarc_pass; outbound rows use sent_at + status.
export type MailMessage = {
  id: string;
  company_id: string;
  direction: "in" | "out";
  from: string;
  to: string;
  subject: string;
  body_text: string;
  received_at: string | null;
  sent_at: string | null;
  dmarc_pass: boolean | null;
  status: DraftStatus | null;
};

export type AskPriority = "low" | "normal" | "high";
export type AskStatus = "open" | "answered" | "expired";

export type FounderAsk = {
  id: string;
  company_id: string;
  title: string;
  question: string;
  priority: AskPriority;
  suggested_reply: string;
  status: AskStatus;
  answer: string | null;
};

export type DeploymentStatus = "queued" | "building" | "live" | "failed" | "superseded";
export type DeploymentTrigger = "turn_end" | "manual" | "platform";

export type Deployment = {
  id: string;
  company_id: string;
  commit_sha: string;
  status: DeploymentStatus;
  url: string;
  trigger: DeploymentTrigger;
  build_log_tail: string;
  created_at: string;
  turn_id: string | null;
};

export type DomainPurpose = "website" | "cold" | "extra";
export type DomainStatus = "pending_payment" | "registering" | "verifying" | "active";

export type Domain = {
  company_id: string;
  domain: string;
  purpose: DomainPurpose;
  status: DomainStatus;
};

export type PurchaseKind = "domain" | "external";
export type PurchaseStatus = "awaiting_payment" | "paid" | "cancelled" | "blocked";

export type PurchaseRequest = {
  id: string;
  company_id: string;
  kind: PurchaseKind;
  merchant: string;
  amount_usd: number;
  status: PurchaseStatus;
};
