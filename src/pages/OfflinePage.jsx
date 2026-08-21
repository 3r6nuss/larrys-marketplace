const DISCORD_LINK = 'https://discord.com/channels/1403091808870993920/1403091809697272001';
const MEME_GIF = 'https://i.gifer.com/g0bL.gif';

export default function OfflinePage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-12 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,theme(colors.sky.500)_0,transparent_35%),radial-gradient(circle_at_80%_0%,theme(colors.fuchsia.500)_0,transparent_35%),radial-gradient(circle_at_50%_100%,theme(colors.emerald.500)_0,transparent_40%)]" />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
        <img
          src={MEME_GIF}
          alt="Offline Meme"
          className="h-40 w-40 rounded-xl border border-white/10 object-cover shadow-lg"
        />

        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Der Website-Katalog wurde eingestellt
        </h1>

        <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
          Leider hat sich das Team dazu entschlossen, den Website-Katalog einzustellen.
          Bitte nutzt deshalb wieder den alten Katalog im Discord.
        </p>

        <a
          href={DISCORD_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition-transform hover:scale-105 hover:bg-sky-400"
        >
          Zum Discord-Katalog
        </a>
      </div>
    </div>
  );
}
