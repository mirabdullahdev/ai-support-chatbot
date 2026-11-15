import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/progress";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";

/** Flat, muted stand-ins for product photography. */
const TONES = ["#e6e0d6", "#d9d3c8", "#ebe6de", "#d4cdc1", "#e0dad0", "#cfc8bb"];

function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <a href="/" className="font-display text-2xl leading-none">Nova Threads</a>
        <nav className="hidden items-center gap-9 text-sm text-muted-foreground md:flex">
          {["New in", "Women", "Men", "Accessories"].map((l) => (
            <a key={l} href="#shop" className="transition-colors hover:text-foreground">{l}</a>
          ))}
        </nav>
        <a href="#shop" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Bag (0)</a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="container grid items-end gap-10 pb-20 pt-16 md:grid-cols-12 md:pb-28 md:pt-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="md:col-span-7"
      >
        <h1 className="font-display text-[3.25rem] leading-[1.02] sm:text-7xl lg:text-[5.5rem]">
          Everyday basics,
          <br />
          <span className="italic">made to last.</span>
        </h1>
        <p className="mt-7 max-w-md text-base leading-relaxed text-muted-foreground">
          Relaxed pieces in organic cotton, linen and merino. Free shipping over $50, and 30 days to change your mind.
        </p>
        <a
          href="#shop"
          className="mt-9 inline-block border-b border-foreground pb-1 text-sm font-medium transition-opacity hover:opacity-60"
        >
          Shop the collection
        </a>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.15 }}
        className="md:col-span-5"
      >
        <div className="aspect-[4/5] w-full rounded-sm" style={{ backgroundColor: TONES[1] }} />
        <p className="mt-3 flex justify-between text-sm">
          <span>Cloud Fleece Hoodie</span>
          <span className="text-muted-foreground">$89</span>
        </p>
      </motion.div>
    </section>
  );
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: (index % 4) * 0.06 }}
    >
      <div className="aspect-[4/5] rounded-sm" style={{ backgroundColor: TONES[index % TONES.length] }} />
      <div className="mt-3 flex items-baseline justify-between gap-3 text-sm">
        <h3 className="font-medium">{product.name}</h3>
        <p className="text-muted-foreground">${product.price}</p>
      </div>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{product.colors.slice(0, 3).join(", ")}</p>
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
    <section id="shop" className="container scroll-mt-16 border-t py-16">
      <h2 className="mb-10 font-display text-4xl">The collection</h2>
      {failed ? (
        <p className="text-sm text-muted-foreground">Couldn't load products. Make sure the backend is running on port 8000.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {products
            ? products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)
            : Array.from({ length: 8 }, (_, i) => (
                <div key={i}>
                  <Skeleton className="aspect-[4/5] rounded-sm" />
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
    <footer className="border-t">
      <div className="container flex flex-col justify-between gap-2 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>Nova Threads, a fictional store built to demo an AI support assistant.</p>
        <a href="/admin" className="transition-colors hover:text-foreground">Admin</a>
      </div>
    </footer>
  );
}

export function Storefront() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <ProductGrid />
      <Footer />
    </div>
  );
}
