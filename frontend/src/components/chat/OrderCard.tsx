import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { cn, formatDay } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";

const STEPS = [
  { key: "placed", label: "Placed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
] as const;

const STATUS_INDEX: Record<OrderStatus, number> = { processing: 1, shipped: 2, delivered: 3 };

export function OrderCard({ order }: { order: Order }) {
  const [copied, setCopied] = useState(false);
  const current = STATUS_INDEX[order.status];
  const dateFor = (key: string) => order.events.find((e) => e.status === key)?.date;

  const copy = async () => {
    if (!order.tracking_number) return;
    try {
      await navigator.clipboard.writeText(order.tracking_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-3 w-full rounded-lg border bg-card"
      data-testid="order-card"
    >
      <div className="flex items-baseline justify-between gap-2 px-4 pt-4">
        <p className="font-medium">{order.order_number}</p>
        <p className="text-sm capitalize text-muted-foreground">{order.status}</p>
      </div>

      {/* Status timeline */}
      <div className="px-4 pb-1 pt-5">
        <div className="relative flex justify-between">
          <div className="absolute left-2 right-2 top-[5px] h-px bg-border" />
          <motion.div
            className="absolute left-2 top-[5px] h-px bg-foreground"
            initial={{ width: 0 }}
            animate={{ width: `calc((100% - 1rem) * ${current / (STEPS.length - 1)})` }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          />
          {STEPS.map((step, i) => {
            const date = dateFor(step.key);
            return (
              <div key={step.key} className="relative flex w-14 flex-col items-center text-center">
                <span className={cn("size-[11px] rounded-full border bg-card", i <= current ? "border-foreground bg-foreground" : "border-input")} />
                <span className={cn("mt-2 text-[11px]", i <= current ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
                <span className="text-[10px] text-muted-foreground">{date ? formatDay(date) : " "}</span>
              </div>
            );
          })}
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 border-t px-4 py-3">
        {order.items.map((item) => (
          <li key={`${item.name}-${item.size}-${item.color}`} className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate">
              {item.quantity} × {item.name}
              <span className="text-muted-foreground">, {item.color}, {item.size}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">${item.price.toFixed(2)}</span>
          </li>
        ))}
      </ul>

      <dl className="space-y-1.5 border-t px-4 py-3 text-[13px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">{order.carrier ? `${order.carrier} tracking` : "Tracking"}</dt>
          <dd>
            {order.tracking_number ? (
              <button onClick={copy} className="inline-flex items-center gap-1.5 font-mono text-xs transition-opacity hover:opacity-60" aria-label="Copy tracking number">
                {order.tracking_number}
                {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3 text-muted-foreground" />}
              </button>
            ) : (
              <span className="text-muted-foreground">Emailed once shipped</span>
            )}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{order.status === "delivered" ? "Delivered" : "Estimated delivery"}</dt>
          <dd>{formatDay(order.status === "delivered" ? dateFor("delivered") ?? order.estimated_delivery : order.estimated_delivery)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="font-medium">${order.total.toFixed(2)}</dd>
        </div>
      </dl>
    </motion.div>
  );
}
