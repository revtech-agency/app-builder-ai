// This module is the single swap point for the planned n8n data-table backend (webhooks).
// Every screen talks to the data layer through these functions only; replace the bodies
// with webhook calls later and keep the signatures.
import * as seed from "./mock-data";
import type {
  Chat,
  ChatMessage,
  Company,
  Deployment,
  Domain,
  FounderAsk,
  GrowthLedger,
  GrowthStep,
  MailMessage,
  PurchaseRequest,
  Turn,
} from "./types";

export * from "./types";

const state = structuredClone({
  companies: seed.companies,
  chats: seed.chats,
  messages: seed.chatMessages,
  ledgers: seed.growthLedgers,
  steps: seed.growthSteps,
  mail: seed.mail,
  asks: seed.asks,
  deployments: seed.deployments,
  domains: seed.domains,
  purchases: seed.purchaseRequests,
});

const DELAY_MS = 150;
const delay = () => new Promise((resolve) => setTimeout(resolve, DELAY_MS));
const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const newSha = () => Math.random().toString(16).slice(2, 14).padEnd(12, "0");

async function read<T>(value: () => T): Promise<T> {
  await delay();
  return structuredClone(value());
}

function find<T>(items: T[], match: (item: T) => boolean, what: string): T {
  const item = items.find(match);
  if (!item) throw new Error(`${what} not found`);
  return item;
}

const byNewest = <T extends { created_at: string }>(a: T, b: T) =>
  b.created_at.localeCompare(a.created_at);

export const getCompanies = (): Promise<Company[]> => read(() => state.companies);

export const getCompany = (id: string): Promise<Company> =>
  read(() => find(state.companies, (c) => c.id === id, "Company"));

export const listChats = (companyId: string): Promise<Chat[]> =>
  read(() => state.chats.filter((c) => c.company_id === companyId));

