export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  sizes: string[];
  colors: string[];
  materials: string;
  care: string;
  availability: string;
  gradient: [string, string];
}

export type OrderStatus = "processing" | "shipped" | "delivered";

export interface OrderItem {
  name: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
}

export interface Order {
  order_number: string;
  customer_name: string;
  email: string;
  placed_at: string;
  status: OrderStatus;
  total: number;
  items: OrderItem[];
  shipping_method: string;
  carrier: string | null;
  tracking_number: string | null;
  estimated_delivery: string;
  events: { status: string; date: string }[];
}

/** Server-sent events emitted by POST /api/chat. */
export type ChatEvent =
  | { type: "token"; text: string }
  | { type: "sources"; sources: string[] }
  | { type: "order"; order: Order }
  | { type: "handoff"; question: string }
  | { type: "error"; message: string }
  | { type: "done" };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  order?: Order;
  handoff?: { question: string; status: "open" | "submitted" };
  error?: boolean;
  streaming?: boolean;
}

export interface Stats {
  conversations: number;
  questions_answered: number;
  handoffs: number;
  answer_rate: number;
}

export interface KnowledgeDoc {
  name: string;
  title: string;
  type: string;
  size: number;
  chunks: number;
  editable: boolean;
}

export interface Lead {
  id: number;
  session_id: string | null;
  name: string;
  email: string;
  question: string;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  created_at: string;
  last_at: string;
  message_count: number;
  first_question: string | null;
}

export interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
  kind: string;
  created_at: string;
}

export interface ReindexEvent {
  stage: "start" | "indexing" | "done" | "error";
  file?: string;
  done?: number;
  total?: number;
  chunks?: number;
  message?: string;
}
