'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LiveMap from './components/LiveMap';

type SocialLinks = {
  instagram: string;
  x: string;
  linkedin: string;
  website: string;
};

type Profile = {
  id: string;
  realName: string;
  phone: string;
  bio: string;
  building: string;
  locationLabel: string;
  signal: string;
  tags: string[];
  radius: number;
  cuesEnabled: boolean;
  socials: SocialLinks;
};

type Coordinates = { lat: number; lng: number; accuracy?: number };

type NetworkPerson = {
  id: string;
  realName: string;
  phone?: string;
  signal: string;
  bio: string;
  building: string;
  locationLabel: string;
  tags: string[];
  socials?: Partial<SocialLinks>;
  lat?: number;
  lng?: number;
  distanceMiles?: number | null;
  updatedAt?: number;
  isSeed?: boolean;
};

type ConnectionRequest = {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  fromPhone: string;
  fromBuilding: string;
  fromSignal: string;
  fromSocials: Partial<SocialLinks>;
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

type Contact = {
  id: string;
  name: string;
  phone: string;
  building: string;
  signal: string;
};

const PROFILE_KEY = 'norm-network-profile';
const LAST_LOCATION_KEY = 'norm-network-last-location';

const emptySocials: SocialLinks = { instagram: '', x: '', linkedin: '', website: '' };

const defaultProfile: Profile = {
  id: '',
  realName: '',
  phone: '',
  bio: '',
  building: '',
  locationLabel: '',
  signal: 'Builder',
  tags: ['AI', 'Startups', 'Hardware'],
  radius: 5,
  cuesEnabled: true,
  socials: emptySocials
};

const seedPeople: NetworkPerson[] = [
  {
    id: 'seed-mia',
    realName: 'Mia Torres',
    phone: '+1 (305) 555-0198',
    signal: 'Founder',
    bio: 'Building a local founder circle for Miami creators.',
    building: 'A pop-up network for founders, artists, and operators.',
    locationLabel: 'Miami coffee shop',
    tags: ['Startups', 'Design', 'Miami'],
    socials: { instagram: '@mia.builds', linkedin: 'linkedin.com/in/miatorres' },
    distanceMiles: 0.4,
    isSeed: true
  },
  {
    id: 'seed-jay',
    realName: 'Jay Carter',
    phone: '+1 (786) 555-0144',
    signal: 'Hardware',
    bio: 'Prototyping wearables, sensors, and physical interfaces.',
    building: 'A BLE wristband that turns real-world connection on and off.',
    locationLabel: 'Coworking lobby',
    tags: ['Hardware', 'BLE', 'Product'],
    socials: { x: '@jaymakes' },
    distanceMiles: 0.9,
    isSeed: true
  },
  {
    id: 'seed-nova',
    realName: 'Nova Ellis',
    phone: '+1 (954) 555-0181',
    signal: 'AI Creative',
    bio: 'Making immersive visuals and AI-assisted experiences.',
    building: 'A cinematic AI studio for brands and music artists.',
    locationLabel: 'Hotel lobby',
    tags: ['AI', 'Creative', 'Video'],
    socials: { website: 'nova.studio' },
    distanceMiles: 1.3,
    isSeed: true
  },
  {
    id: 'seed-cam',
    realName: 'Cam Reed',
    phone: '+1 (561) 555-0102',
    signal: 'Operator',
    bio: 'Connects builders, investors, and local event people.',
    building: 'A private calendar of high-signal local gatherings.',
    locationLabel: 'Tech week event',
    tags: ['Events', 'Ops', 'Network'],
    socials: { linkedin: 'linkedin.com/in/camreed' },
    distanceMiles: 2.1,
    isSeed: true
  }
];

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `norm-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function cleanTags(value: string | string[]) {
  const raw = Array.isArray(value) ? value : value.split(',');
  return raw.map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
}

function normalizeProfile(input: Partial<Profile> & { name?: string; status?: string }): Profile {
  return {
    ...defaultProfile,
    ...input,
    id: input.id || createId(),
    realName: input.realName || input.name || '',
    building: input.building || input.status || '',
    tags: Array.isArray(input.tags) ? cleanTags(input.tags) : defaultProfile.tags,
    radius: Number(input.radius) || defaultProfile.radius,
    socials: { ...emptySocials, ...(input.socials || {}) }
  };
}

function isProfileComplete(profile: Profile) {
  return Boolean(profile.id && profile.realName.trim() && profile.phone.trim() && profile.bio.trim() && profile.building.trim() && profile.locationLabel.trim());
}

function formatDistance(miles?: number | null) {
  if (miles === null || miles === undefined) return 'nearby';
  if (miles < 0.1) return 'right here';
  if (miles < 1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1)} mi`;
}

