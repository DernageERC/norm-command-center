import { NextRequest, NextResponse } from 'next/server';

type ChatMessage = {
  id: string;
  conversationId: string;
  fromId: string;
  toId: string;
  fromName: string;
  body: string;
  createdAt: number;
};

type ChatStore = Map<string, ChatMessage[]>;

const TTL_MS = 1000 * 60 * 60 * 6;

function store() {
  const globalStore = globalThis as typeof globalThis & { normChats?: ChatStore };
  if (!globalStore.normChats) globalStore.normChats = new Map();
  return globalStore.normChats;
}

function clean(value: unknown, fallback: string, max = 500) {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, max);
}

function conversationIdFor(a: string, b: string) {
  return [a, b].sort().join('__');
}

function prune() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, messages] of store()) {
    const active = messages.filter((message) => message.createdAt > cutoff);
    if (active.length) store().set(id, active);
    else store().delete(id);
  }
}

export async function GET(request: NextRequest) {
  prune();
  const params = request.nextUrl.searchParams;
  const a = clean(params.get('a'), '', 90);
  const b = clean(params.get('b'), '', 90);

  if (!a || !b) return NextResponse.json({ messages: [] });

  const conversationId = conversationIdFor(a, b);
  return NextResponse.json({ messages: store().get(conversationId) || [] });
}

export async function POST(request: NextRequest) {
  prune();
  const body = await request.json();
  const fromId = clean(body.fromId, '', 90);
  const toId = clean(body.toId, '', 90);
  const bodyText = clean(body.body, '', 500);

  if (!fromId || !toId || !bodyText) {
    return NextResponse.json({ error: 'Missing chat details.' }, { status: 400 });
  }

  const conversationId = conversationIdFor(fromId, toId);
  const message: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    conversationId,
    fromId,
    toId,
    fromName: clean(body.fromName, 'Builder', 80),
    body: bodyText,
    createdAt: Date.now()
  };

  const current = store().get(conversationId) || [];
  store().set(conversationId, [...current, message].slice(-60));

  return NextResponse.json({ ok: true, message });
}