export const getChat = (chatId: string): Promise<{ chat: Chat; messages: ChatMessage[] }> =>
  read(() => ({
    chat: find(state.chats, (c) => c.id === chatId, "Chat"),
    messages: state.messages
      .filter((m) => m.chat_id === chatId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));

const TURN_STEPS = [
  "Reading growth ledger",
  "Planning change",
  "Editing site",
  "Running checks",
  "Deploying",
];
const STEP_MS = 1000;

function finishTurn(chatId: string, message: ChatMessage, asksFounder: boolean) {
  const turn = message.turn!;
  const company = find(
    state.companies,
    (c) => c.id === find(state.chats, (ch) => ch.id === chatId, "Chat").company_id,
    "Company",
  );
  turn.status = "completed";
  turn.ended_at = new Date().toISOString();
  turn.cost_usd = asksFounder ? 0.06 : 0.31;
  if (asksFounder) {
    turn.outcome = "asked_founder";
    state.asks.push({
      id: newId("ask"),
      company_id: company.id,
      title: "Need your input before I continue",
      question: "I need a decision from you before I can go further. Which option do you prefer?",
      priority: "normal",
      suggested_reply: "Go with your recommendation.",
      status: "open",
      answer: null,
    });
    message.text = "I need an answer from you first. I've added a question to your Inbox.";
    return;
  }
  turn.outcome = "shipped";
  turn.preview_url = `https://preview-${turn.id}.${new URL(company.live_url ?? "https://x.example.com").host}`;
  state.deployments
    .filter((d) => d.company_id === company.id && d.status === "live")
    .forEach((d) => (d.status = "superseded"));
  state.deployments.push({
    id: newId("d"),
    company_id: company.id,
    commit_sha: newSha(),
    status: "live",
    url: company.live_url ?? "",
    trigger: "turn_end",
    build_log_tail: "Build completed in 38s\nUploaded 130 files\nRoutes verified",
    created_at: turn.ended_at,
    turn_id: turn.id,
  });
  message.text = "Done. The change is live and ready to review.";
}

function runTurn(chatId: string, message: ChatMessage, labels: string[], asksFounder: boolean) {
  const turn = message.turn!;
  labels.slice(1).forEach((label, i) => {
    setTimeout(
      () => {
        turn.steps[i].status = "done";
        turn.steps.push({ label, status: "running" });
      },
      (i + 1) * STEP_MS,
    );
  });
  setTimeout(() => {
    turn.steps[turn.steps.length - 1].status = "done";
    finishTurn(chatId, message, asksFounder);
  }, labels.length * STEP_MS);
}

// Returns the agent message immediately; its turn progresses in the background.
export async function sendFounderMessage(chatId: string, text: string): Promise<ChatMessage> {
  await delay();
  find(state.chats, (c) => c.id === chatId, "Chat");
  const now = new Date().toISOString();
  const asksFounder = text.includes("?") || /\bdomain\b/i.test(text);
  const labels = asksFounder ? TURN_STEPS.slice(0, 3) : TURN_STEPS;
  const turn: Turn = {
    id: newId("t"),
    status: "running",
    steps: [{ label: labels[0], status: "running" }],
    outcome: null,
    preview_url: null,
    cost_usd: 0,
    started_at: now,
    ended_at: null,
  };
  state.messages.push({ id: newId("m"), chat_id: chatId, role: "founder", text, created_at: now });
  const agent: ChatMessage = {
    id: newId("m"),
    chat_id: chatId,
    role: "agent",
    text: "On it. I'll update you when this turn finishes.",
    created_at: new Date(Date.now() + 1).toISOString(),
    turn,
  };
  state.messages.push(agent);
  runTurn(chatId, agent, labels, asksFounder);
  return structuredClone(agent);
}

export const getGrowth = (
  companyId: string,
): Promise<{ ledger: GrowthLedger; steps: GrowthStep[] }> =>
  read(() => ({
    ledger: find(state.ledgers, (l) => l.company_id === companyId, "Growth ledger"),
    steps: state.steps.filter((s) => s.company_id === companyId),
  }));

export const listInbox = (companyId: string): Promise<MailMessage[]> =>
  read(() =>
    state.mail
      .filter((m) => m.company_id === companyId && m.direction === "in")
      .sort((a, b) => (b.received_at ?? "").localeCompare(a.received_at ?? "")),
  );

// All outbound mail (draft, approved, sent, rejected). Screens filter by status.
export const listDrafts = (companyId: string): Promise<MailMessage[]> =>
  read(() => state.mail.filter((m) => m.company_id === companyId && m.direction === "out"));

async function changeDraft(id: string, change: (m: MailMessage) => void): Promise<MailMessage> {
  await delay();
  const mail = find(state.mail, (m) => m.id === id && m.direction === "out", "Draft");
  change(mail);
  return structuredClone(mail);
}

export const approveDraft = (id: string) =>
  changeDraft(id, (m) => {
    m.status = "approved";
  });

export const rejectDraft = (id: string) =>
  changeDraft(id, (m) => {
    m.status = "rejected";
  });

export const updateDraft = (id: string, patch: { subject?: string; body_text?: string }) =>
  changeDraft(id, (m) => Object.assign(m, patch));

export const listAsks = (companyId: string): Promise<FounderAsk[]> =>
  read(() => state.asks.filter((a) => a.company_id === companyId));

export async function answerAsk(id: string, answer: string): Promise<FounderAsk> {
  await delay();
  const ask = find(state.asks, (a) => a.id === id, "Ask");
  ask.status = "answered";
  ask.answer = answer;
  return structuredClone(ask);
}

export const listDeployments = (companyId: string): Promise<Deployment[]> =>
  read(() => state.deployments.filter((d) => d.company_id === companyId).sort(byNewest));

// Makes the chosen deployment live and supersedes the current live one.
export async function rollbackDeployment(id: string): Promise<Deployment> {
  await delay();
  const target = find(state.deployments, (d) => d.id === id, "Deployment");
  if (target.status !== "live" && target.status !== "superseded") {
    throw new Error("Only live or superseded deployments can be rolled back to");
  }
  state.deployments
    .filter((d) => d.company_id === target.company_id && d.status === "live")
    .forEach((d) => (d.status = "superseded"));
  target.status = "live";
  return structuredClone(target);
}

export const listDomains = (companyId: string): Promise<Domain[]> =>
  read(() => state.domains.filter((d) => d.company_id === companyId));

export const listPurchaseRequests = (companyId: string): Promise<PurchaseRequest[]> =>
  read(() => state.purchases.filter((p) => p.company_id === companyId));
