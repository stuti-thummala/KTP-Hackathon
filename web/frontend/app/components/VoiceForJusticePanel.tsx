'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdvocacyAction, getAdvocacyActionsForState } from '../data/advocacyActions';

type Representative = {
  name: string;
  office: string;
  divisionId: string | null;
  levels: string[];
  party: string | null;
  email: string | null;
  phone: string | null;
  url: string | null;
  photoUrl: string | null;
};

type CivicLookupResponse = {
  normalizedInput: {
    line1?: string;
    city?: string;
    state?: string;
    zip?: string;
  } | null;
  representatives: Representative[];
  error?: string;
};

const ZIP_REGEX = /^\d{5}$/;
const NAME_MIN_LENGTH = 2;

const BADGE_LABEL: Record<AdvocacyAction['badge'], string> = {
  petition: 'Petition',
  clinic: 'Clinic',
  share: 'Share',
};

function buildEmailBody(
  name: string,
  zip: string,
  reps: Representative[],
  actions: AdvocacyAction[],
  normalizedInput: CivicLookupResponse['normalizedInput'],
): string {
  const primary = reps.find((rep) => Boolean(rep.email)) ?? reps[0];
  const addressLine = normalizedInput?.line1
    ? `${normalizedInput.line1}, ${normalizedInput.city ?? ''}, ${normalizedInput.state ?? ''} ${normalizedInput.zip ?? ''}`.trim()
    : zip;

  const intro = primary
    ? `Dear ${primary.name || primary.office},`
    : 'To whom it may concern,';

  const context = `My name is ${name}, and I live in ${addressLine}. After running an eyewitness memory demo that tracked where my attention drifted, I saw firsthand how easy it is to miss the real suspect.`;

  const bullets = [
    'Nearly 70% of DNA exonerations nationwide involved eyewitness misidentification.',
    'Evidence-based lineup procedures—double-blind administration, clear instructions, full documentation—reduce wrongful IDs without hurting real investigations.',
    'Constituents want our criminal-legal system to rely on verifiable facts instead of fallible perception.',
  ];

  const localActionLine = actions.length
    ? `I am ready to join efforts like ${actions[0].title} and share the findings with my community.`
    : 'I am ready to join local reform efforts and share these findings with my community.';

  const closer = 'Please champion legislation and oversight that make evidence-based eyewitness practices the statewide norm. Lives depend on accuracy.';

  return [
    intro,
    '',
    context,
    '',
    ...bullets.map((point) => `• ${point}`),
    '',
    localActionLine,
    '',
    closer,
    '',
    `Sincerely,`,
    name,
    zip,
  ].join('\n');
}

