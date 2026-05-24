export default function Home() {
  const mockPeople = [
    { name: 'Mia', tags: 'Designer • Miami', distance: '0.3 mi' },
    { name: 'Jay', tags: 'Hardware • Builder', distance: '0.8 mi' },
    { name: 'Chris', tags: 'AI • Crypto', distance: '1.2 mi' },
  ];

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full border border-zinc-800 rounded-3xl p-8 bg-zinc-950 shadow-2xl">
        <h1 className="text-4xl font-bold text-center mb-2">NORM NETWORK</h1>
        <p className="text-zinc-400 text-center mb-8">
          Real-world connection. Only when you choose.
        </p>

        <button className="w-full rounded-2xl py-5 text-2xl font-semibold bg-green-500 text-black hover:scale-[1.02] transition-all duration-200">
          DISCOVERABLE ON
        </button>

        <div className="mt-8">
          <p className="text-green-400 mb-4">3 builders nearby</p>

          <div className="space-y-4">
            {mockPeople.map((person) => (
              <div
                key={person.name}
                className="border border-zinc-800 rounded-2xl p-4 bg-zinc-900"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{person.name}</h2>
                    <p className="text-zinc-400 text-sm">{person.tags}</p>
                  </div>
                  <span className="text-zinc-500 text-sm">{person.distance}</span>
                </div>

                <button className="mt-4 w-full rounded-xl border border-green-500 text-green-400 py-2 hover:bg-green-500 hover:text-black transition-all duration-200">
                  Connect
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
