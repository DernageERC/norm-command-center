import { NextRequest, NextResponse } from 'next/server';

type SocialLinks = {
  instagram?: string;
  x?: string;
  linkedin?: string;
  website?: string;
};

type Presence = {
  id: string;
  realName: string;
  phone: string;
  bio: string;
  building: string;
  locationLabel: string;
  signal: string;
  tags: string[];
  socials: SocialLinks;
  lat: number;
  lng: number;
  radius: number;
  updatedAt: number;
};

type ConnectionRequest = {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  fromPhone: string;
  fromBuilding: string;
  fromSignal: string;
  fromSocials: SocialLinks;
  toName: string;
  toPhone: string;
  message: string;
  createdAt: number;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  fromId: string;
  toId: string;
  fromName: string;
  body: string;
  createdAt: number;
};

type LiveStore = {
  presence: Map<string, Presence>;
  connections: Map<string, ConnectionRequest[]>;
  chats: Map<string, ChatMessage[]>;
};

const PRESENCE_TTL_MS = 1000 * 60 * 15;
const CONNECTION_TTL_MS = 1000 * 60 * 60 * 24;
const CHAT_TTL_MS = 1000 * 60 * 60 * 24;

function liveStore() {
  const globalStore = globalThis as typeof globalThis & { normLive?: LiveStore };
  if (!globalStore.normLive) {
    globalStore.normLive = {
      presence: new Map(),
      connections: new Map(),
      chats: new Map()
    };
  }
  return globalStore.normLive;
}

function clean(value: unknown, fallback: string, max = 180) {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, max);
}

function number(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function tags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((tag) => clean(tag, '', 28)).filter(Boolean).slice(0, 8);
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

function conversationIdFor(a: string, b: string) {
  return [a, b].sort().join('__');
}

function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radius = 3958.8;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function safePresence(person: Presence, lat: number, lng: number) {
  return {
    id: person.id,
    realName: person.realName,
    bio: person.bio,
    building: person.building,
    locationLabel: person.locationLabel,
    signal: person.signal,
    tags: person.tags,
    socials: person.socials,
    lat: person.lat,
    lng: person.lng,
    radius: person.radius,
    updatedAt: person.updatedAt,
    distanceMiles: lat && lng ? milesBetween(lat, lng, person.lat, person.lng) : null
  };
}

function prune() {
  const now = Date.now();
  const store = liveStore();

  for (const [id, person] of store.presence) {
    if (now - person.updatedAt > PRESENCE_TTL_MS) store.presence.delete(id);
  }

  const connectionCutoff = now - CONNECTION_TTL_MS;
  for (const [id, requests] of store.connections) {
    const active = requests.filter((connection) => connection.createdAt > connectionCutoff);
    if (active.length) store.connections.set(id, active);
    else store.connections.delete(id);
  }

  const chatCutoff = now - CHAT_TTL_MS;
  for (const [id, messages] of store.chats) {
    const active = messages.filter((message) => message.createdAt > chatCutoff);
    if (active.length) store.chats.set(id, active);
    else store.chats.delete(id);
  }
}

function addConnection(userId: string, connection: ConnectionRequest) {
  const store = liveStore();
  const current = store.connections.get(userId) || [];
  const withoutDuplicate = current.filter((item) => item.id !== connection.id);
  store.connections.set(userId, [connection, ...withoutDuplicate].slice(0, 32));
}

function requireProfile(body: Record<string, unknown>) {
  const id = clean(body.id, '', 90);
  const realName = clean(body.realName, '', 60);
  const phone = clean(body.phone, '', 32);
  const bio = clean(body.bio, '', 240);
  const building = clean(body.building, '', 180);
  const lat = number(body.lat, NaN);
  const lng = number(body.lng, NaN);

  if (!id || !realName || !phone || !bio || !building || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    id,
    realName,
    phone,
    bio,
    building,
    lat,
    lng
  };
}

export async function POST(request: NextRequest) {
  prune();
  const body = (await request.json()) as Record<string, unknown>;
  const action = clean(body.action, '', 40);
  const store = liveStore();

  if (action === 'publish') {
    const required = requireProfile(body);
    if (!required) return NextResponse.json({ error: 'Missing required profile or location.' }, { status: 400 });

    store.presence.set(required.id, {
      ...required,
      locationLabel: clean(body.locationLabel, 'Current location', 90),
      signal: clean(body.signal, 'Builder', 48),
      tags: tags(body.tags),
      socials: socialLinks(body.socials),
      lat: Math.round(required.lat * 100000) / 100000,
      lng: Math.round(required.lng * 100000) / 100000,
      radius: Math.min(number(body.radius, 5), 50),
      updatedAt: Date.now()
    });

    return NextResponse.json({ ok: true });
  }

  if (action === 'nearby') {
    const lat = number(body.lat, 0);
    const lng = number(body.lng, 0);
    const radius = Math.min(number(body.radius, 5), 50);
    const exclude = clean(body.exclude, '', 90);

    const people = Array.from(store.presence.values())
      .filter((person) => person.id !== exclude)
      .map((person) => safePresence(person, lat, lng))
      .filter((person) => person.distanceMiles === null || person.distanceMiles <= radius)
      .sort((a, b) => (a.distanceMiles || 0) - (b.distanceMiles || 0));

    return NextResponse.json({ people, count: people.length });
  }

  if (action === 'disconnect') {
    const id = clean(body.id, '', 90);
    if (id) store.presence.delete(id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'connect') {
    const fromId = clean(body.fromId, '', 90);
    const toId = clean(body.toId, '', 90);
    const fromPhone = clean(body.fromPhone, '', 32);
    const target = store.presence.get(toId);

    if (!fromId || !toId || !fromPhone) {
      return NextResponse.json({ error: 'Missing sender, receiver, or phone number.' }, { status: 400 });
    }

    const fromName = clean(body.fromName, 'Builder', 60);
    const fromBuilding = clean(body.fromBuilding, 'Building something real.', 180);
    const fromSignal = clean(body.fromSignal, 'Builder', 48);
    const toName = target?.realName || clean(body.toName, 'Nearby builder', 60);
    const toPhone = target?.phone || clean(body.toPhone, '', 32);

    const connection: ConnectionRequest = {
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
      message: clean(body.message, `${fromName} connected with you on Norm. Phone numbers are now shared.`, 260),
      createdAt: Date.now()
    };

    addConnection(toId, connection);
    addConnection(fromId, connection);

    return NextResponse.json({ ok: true, connection });
  }

  if (action === 'inbox') {
    const id = clean(body.id, '', 90);
    return NextResponse.json({ requests: store.connections.get(id) || [] });
  }

  if (action === 'chat:get') {
    const a = clean(body.a, '', 90);
    const b = clean(body.b, '', 90);
    if (!a || !b) return NextResponse.json({ messages: [] });
    const conversationId = conversationIdFor(a, b);
    return NextResponse.json({ messages: store.chats.get(conversationId) || [] });
  }

  if (action === 'chat:send') {
    const fromId = clean(body.fromId, '', 90);
    const toId = clean(body.toId, '', 90);
    const bodyText = clean(body.body, '', 500);
    if (!fromId || !toId || !bodyText) return NextResponse.json({ error: 'Missing chat details.' }, { status: 400 });

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

    const current = store.chats.get(conversationId) || [];
    store.chats.set(conversationId, [...current, message].slice(-80));
    return NextResponse.json({ ok: true, message });
  }

  return NextResponse.json({ error: 'Unknown live action.' }, { status: 400 });
}
