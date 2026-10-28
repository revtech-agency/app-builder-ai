import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { ANOMALY_LABELS, APPROVAL_LIMITS, PRICE_TOLERANCE } from "@/lib/invoice-rules";

export const Route = createFileRoute("/app/rules")({
  head: () => ({ meta: [{ title: "Approval rules — AppBuilder.ai" }] }),
  component: RulesPage,
});

const ROUTING = [
  "Same supplier and invoice number already in the system → Duplicate",
  "Supplier unknown or not approved → Needs review",
  "IBAN differs from the one on file, or changed within 30 days before the invoice → Needs review",
  "Several invoices from one supplier within 14 days that together pass an approval limit → Needs review",
  "A field read with confidence below 0.8 → Needs review",
  "A line not on the PO, or priced more than 2% off → Needs review",
  "More invoiced than delivered, no PO found, or tax certificate expired → Waiting on supplier",
  "Every check passed → Ready to approve, for the approver below",
];

function RulesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Approval rules</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The rules the invoice worker applies to every document. Read-only here; changing them
          means changing the worker.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who approves</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Invoice total</TableHead>
                <TableHead>Approver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="pl-6 tabular-nums">
                  Up to {formatMoney(APPROVAL_LIMITS.team_lead)}
                </TableCell>
                <TableCell>Team lead</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 tabular-nums">
                  Up to {formatMoney(APPROVAL_LIMITS.head_of_department)}
                </TableCell>
                <TableCell>Head of department</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 tabular-nums">
                  Above {formatMoney(APPROVAL_LIMITS.head_of_department)}
                </TableCell>
                <TableCell>CFO</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Three-way match</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Each invoice line is matched to its PO line and delivery note. Prices may differ by up
            to <span className="font-semibold">{PRICE_TOLERANCE * 100}%</span>; quantities can't
            exceed what was delivered.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {ROUTING.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flags the worker raises</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {Object.entries(ANOMALY_LABELS).map(([key, label]) => (
              <li key={key}>{label}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
