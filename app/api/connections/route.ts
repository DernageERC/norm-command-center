import { NextRequest, NextResponse } from 'next/server';

type ConnectRequest = {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  fromSignal: string;
  message: string;
  createdAt: number;
};

type ConnectionStore = Map<string, ConnectRequest[]>;

const TTL_MS = 1000 * 60 * 30;

function store() {
  const globalStore = globalThis as typeof globalThis & { normConnections?: ConnectionStore };
  if (!globalStore.normConnections) globalStore.normConnections = new Map();
  return globalStore.normConnections;
}

function clean(value: unknown, fallback: string, max = 160) {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, max);
}

function prune() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, requests] of store()) {
    const active = requests.filter((connection) => connection.createdAt > cutoff);
    if (active.length) store().set(id, active);
    else store().delete(id);
  }
}

export async function GET(request: NextRequest) {
  prune();
  const id = request.nextUrl.searchParams.get('id') || '';
  const requests = store().get(id) || [];
  return NextResponse.json({ requests });
}

export async function POST(request: NextRequest) {
  prune();
  const body = await request.json();
  const toId = clean(body.toId, '', 80);
  const fromId = clean(body.fromId, '', 80);

  if (!toId || !fromId) {
    return NextResponse.json({ error: 'Missing sender or receiver.' }, { status: 400 });
  }

  const connectionRequest: ConnectRequest = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fromId,
    toId,
    fromName: clean(body.fromName, 'Builder', 48),
    fromSignal: clean(body.fromSignal, 'Builder', 48),
    message: clean(body.message, 'Want to connect through Norm?', 220),
    createdAt: Date.now()
  };

  const current = store().get(toId) || [];
  store().set(toId, [connectionRequest, ...current].slice(0, 12));

  return NextResponse.json({ ok: true, request: connectionRequest });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') || '';
  if (id) store().delete(id);
  return NextResponse.json({ ok: true });
}