function timeAgo(timestamp?: number) {
  if (!timestamp) return 'demo';
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function getBrowserPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser does not support location yet.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      () => reject(new Error('Location permission was blocked or timed out.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 45000 }
    );
  });
}

async function live<T>(payload: Record<string, unknown>) {
  const response = await fetch('/api/live', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store'
  });

  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Norm live action failed.');
  return data;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [hasProfile, setHasProfile] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [nearby, setNearby] = useState<NetworkPerson[]>([]);
  const [incoming, setIncoming] = useState<ConnectionRequest[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [connectionLog, setConnectionLog] = useState<string[]>([]);
  const [showSeeds, setShowSeeds] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('You are private. Flip the switch when you want to be found.');
  const [error, setError] = useState('');
  const seenConnectionIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const savedProfile = window.localStorage.getItem(PROFILE_KEY);
    const savedLocation = window.localStorage.getItem(LAST_LOCATION_KEY);

    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile) as Partial<Profile> & { name?: string; status?: string };
        const next = normalizeProfile(parsed);
        setProfile(next);
        setHasProfile(isProfileComplete(next));
      } catch {
        window.localStorage.removeItem(PROFILE_KEY);
        const next = { ...defaultProfile, id: createId() };
        setProfile(next);
      }
    } else {
      setProfile({ ...defaultProfile, id: createId() });
    }

    if (savedLocation) {
      try {
        setLocation(JSON.parse(savedLocation) as Coordinates);
      } catch {
        window.localStorage.removeItem(LAST_LOCATION_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (profile.id) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setHasProfile(isProfileComplete(profile));
  }, [profile]);

  const peopleForDisplay = useMemo(() => {
    const livePeople = nearby.filter((person) => person.id !== profile.id);
    const seeds = showSeeds ? seedPeople : [];
    return [...livePeople, ...seeds].slice(0, 12);
  }, [nearby, profile.id, showSeeds]);

  const contacts = useMemo<Contact[]>(() => {
    const map = new Map<string, Contact>();

    incoming.forEach((connection) => {
      const isSender = connection.fromId === profile.id;
      const id = isSender ? connection.toId : connection.fromId;
      const name = isSender ? connection.toName : connection.fromName;
      const phone = isSender ? connection.toPhone : connection.fromPhone;
      const building = isSender ? 'Connected through Norm' : connection.fromBuilding;
      const signal = isSender ? 'Connection' : connection.fromSignal;

      if (id && id !== profile.id) {
        map.set(id, { id, name, phone, building, signal });
      }
    });

    return Array.from(map.values());
  }, [incoming, profile.id]);

  const liveCount = nearby.filter((person) => !person.isSeed).length;

  const cue = useCallback((title: string, body?: string) => {
    if (profile.cuesEnabled && 'vibrate' in navigator) navigator.vibrate([55, 45, 55]);

    if (profile.cuesEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body: body || 'Norm Network' });
      } catch {
        // Browser notifications are best effort.
      }
    }
  }, [profile.cuesEnabled]);

  async function enableCues() {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    setProfile((current) => ({ ...current, cuesEnabled: true }));
    cue('Norm cues enabled', 'Connection pings can now appear as browser notifications.');
  }

  async function publishPresence(nextLocation: Coordinates, nextProfile = profile) {
    await live<{ ok: boolean }>({
      action: 'publish',
      id: nextProfile.id,
      realName: nextProfile.realName,
      phone: nextProfile.phone,
      bio: nextProfile.bio,
      building: nextProfile.building,
      locationLabel: nextProfile.locationLabel,
      signal: nextProfile.signal,
      tags: nextProfile.tags,
      socials: nextProfile.socials,
      radius: nextProfile.radius,
      lat: nextLocation.lat,
      lng: nextLocation.lng
    });
  }

  async function refreshNearby(nextLocation = location, nextProfile = profile) {
    if (!nextLocation || !nextProfile.id) return;

    const data = await live<{ people?: NetworkPerson[] }>({
      action: 'nearby',
      lat: nextLocation.lat,
      lng: nextLocation.lng,
      radius: nextProfile.radius,
      exclude: nextProfile.id
    });

    setNearby(data.people || []);
  }

  async function refreshIncoming(id = profile.id) {
    if (!id) return;

    const data = await live<{ requests?: ConnectionRequest[] }>({ action: 'inbox', id });
    const requests = data.requests || [];

    requests.forEach((request) => {
      if (!seenConnectionIds.current.has(request.id)) {
        seenConnectionIds.current.add(request.id);
        if (request.toId === id && request.fromId !== id) cue('New Norm connection', `${request.fromName} shared their phone with you.`);
      }
    });

    setIncoming(requests);
  }

  useEffect(() => {
    if (!isDiscoverable || !location || !profile.id || !hasProfile) return;

    const activeLocation: Coordinates = location;
    const activeProfile: Profile = profile;
    let cancelled = false;

    async function heartbeat() {
      try {
        await publishPresence(activeLocation, activeProfile);
        if (!cancelled) {
          await refreshNearby(activeLocation, activeProfile);
          await refreshIncoming(activeProfile.id);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Norm could not refresh presence.');
      }
    }

    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 7000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isDiscoverable, location, profile, hasProfile]);

  useEffect(() => {
    if (!selectedContact || !profile.id) return;
    let cancelled = false;

    async function loadChat() {
      try {
        const data = await live<{ messages?: ChatMessage[] }>({ action: 'chat:get', a: profile.id, b: selectedContact.id });
        if (!cancelled) setChatMessages(data.messages || []);
      } catch {
        if (!cancelled) setChatMessages([]);
      }
    }

    void loadChat();
    const interval = window.setInterval(() => void loadChat(), 6000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedContact, profile.id]);

  async function turnOn(useDemoLocation = false) {
    setBusy(true);
    setError('');

    try {
      if (!hasProfile) throw new Error('Create your Norm profile before going discoverable.');
      const nextLocation = useDemoLocation ? { lat: 25.7617, lng: -80.1918, accuracy: 100 } : await getBrowserPosition();
      setLocation(nextLocation);
      window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(nextLocation));

      await publishPresence(nextLocation, profile);
      await refreshNearby(nextLocation, profile);
      await refreshIncoming(profile.id);

      setIsDiscoverable(true);
      setMessage('You are discoverable. Norm is showing nearby signals on the live map.');
      cue('Norm is on', 'You are discoverable to nearby builders.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn Norm on.');
      setMessage('Norm stayed private. Finish signup and allow location to publish your signal.');
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setIsDiscoverable(false);
    setNearby([]);
    setMessage('You are private. Nobody can discover your Norm signal.');
    setError('');

    if (profile.id) await live<{ ok: boolean }>({ action: 'disconnect', id: profile.id }).catch(() => undefined);
  }

  async function connectTo(person: NetworkPerson) {
    setError('');

    try {
      if (!hasProfile) throw new Error('Create your profile before connecting.');

      if (person.isSeed) {
        const fakeConnection: ConnectionRequest = {
          id: `demo-${person.id}-${Date.now()}`,
          fromId: profile.id,
          toId: person.id,
          fromName: profile.realName,
          fromPhone: profile.phone,
          fromBuilding: profile.building,
          fromSignal: profile.signal,
          fromSocials: profile.socials,
          toName: person.realName,
          toPhone: person.phone || '',
          message: `${profile.realName} connected with ${person.realName}. Phone numbers are now shared in demo mode.`,
          createdAt: Date.now()
        };
        setIncoming((current) => [fakeConnection, ...current]);
        setSelectedContact({ id: person.id, name: person.realName, phone: person.phone || '', building: person.building, signal: person.signal });
        cue('Demo contact saved', `${person.realName}'s phone is now visible in your contacts.`);
        return;
      }

      const data = await live<{ connection: ConnectionRequest }>({
        action: 'connect',
        fromId: profile.id,
        toId: person.id,
        fromName: profile.realName,
        fromPhone: profile.phone,
        fromBuilding: profile.building,
        fromSignal: profile.signal,
        fromSocials: profile.socials,
        toName: person.realName,
        message: `${profile.realName} connected with you on Norm. Phone numbers are now shared.`
      });

      setIncoming((current) => [data.connection, ...current.filter((item) => item.id !== data.connection.id)]);
      setSelectedContact({ id: person.id, name: person.realName, phone: data.connection.toPhone, building: person.building, signal: person.signal });
      cue('Connection sent', `${person.realName} received your Norm ping.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect.');
    }
  }

  async function sendChat() {
    if (!selectedContact || !chatDraft.trim()) return;

    const body = chatDraft.trim();
    setChatDraft('');

    try {
      const data = await live<{ message: ChatMessage }>({
        action: 'chat:send',
        fromId: profile.id,
        toId: selectedContact.id,
        fromName: profile.realName,
        body
      });
      setChatMessages((current) => [...current, data.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message failed.');
    }
  }

  const socialEntries = Object.entries(profile.socials).filter(([, value]) => value);

  return (
    <main className='shell'>
      <nav className='topNav'>
        <strong>Norm Network</strong>
        <div>
          <Link href='/signup'>{hasProfile ? 'Edit profile' : 'Sign up'}</Link>
          <button className='tinyButton' onClick={() => void enableCues()}>Enable pings</button>
        </div>
      </nav>

      {!hasProfile && (
        <section className='signupGate'>
          <div>
            <span className='eyebrow'>Required profile</span>
            <h2>Real names. Real location. Real connection.</h2>
            <p>Create a Norm profile with real name, phone, bio, what you are building, and location label before turning on your signal.</p>
          </div>
          <Link className='primaryButton linkButton' href='/signup'>Create profile</Link>
        </section>
      )}

      <section className='hero'>
        <div className='heroCopy'>
          <div className='eyebrow'>Norm Network / live map MVP</div>
          <h1>Find your people in the real world.</h1>
          <p>
            A Life360-style map for builders: turn your signal on, see nearby people, connect once,
            and exchange phone numbers without feeds, clout, or endless scrolling.
          </p>

          <div className='heroActions'>
            <button className='primaryButton' onClick={() => void turnOn(false)} disabled={busy || isDiscoverable}>
              {busy ? 'Finding location...' : 'Turn location on'}
            </button>
            <button className='ghostButton' onClick={() => void turnOff()} disabled={!isDiscoverable}>Go private</button>
            <button className='ghostButton' onClick={() => void turnOn(true)} disabled={busy}>Demo Miami</button>
          </div>
        </div>

        <div className='deviceCard'>
          <div className='deviceTop'>
            <span>NORM SIGNAL</span>
            <span className={isDiscoverable ? 'greenText' : 'muted'}>{isDiscoverable ? 'LIVE' : 'OFF'}</span>
          </div>

          <button
            className={`switchButton ${isDiscoverable ? 'on' : ''}`}
            onClick={() => (isDiscoverable ? void turnOff() : void turnOn(false))}
            disabled={busy}
            aria-pressed={isDiscoverable}
          >
            <span className='switchTrack'><span className='switchKnob' /></span>
            <span>{isDiscoverable ? 'Discoverable ON' : 'Private OFF'}</span>
          </button>

          <p className='deviceMessage'>{message}</p>
          {error && <div className='errorBox'><strong>Heads up:</strong> {error}</div>}

          <div className='deviceStats'>
            <div><strong>{liveCount}</strong><span>live nearby</span></div>
            <div><strong>{profile.radius}mi</strong><span>radius</span></div>
            <div><strong>{contacts.length}</strong><span>contacts</span></div>
          </div>
        </div>
      </section>

      <section className='mapGrid'>
        <div className='panel mapPanel'>
          <div className='sectionHeader'>
            <div><span className='eyebrow'>Live map</span><h2>Nearby builders</h2></div>
            <label className='seedToggle'><input type='checkbox' checked={showSeeds} onChange={(event) => setShowSeeds(event.target.checked)} /> demo people</label>
          </div>
          <LiveMap selfLocation={location} people={peopleForDisplay} isDiscoverable={isDiscoverable} onSelectPerson={(person) => {
            const found = peopleForDisplay.find((item) => item.id === person.id);
            if (found) void connectTo(found);
          }} />
        </div>

        <div className='panel identityPanel'>
          <span className='eyebrow'>Your identity</span>
          <h2>{profile.realName || 'Not signed up'}</h2>
          <p>{profile.bio || 'Create your profile to go live.'}</p>
          <div className='identityStack'>
            <div><strong>Phone</strong><span>{profile.phone || 'Required'}</span></div>
            <div><strong>Building</strong><span>{profile.building || 'Required'}</span></div>
            <div><strong>Location</strong><span>{profile.locationLabel || 'Required'}</span></div>
            <div><strong>Signal</strong><span>{profile.signal}</span></div>
          </div>
          <div className='tagRow'>{profile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          {socialEntries.length > 0 && <div className='socialRow'>{socialEntries.map(([key, value]) => <span key={key}>{key}: {value}</span>)}</div>}
          <Link className='ghostButton linkButton' href='/signup'>Edit profile</Link>
        </div>
      </section>

      <section className='panel networkPanel'>
        <div className='sectionHeader'>
          <div><span className='eyebrow'>Discover</span><h2>{peopleForDisplay.length ? 'Signals around you' : 'No signals yet'}</h2></div>
          <button className='tinyButton' onClick={() => void refreshNearby()}>Refresh</button>
        </div>

        <div className='peopleGrid'>
          {peopleForDisplay.map((person) => (
            <article className='personCard' key={person.id}>
              <div className='personTop'>
                <div className='avatar'>{person.realName.slice(0, 2).toUpperCase()}</div>
                <div><h3>{person.realName}</h3><span>{person.signal} • {formatDistance(person.distanceMiles)}</span></div>
              </div>
              <p>{person.bio}</p>
              <strong className='buildingLine'>{person.building}</strong>
              <div className='tagRow'>{person.tags.map((tag) => <span key={`${person.id}-${tag}`}>{tag}</span>)}</div>
              <div className='personFooter'>
                <span className={person.isSeed ? 'demoBadge' : 'liveBadge'}>{person.isSeed ? 'demo' : `live • ${timeAgo(person.updatedAt)}`}</span>
                <button onClick={() => void connectTo(person)}>Connect & share phones</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className='contactGrid'>
        <div className='panel contactsPanel'>
          <div className='sectionHeader'><div><span className='eyebrow'>Connections</span><h2>Phone exchange</h2></div></div>
          {contacts.length === 0 ? (
            <p className='emptyText'>Connect with someone nearby. Their phone number appears here after the Norm ping.</p>
          ) : (
            <div className='contactList'>
              {contacts.map((contact) => (
                <button className={`contactCard ${selectedContact?.id === contact.id ? 'selected' : ''}`} key={contact.id} onClick={() => setSelectedContact(contact)}>
                  <strong>{contact.name}</strong>
                  <span>{contact.signal}</span>
                  <em>{contact.phone || 'Phone not returned yet'}</em>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className='panel chatPanel'>
          <div className='sectionHeader'>
            <div><span className='eyebrow'>Chat</span><h2>{selectedContact ? selectedContact.name : 'Select a contact'}</h2></div>
          </div>
          {selectedContact ? (
            <>
              <div className='phoneShareBox'><strong>Phone shared:</strong> {selectedContact.phone || 'Waiting for phone'}<span>{selectedContact.building}</span></div>
              <div className='chatMessages'>
                {chatMessages.length === 0 ? <p>No messages yet.</p> : chatMessages.map((chat) => (
                  <div className={`chatBubble ${chat.fromId === profile.id ? 'mine' : ''}`} key={chat.id}>
                    <strong>{chat.fromName}</strong>
                    <span>{chat.body}</span>
                  </div>
                ))}
              </div>
              <div className='chatComposer'>
                <input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder='Send a quick message...' onKeyDown={(event) => {
                  if (event.key === 'Enter') void sendChat();
                }} />
                <button onClick={() => void sendChat()}>Send</button>
              </div>
            </>
          ) : <p className='emptyText'>Once you connect, you can send lightweight messages here.</p>}
        </div>
      </section>

      {connectionLog.length > 0 && (
        <section className='panel logPanel'>
          <span className='eyebrow'>Activity</span>
          {connectionLog.map((item) => <p key={item}>{item}</p>)}
        </section>
      )}

      <footer><strong>Norm Network</strong><span>A physical-world signal layer. Built for intentional connection.</span></footer>
    </main>
  );
}
