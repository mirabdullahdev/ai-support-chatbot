import { motion } from "framer-motion";
import { Check, Copy, PackageCheck, PackageOpen, Truck, ReceiptText } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn, formatDay } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";

const STEPS = [
  { key: "placed", label: "Placed", icon: ReceiptText },
  { key: "processing", label: "Processing", icon: PackageOpen },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: PackageCheck },
] as const;

const STATUS_INDEX: Record<OrderStatus, number> = { processing: 1, shipped: 2, delivered: 3 };
const STATUS_BADGE: Record<OrderStatus, "warning" | "info" | "success"> = { processing: "warning", shipped: "info", delivered: "success" };

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
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="mt-2 w-full overflow-hidden rounded-2xl border bg-card shadow-soft"
      data-testid="order-card"
    >
      <div className="flex items-center justify-between gap-2 bg-secondary/60 px-4 py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Order</p>
          <p className="font-display text-sm font-semibold">{order.order_number}</p>
        </div>
        <Badge variant={STATUS_BADGE[order.status]} className="capitalize">
          {order.status}
        </Badge>
      </div>

      {/* Status timeline */}
      <div className="px-4 pt-4">
        <div className="relative flex justify-between">
          <div className="absolute left-4 right-4 top-4 h-0.5 bg-border" />
          <motion.div
            className="absolute left-4 top-4 h-0.5 bg-brand-gradient"
            initial={{ width: 0 }}
            animate={{ width: `calc((100% - 2rem) * ${current / (STEPS.length - 1)})` }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          />
          {STEPS.map((step, i) => {
            const done = i <= current;
            const date = dateFor(step.key);
            return (
              <div key={step.key} className="relative z-10 flex w-16 flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 300 }}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 bg-card",
                    done ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                    i === current && "ring-4 ring-primary/20",
                  )}
                >
                  <step.icon className="size-4" />
                </motion.div>
                <span className={cn("mt-1.5 text-[11px] font-medium", done ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
                <span className="text-[10px] text-muted-foreground">{date ? formatDay(date) : " "}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items */}
      <ul className="mt-3 space-y-1.5 px-4">
        {order.items.map((item) => (
          <li key={`${item.name}-${item.size}-${item.color}`} className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate">
              <span className="font-medium">{item.quantity}x {item.name}</span>
              <span className="text-muted-foreground"> · {item.color}, {item.size}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">${item.price.toFixed(2)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-2 border-t bg-muted/40 px-4 py-3 text-xs">
        {order.tracking_number ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{order.carrier} tracking</span>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 rounded-md bg-card px-2 py-1 font-mono text-[11px] font-medium shadow-sm transition hover:bg-secondary"
              aria-label="Copy tracking number"
            >
              {order.tracking_number}
              {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3 text-muted-foreground" />}
            </button>
          </div>
        ) : (
          <p className="text-muted-foreground">Tracking number will be emailed once your order ships.</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{order.status === "delivered" ? "Delivered" : "Estimated delivery"}</span>
          <span className="font-medium">{formatDay(order.status === "delivered" ? dateFor("delivered") ?? order.estimated_delivery : order.estimated_delivery)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total ({order.shipping_method})</span>
          <span className="font-semibold">${order.total.toFixed(2)}</span>
        </div>
      </div>
    </motion.div>
  );
}
