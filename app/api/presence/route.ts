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

type PresenceStore = Map<string, Presence>;

const TTL_MS = 1000 * 60 * 15;

function store() {
  const globalStore = globalThis as typeof globalThis & { normPresence?: PresenceStore };
  if (!globalStore.normPresence) globalStore.normPresence = new Map();
  return globalStore.normPresence;
}

function text(value: unknown, fallback: string, max = 160) {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, max);
}

function tags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((tag) => text(tag, '', 28)).filter(Boolean).slice(0, 8);
}

function socialLinks(value: unknown): SocialLinks {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  return {
    instagram: text(source.instagram, '', 90),
    x: text(source.x, '', 90),
    linkedin: text(source.linkedin, '', 120),
    website: text(source.website, '', 120)
  };
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

function safePerson(person: Presence, lat: number, lng: number) {
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
    .map((person) => safePerson(person, lat, lng))
    .filter((person) => person.distanceMiles === null || person.distanceMiles <= radius)
    .sort((a, b) => (a.distanceMiles || 0) - (b.distanceMiles || 0));

  return NextResponse.json({ people, count: people.length });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const id = text(body.id, '', 90);
  const lat = number(body.lat, NaN);
  const lng = number(body.lng, NaN);
  const realName = text(body.realName, '', 60);
  const phone = text(body.phone, '', 32);
  const bio = text(body.bio, '', 220);
  const building = text(body.building, '', 160);

  if (!id || !realName || !phone || !bio || !building || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Missing required Norm profile or location.' }, { status: 400 });
  }

  store().set(id, {
    id,
    realName,
    phone,
    bio,
    building,
    locationLabel: text(body.locationLabel, 'Current location', 90),
    signal: text(body.signal, 'Builder', 48),
    tags: tags(body.tags),
    socials: socialLinks(body.socials),
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
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
