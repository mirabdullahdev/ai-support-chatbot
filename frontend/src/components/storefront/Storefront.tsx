import { motion } from "framer-motion";
import { ArrowRight, Leaf, RefreshCw, Search, ShoppingBag, Shirt, Truck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/progress";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";

function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 font-display text-lg font-bold">
          <span className="flex size-8 items-center justify-center rounded-xl bg-brand-gradient text-white">
            <Shirt className="size-4" />
          </span>
          Nova Threads
        </a>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          {["New in", "Women", "Men", "Accessories", "Sale"].map((l) => (
            <a key={l} href="#shop" className="transition hover:text-foreground">{l}</a>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Search"><Search /></Button>
          <Button variant="ghost" size="icon" aria-label="Bag"><ShoppingBag /></Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute -right-32 -top-32 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute -bottom-32 left-0 size-[24rem] rounded-full bg-accent/15 blur-3xl" />
      <div className="container relative grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="size-1.5 rounded-full bg-accent" /> Autumn collection is here
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            Everyday basics,<br />
            <span className="text-brand-gradient">made to last.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Relaxed, well-made pieces in organic cotton, linen and merino. Free shipping over $50 and 30-day returns.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" variant="gradient" asChild>
              <a href="#shop">Shop the collection <ArrowRight /></a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#shop">Our story</a>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-4"
        >
          <div className="aspect-[3/4] rounded-3xl bg-gradient-to-br from-violet-200 to-fuchsia-300 shadow-soft" />
          <div className="mt-10 aspect-[3/4] rounded-3xl bg-gradient-to-br from-rose-200 to-amber-200 shadow-soft" />
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-2xl border bg-card/95 px-4 py-3 shadow-float backdrop-blur">
            <Shirt className="size-6 text-primary" />
            <div>
              <p className="text-sm font-semibold">Cloud Fleece Hoodie</p>
              <p className="text-xs text-muted-foreground">$89 · 3 colors</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Perks() {
  const perks = [
    { icon: Truck, title: "Free shipping over $50", text: "Fast delivery across the US" },
    { icon: RefreshCw, title: "30-day returns", text: "Free domestic return labels" },
    { icon: Leaf, title: "Natural fabrics", text: "Organic cotton, linen, merino" },
  ];
  return (
    <section className="border-y bg-card">
      <div className="container grid gap-6 py-6 sm:grid-cols-3">
        {perks.map((p) => (
          <div key={p.title} className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><p.icon className="size-5" /></span>
            <div>
              <p className="text-sm font-semibold">{p.title}</p>
              <p className="text-xs text-muted-foreground">{p.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: (index % 4) * 0.07 }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <div
        className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl shadow-soft"
        style={{ backgroundImage: `linear-gradient(135deg, ${product.gradient[0]}, ${product.gradient[1]})` }}
      >
        <Shirt className="size-16 text-white/70 transition duration-500 group-hover:scale-110" strokeWidth={1.2} />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium shadow-sm">{product.category}</span>
        <Button size="sm" variant="secondary" className="absolute bottom-3 left-3 right-3 translate-y-3 bg-white/95 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
          Quick add
        </Button>
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{product.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{product.colors.slice(0, 3).join(" · ")}</p>
        </div>
        <p className="text-sm font-semibold">${product.price}</p>
      </div>
    </motion.article>
  );
}

function ProductGrid() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.products().then(setProducts).catch(() => setFailed(true));
  }, []);

  return (
    <section id="shop" className="container scroll-mt-20 py-16">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold">Shop the collection</h2>
          <p className="mt-1 text-muted-foreground">Twelve staples, no filler.</p>
        </div>
      </div>
      {failed ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Couldn't load products. Make sure the backend is running on port 8000.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {products
            ? products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)
            : Array.from({ length: 8 }, (_, i) => (
                <div key={i}>
                  <Skeleton className="aspect-[4/5] rounded-2xl" />
                  <Skeleton className="mt-3 h-4 w-3/4" />
                </div>
              ))}
        </div>
      )}
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container flex flex-col items-center justify-between gap-3 py-8 text-sm text-muted-foreground sm:flex-row">
        <p className="font-display font-semibold text-foreground">Nova Threads</p>
        <p>A fictional store built to demo an AI support chatbot.</p>
        <a href="/admin" className="font-medium text-primary hover:underline">Admin dashboard</a>
      </div>
    </footer>
  );
}

export function Storefront() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Perks />
      <ProductGrid />
      <Footer />
    </div>
  );
}
