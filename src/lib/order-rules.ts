// Pure order rules shared by the placeOrder server function and the cart UI.
// They mirror the email order worker: whole packs only, minimum pack counts, stock and
// delivery-date checks, and an overdue-payment hold.

export type OrderStage = "ready" | "waiting" | "staff";

export const PIPELINE_ID = "4275310781";

// The UI counts in pieces of 100 m; the cart and orders themselves are still in metres.
export const PIECE_METRES = 100;

export const formatPieces = (metres: number) => String(Number((metres / PIECE_METRES).toFixed(2)));

// HubSpot deal stage id -> stable key (also the StatusBadge key) and label.
export const STAGES: Record<string, { key: string; label: string }> = {
  "6315918553": { key: "received", label: "Received" },
  "6315918554": { key: "waiting_on_client", label: "Waiting on client" },
  "6315918555": { key: "needs_staff", label: "Needs staff" },
  "6315918556": { key: "ready_to_confirm", label: "Ready to confirm" },
  "6315918557": { key: "confirmed", label: "Confirmed" },
  "6315918558": { key: "duplicate", label: "Duplicate" },
  "6315918559": { key: "rejected", label: "Rejected" },
};

export const STAGE_IDS: Record<OrderStage, string> = {
  ready: "6315918556",
  waiting: "6315918554",
  staff: "6315918555",
};

const RANK: Record<OrderStage, number> = { ready: 0, waiting: 1, staff: 2 };

export function worstStage(a: OrderStage, b: OrderStage): OrderStage {
  return RANK[b] > RANK[a] ? b : a;
}

export type LineInput = {
  metres: number;
  unitsPerPack: number;
  minSalePacks?: number | null | undefined;
  packType?: string | null | undefined;
  stockPacks?: number | null | undefined;
};

export type LineEvaluation = {
  packs: number;
  packMetres: number;
  // Set when the metres asked for don't match whole packs, e.g. "30 m rounded up to 1 reel (50 m)".
  roundingNote: string | null;
  stockNote: string | null;
  stage: OrderStage;
};

export function packsFor(
  metres: number,
  unitsPerPack: number,
  minSalePacks?: number | null | undefined,
) {
  const unit = unitsPerPack > 0 ? unitsPerPack : 1;
  return Math.max(Math.ceil(metres / unit - 1e-9), minSalePacks ?? 0, 1);
}

export function evaluateLine(line: LineInput): LineEvaluation {
  const unit = line.unitsPerPack > 0 ? line.unitsPerPack : 1;
  const packs = packsFor(line.metres, unit, line.minSalePacks);
  const packMetres = packs * unit;
  const rounded = Math.abs(packMetres - line.metres) > 1e-9;
  const packType = line.packType || "pack";
  const roundingNote = rounded
    ? `${line.metres} m rounded up to ${packs} ${packType}s (${packMetres} m)`
    : null;
  const stockNote =
    line.stockPacks != null && line.stockPacks < packs ? `only ${line.stockPacks} in stock` : null;
  return {
    packs,
    packMetres,
    roundingNote,
    stockNote,
    stage: roundingNote || stockNote ? "waiting" : "ready",
  };
}

export function orderStage(
  evaluations: LineEvaluation[],
  hasDeliveryDate: boolean,
  paymentStatus?: string | null,
): OrderStage {
  let stage: OrderStage = hasDeliveryDate ? "ready" : "waiting";
  for (const e of evaluations) stage = worstStage(stage, e.stage);
  if (paymentStatus === "overdue") stage = worstStage(stage, "staff");
  return stage;
}
