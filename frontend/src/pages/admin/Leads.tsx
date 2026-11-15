import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function Leads() {
  const [leads, setLeads] = useState<Lead[] | null>(null);

  useEffect(() => {
    const load = () => api.leads().then(setLeads).catch(() => undefined);
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Handoff requests</CardTitle>
        <p className="text-sm text-muted-foreground">Customers the bot couldn't answer and passed to the team.</p>
      </CardHeader>
      {leads === null ? (
        <div className="space-y-2 p-5 pt-0">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 pb-12 pt-6 text-center text-sm text-muted-foreground">
          <Inbox className="size-8 opacity-50" /> No handoff requests yet.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Question</TableHead>
              <TableHead className="whitespace-nowrap">Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap">
                  <p className="font-medium">{l.name}</p>
                  <a href={`mailto:${l.email}`} className="text-xs underline underline-offset-2 hover:opacity-70">{l.email}</a>
                </TableCell>
                <TableCell className="min-w-[16rem] max-w-md">{l.question}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(l.created_at, true)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
