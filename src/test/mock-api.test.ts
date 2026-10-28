import { describe, expect, it } from "vitest";

import {
  approveDraft,
  listAsks,
  listDeployments,
  listDrafts,
  rollbackDeployment,
  sendFounderMessage,
} from "@/lib/api";

describe("mock api", () => {
  it("approveDraft changes the draft status", async () => {
    const before = (await listDrafts("co_lumen")).find((d) => d.status === "draft")!;

    await approveDraft(before.id);

    const after = (await listDrafts("co_lumen")).find((d) => d.id === before.id);
    expect(after?.status).toBe("approved");
  });

  it("rollbackDeployment marks the target live and supersedes the previous live one", async () => {
    const before = await listDeployments("co_lumen");
    const live = before.find((d) => d.status === "live")!;
    const target = before.find((d) => d.status === "superseded")!;

    await rollbackDeployment(target.id);

    const after = await listDeployments("co_lumen");
    expect(after.find((d) => d.id === target.id)?.status).toBe("live");
    expect(after.find((d) => d.id === live.id)?.status).toBe("superseded");
  });

  it("sendFounderMessage returns a running turn and a founder message with ? creates an ask", async () => {
    const asksBefore = (await listAsks("co_fieldkit")).length;

    const agent = await sendFounderMessage("chat_fieldkit", "Which domain should we use?");

    expect(agent.turn?.status).toBe("running");
    await new Promise((resolve) => setTimeout(resolve, 4500));
    expect((await listAsks("co_fieldkit")).length).toBe(asksBefore + 1);
  }, 10_000);
});
