import { NextRequest, NextResponse } from 'next/server';

type SocialLinks = {
  instagram?: string;
  x?: string;
  linkedin?: string;
  website?: string;
};

type ConnectRequest = {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  fromPhone: string;
  fromBuilding: string;
  fromSignal: string;
  fromSocials: SocialLinks;
  toName?: string;
  toPhone?: string;
  message: string;
  createdAt: number;
};

type ConnectionStore = Map<string, ConnectRequest[]>;

type PresenceLike = {
  id: string;
  realName?: string;
  phone?: string;
  building?: string;
  signal?: string;
  socials?: SocialLinks;
};

type PresenceStore = Map<string, PresenceLike>;

const TTL_MS = 1000 * 60 * 60;

function connectionStore() {
  const globalStore = globalThis as typeof globalThis & { normConnections?: ConnectionStore };
  if (!globalStore.normConnections) globalStore.normConnections = new Map();
  return globalStore.normConnections;
}

function presenceStore() {
  const globalStore = globalThis as typeof globalThis & { normPresence?: PresenceStore };
  if (!globalStore.normPresence) globalStore.normPresence = new Map();
  return globalStore.normPresence;
}

function clean(value: unknown, fallback: string, max = 160) {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, max);
}

function socialLinks(value: unknown): SocialLinks {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  return {
    instagram: clean(source.instagram, '', 90),
    x: clean(source.x, '', 90),
    linkedin: clean(source.linkedin, '', 120),
    website: clean(source.website, '', 120)
  };
}

function prune() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, requests] of connectionStore()) {
    const active = requests.filter((connection) => connection.createdAt > cutoff);
    if (active.length) connectionStore().set(id, active);
    else connectionStore().delete(id);
  }
}

function addRequest(userId: string, connectionRequest: ConnectRequest) {
  const current = connectionStore().get(userId) || [];
  const withoutDuplicate = current.filter((item) => item.id !== connectionRequest.id);
  connectionStore().set(userId, [connectionRequest, ...withoutDuplicate].slice(0, 24));
}

export async function GET(request: NextRequest) {
  prune();
  const id = request.nextUrl.searchParams.get('id') || '';
  const requests = connectionStore().get(id) || [];
  return NextResponse.json({ requests });
}

export async function POST(request: NextRequest) {
  prune();
  const body = await request.json();
  const toId = clean(body.toId, '', 90);
  const fromId = clean(body.fromId, '', 90);
  const target = presenceStore().get(toId);

  if (!toId || !fromId) {
    return NextResponse.json({ error: 'Missing sender or receiver.' }, { status: 400 });
  }

  const fromName = clean(body.fromName, 'Builder', 60);
  const fromPhone = clean(body.fromPhone, '', 32);
  const fromBuilding = clean(body.fromBuilding, 'Building something real.', 160);
  const fromSignal = clean(body.fromSignal, 'Builder', 48);
  const toName = clean(target?.realName, clean(body.toName, 'Nearby builder', 60), 60);
  const toPhone = clean(target?.phone, clean(body.toPhone, '', 32), 32);

  if (!fromPhone) {
    return NextResponse.json({ error: 'Add your phone number before connecting.' }, { status: 400 });
  }

  const connectionRequest: ConnectRequest = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fromId,
    toId,
    fromName,
    fromPhone,
    fromBuilding,
    fromSignal,
    fromSocials: socialLinks(body.fromSocials),
    toName,
    toPhone,
    message: clean(body.message, `${fromName} connected with you on Norm. Phone numbers are now shared.`, 240),
    createdAt: Date.now()
  };

  addRequest(toId, connectionRequest);
  addRequest(fromId, connectionRequest);

  return NextResponse.json({ ok: true, request: connectionRequest });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') || '';
  if (id) connectionStore().delete(id);
  return NextResponse.json({ ok: true });
}
