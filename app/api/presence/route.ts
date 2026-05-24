import { NextRequest, NextResponse } from 'next/server';

type Presence = {
  id: string;
  name: string;
  signal: string;
  bio: string;
  tags: string[];
  status: string;
  lat: number;
  lng: number;
  radius: number;
  updatedAt: number;
};

type PresenceStore = Map<string, Presence>;

const TTL_MS = 1000 * 60 * 12;

function store() {
  const globalStore = globalThis as typeof globalThis & { normPresence?: PresenceStore };
  if (!globalStore.normPresence) globalStore.normPresence = new Map();
  return globalStore.normPresence;
}

function text(value: unknown, fallback: string, max = 120) {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, max);
}

function tags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((tag) => text(tag, '', 24)).filter(Boolean).slice(0, 6);
}

function number(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function prune() {
  const now = Date.now();
  for (const [id, person] of store()) {
    if (now - person.updatedAt > TTL_MS) store().delete(id);
  }
}

export async function GET(request: NextRequest) {
  prune();
  const params = request.nextUrl.searchParams;
  const lat = number(params.get('lat'), 0);
  const lng = number(params.get('lng'), 0);
  const radius = Math.min(number(params.get('radius'), 5), 50);
  const exclude = params.get('exclude') || '';

  const people = Array.from(store().values())
    .filter((person) => person.id !== exclude)
    .map((person) => ({
      id: person.id,
      name: person.name,
      signal: person.signal,
      bio: person.bio,
      tags: person.tags,
      status: person.status,
      updatedAt: person.updatedAt,
      distanceMiles: lat && lng ? milesBetween(lat, lng, person.lat, person.lng) : null
    }))
    .filter((person) => person.distanceMiles === null || person.distanceMiles <= radius)
    .sort((a, b) => (a.distanceMiles || 0) - (b.distanceMiles || 0));

  return NextResponse.json({ people, count: people.length });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const id = text(body.id, '', 80);
  const lat = number(body.lat, NaN);
  const lng = number(body.lng, NaN);

  if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Missing profile id or location.' }, { status: 400 });
  }

  store().set(id, {
    id,
    name: text(body.name, 'Builder', 48),
    signal: text(body.signal, 'Builder', 48),
    bio: text(body.bio, 'Open to connect.', 180),
    tags: tags(body.tags),
    status: text(body.status, 'Open to connect', 80),
    lat: Math.round(lat * 10000) / 10000,
    lng: Math.round(lng * 10000) / 10000,
    radius: Math.min(number(body.radius, 5), 50),
    updatedAt: Date.now()
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (id) store().delete(id);
  return NextResponse.json({ ok: true });
}