function createMailtoLink(
  reps: Representative[],
  subject: string,
  body: string,
): string | null {
  if (!reps.length) return null;

  const primary = reps.find((rep) => Boolean(rep.email)) ?? reps[0];
  if (!primary.email) {
    return null;
  }

  return `mailto:${encodeURIComponent(primary.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

type VoiceForJusticePanelProps = {
  className?: string;
};

export default function VoiceForJusticePanel({ className }: VoiceForJusticePanelProps) {
  const [name, setName] = useState('');
  const [zip, setZip] = useState('');
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [normalizedInput, setNormalizedInput] = useState<CivicLookupResponse['normalizedInput']>(null);
  const [actions, setActions] = useState<AdvocacyAction[]>(getAdvocacyActionsForState());
  const [emailDraft, setEmailDraft] = useState('');
  const [hasEdited, setHasEdited] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isNameValid = name.trim().length >= NAME_MIN_LENGTH;
  const isZipValid = ZIP_REGEX.test(zip.trim());
  const canCompose = isNameValid && isZipValid && representatives.length > 0;

  useEffect(() => {
    if (!isZipValid) {
      setRepresentatives([]);
      setActions(getAdvocacyActionsForState());
      setLookupError(null);
      setNormalizedInput(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const queryZip = zip.trim();

    async function fetchRepresentatives() {
      try {
        setIsLoading(true);
        setLookupError(null);

        const response = await fetch(`/api/civic?zip=${queryZip}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const message = (await response.json().catch(() => ({ error: 'Lookup failed.' }))).error ?? 'Lookup failed.';
          throw new Error(message);
        }

        const payload = (await response.json()) as CivicLookupResponse;
        setRepresentatives(payload.representatives ?? []);
        setNormalizedInput(payload.normalizedInput ?? null);
        setActions(getAdvocacyActionsForState(payload.normalizedInput?.state));
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
  console.error('OpenStates lookup error:', error);
        setLookupError((error as Error).message || 'Unable to load representative data for that ZIP.');
        setRepresentatives([]);
        setNormalizedInput(null);
        setActions(getAdvocacyActionsForState());
      } finally {
        setIsLoading(false);
      }
    }

    fetchRepresentatives();

    return () => controller.abort();
  }, [zip, isZipValid]);

  useEffect(() => {
    if (!representatives.length) {
      setEmailDraft('');
      setHasEdited(false);
      return;
    }

    if (!hasEdited) {
      const draft = buildEmailBody(name || 'Concerned Constituent', zip || '', representatives, actions, normalizedInput);
      setEmailDraft(draft);
    }
  }, [representatives, actions, name, zip, normalizedInput, hasEdited]);

  const emailSubject = useMemo(() => {
    if (!representatives.length) return 'Constituent request: adopt evidence-based lineup reforms';

    const primary = representatives.find((rep) => Boolean(rep.email)) ?? representatives[0];
    return `Constituent request: eyewitness reform for ${primary.office}`;
  }, [representatives]);

  const mailtoLink = useMemo(() => {
    if (!canCompose || !emailDraft) return null;
    return createMailtoLink(representatives, emailSubject, emailDraft);
  }, [canCompose, emailDraft, representatives, emailSubject]);

  const normalizedSummary = normalizedInput
    ? [normalizedInput.city, normalizedInput.state]
        .filter(Boolean)
        .join(', ')
    : null;

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-[#111936]/90 via-[#11123b]/85 to-[#050611]/95 p-8 shadow-[0_0_60px_rgba(255,45,149,0.25)] backdrop-blur-xl ${className ?? ''}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,45,149,0.22),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(91,169,255,0.12),_transparent_50%)]" />
      <div className="relative z-10 flex flex-col gap-8">
        <header className="space-y-3">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm font-semibold uppercase tracking-[0.28em] text-pink-300">
            Voice for Justice
          </p>
          <h3 className="text-3xl font-semibold text-white lg:text-4xl">
            Turn your insight into <span className="text-pink-400">advocacy</span>.
          </h3>
          <p className="max-w-3xl text-base text-slate-200/85">
            Plug in your name and ZIP to unlock a mail-ready outreach kit built on real civic data. We call the OpenStates v3 People API on the server, then hand you a tailored email and three no-cost actions to keep momentum alive.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <div className="space-y-4 rounded-2xl border border-white/15 bg-white/5 p-6 shadow-[0_0_35px_rgba(91,169,255,0.2)]">
              <label className="space-y-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Your name</span>
                <input
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-base text-white outline-none transition hover:border-pink-400/60 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/40"
                  placeholder="Alex Rivera"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setHasEdited(false);
                  }}
                />
              </label>
              <label className="space-y-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-300">ZIP code</span>
                <input
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-base text-white outline-none transition hover:border-pink-400/60 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/40"
                  placeholder="60601"
                  inputMode="numeric"
                  maxLength={5}
                  value={zip}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, '').slice(0, 5);
                    setZip(digits);
                    setHasEdited(false);
                  }}
                />
              </label>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-slate-300">
                <p className="font-semibold uppercase tracking-wide text-pink-300">Who receives it?</p>
                {isLoading ? (
                  <p className="mt-3 text-slate-300/80">Looking up officials...</p>
                ) : lookupError ? (
                  <p className="mt-3 text-pink-200/80">{lookupError}</p>
                ) : representatives.length ? (
                  <ul className="mt-3 space-y-3">
                    {representatives.slice(0, 3).map((rep) => (
                      <li key={`${rep.office}-${rep.name}`} className="space-y-1">
                        <p className="text-sm font-medium text-white">{rep.office}</p>
                        <p className="text-xs text-slate-300/80">
                          {rep.name}
                          {rep.party ? ` • ${rep.party}` : ''}
                        </p>
                        <p className="text-xs text-slate-400/80">
                          {rep.email ?? 'No email listed'}
                          {rep.phone ? ` • ${rep.phone}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-slate-300/80">Enter a valid ZIP to reveal your officials.</p>
                )}
                {normalizedSummary && (
                  <p className="mt-4 text-[11px] uppercase tracking-[0.28em] text-slate-400">
                    Matched to {normalizedSummary}
                  </p>
                )}
              </div>
            </div>

          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/15 bg-black/40 p-6 shadow-[0_0_40px_rgba(91,169,255,0.25)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-lg font-semibold text-white">Compose your outreach email</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!emailDraft) return;
                      try {
                        await navigator.clipboard.writeText(emailDraft);
                      } catch (error) {
                        console.error('Clipboard copy failed:', error);
                      }
                    }}
                    disabled={!emailDraft}
                    className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-200/60 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Copy template
                  </button>
                  <a
                    href={mailtoLink ?? undefined}
                    aria-disabled={mailtoLink ? undefined : true}
                    onClick={(event) => {
                      if (!mailtoLink) {
                        event.preventDefault();
                      }
                    }}
                    className="rounded-lg bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(255,45,149,0.35)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-pink-300/70 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Launch mail app
                  </a>
                </div>
              </div>
              <textarea
                className="mt-4 h-72 w-full resize-none rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none transition hover:border-pink-400/40 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/40"
                value={emailDraft}
                onChange={(event) => {
                  setEmailDraft(event.target.value);
                  setHasEdited(true);
                }}
                placeholder="Enter your name and ZIP to generate a starter email."
              />
              {!canCompose && (
                <p className="mt-3 text-xs text-pink-200/80">
                  Enter your name, a valid 5-digit ZIP code, and wait for officials to load to activate the mail shortcut.
                </p>
              )}
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {actions.map((action) => (
                <a
                  key={action.title}
                  href={action.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/10 via-[#131731]/85 to-[#080b1f]/95 p-5 shadow-[0_0_35px_rgba(255,45,149,0.22)] transition hover:border-pink-400/70 hover:shadow-[0_0_55px_rgba(255,45,149,0.35)]"
                >
                  <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,45,149,0.25),_transparent_65%)] opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="relative z-10 space-y-3">
                    <span className="inline-flex min-w-[95px] items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-pink-200">
                      {BADGE_LABEL[action.badge]}
                    </span>
                    <h5 className="text-lg font-semibold text-white">{action.title}</h5>
                    <p className="text-sm text-slate-200/85">{action.description}</p>
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-pink-200">
                      Activate
                      <span aria-hidden>→</span>
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
