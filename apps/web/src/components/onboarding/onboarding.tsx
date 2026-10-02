'use client';

/**
 * Onboarding 5 langkah — layar 14, dari prototipe baru (sumber kebenaran #2;
 * ia menang atas berkas standalone dan README). docs/DESIGN_IMPLEMENTATION.md §5.
 *
 * Yang berbeda dari prototipe, dan memang harus berbeda:
 *
 *   - **State dari server, bukan `localStorage`** (OQ-19). LS hanya kenyamanan
 *     render pertama supaya modal tidak berkedip; `GET /onboarding/state` yang
 *     memutuskan, dan keduanya direkonsiliasi saat dimuat.
 *   - **Manfaat langkah 5 dari `GET /onboarding/benefits`** — dibangkitkan server
 *     dari tabel entitlement, bukan daftar hardcoded prototipe (SPEC §33e).
 *   - **Consent lokasi menjadi baris database** lewat `POST /consents`, pada saat
 *     pengguna benar-benar memutuskan.
 *   - Bar DEMO dan `simulateError` tidak dikirim.
 *
 * Mood mascot per langkah (happy → write → wink → focus → thanks) mengikuti
 * prototipe; seninya masih placeholder satu gambar (OQ-18), jadi `MascotSlot`
 * dibuat gampang diganti saat lembar mascot final datang.
 */

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import mascot from '../../../public/snouty-mascot.png';
import {
  completeOnboarding,
  fetchBenefits,
  fetchOnboardingState,
  ONBOARDING_LS_KEY,
  recordLocationConsent,
  type OnboardingBenefit,
  type OnboardingOutcome,
} from './onboarding-api';
import { ONBOARDING_COPY as COPY } from './onboarding-copy';
import styles from './onboarding.module.css';

type LocationState = 'ask' | 'pending' | 'granted' | 'denied' | 'blocked';

const TOTAL_STEPS = 5;
/** Mood per langkah, dari prototipe. Dipakai `MascotSlot` saat seni finalnya ada. */
const STEP_MOODS = ['happy', 'write', 'wink', 'focus', 'thanks'] as const;
/** Penolakan lokasi berlanjut otomatis ~450 ms — angka dari desain (SPEC §33e). */
const DENIED_AUTO_ADVANCE_MS = 450;

export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState<LocationState>('ask');
  const [benefits, setBenefits] = useState<readonly OnboardingBenefit[]>([]);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Rekonsiliasi LS ↔ server: LS mencegah kedipan, server yang memutuskan.
  useEffect(() => {
    let cancelled = false;
    const cached = safeLsGet();

    fetchOnboardingState()
      .then((state) => {
        if (cancelled) return;
        if (state === 'pending') {
          safeLsRemove();
          setOpen(true);
        } else {
          safeLsSet(state);
        }
      })
      .catch(() => {
        // API tidak terjangkau: hormati LS; tanpa LS, tampilkan — pengunjung baru
        // lebih mungkin benar-benar baru daripada kehilangan onboarding selamanya.
        if (!cancelled && cached === null) setOpen(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (open && step === 5 && benefits.length === 0) {
      void fetchBenefits().then(setBenefits);
    }
  }, [open, step, benefits.length]);

  const finish = useCallback((outcome: OnboardingOutcome) => {
    safeLsSet(outcome);
    setOpen(false);
    void completeOnboarding(outcome);
  }, []);

  const next = useCallback(() => {
    setStep((current) => {
      if (current >= TOTAL_STEPS) {
        finish('done');
        return current;
      }
      return current + 1;
    });
  }, [finish]);

  const prev = useCallback(() => setStep((current) => Math.max(current - 1, 1)), []);

  const resolveLocation = useCallback((state: Exclude<LocationState, 'ask' | 'pending'>) => {
    setLocation(state);
    void recordLocationConsent(state === 'granted');
  }, []);

  const askLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      resolveLocation('blocked');
      return;
    }
    setLocation('pending');
    navigator.geolocation.getCurrentPosition(
      () => resolveLocation('granted'),
      (error) => resolveLocation(error.code === error.PERMISSION_DENIED ? 'blocked' : 'denied'),
      { timeout: 6_000, maximumAge: 600_000 },
    );
  }, [resolveLocation]);

  const declineLocation = useCallback(() => {
    resolveLocation('denied');
    setTimeout(next, DENIED_AUTO_ADVANCE_MS);
  }, [next, resolveLocation]);

  // Keyboard: → / Enter maju, ← mundur, Esc lewati (SPEC §33e).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prev();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finish('skip');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, next, prev, finish]);

  // Fokus masuk ke dialog saat terbuka — pembaca layar mendarat di judulnya.
  useEffect(() => {
    if (open) sheetRef.current?.focus();
  }, [open, step]);

  if (!open) return null;

  const copy = COPY.steps[step - 1]!;
  const locationResolved = location !== 'ask' && location !== 'pending';

  const primary =
    step === 4 && !locationResolved
      ? {
          label: location === 'pending' ? COPY.actions.requesting : COPY.actions.enableLocation,
          onClick: location === 'pending' ? undefined : askLocation,
        }
      : step === 5
        ? // Layar daftar sudah ada (minimal, bertanda "menunggu desain" — OQ-21), jadi
          // tombolnya mengarah ke sana setelah onboarding dicatat selesai.
          {
            label: COPY.actions.register,
            onClick: () => {
              finish('done');
              window.location.href = '/daftar';
            },
          }
        : { label: COPY.actions.next, onClick: next };

  const secondary =
    step === 4 && !locationResolved
      ? { label: COPY.actions.later, onClick: declineLocation }
      : step === 5
        ? { label: COPY.actions.continueAsGuest, onClick: () => finish('guest') }
        : null;

  return (
    <div className={styles.scrim}>
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
        tabIndex={-1}
      >
        <div className={styles.hero} aria-hidden="true">
          <div className={styles.heroTop}>
            <div className={styles.heroNum}>
              <strong>{`0${step}`}</strong>
              <span>/ 05</span>
            </div>
            <div className={styles.heroKicker}>{copy.kicker}</div>
          </div>
          <div className={styles.heroBubble}>{copy.bubble}</div>
          <div className={styles.heroDisc} />
          <div className={styles.heroMascot}>
            <MascotSlot mood={STEP_MOODS[step - 1]!} size={210} />
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.head}>
            <div>
              <div className={styles.brandName}>{COPY.brand.name}</div>
              <div className={styles.brandKicker}>{COPY.brand.kicker}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className={styles.dots} role="tablist" aria-label="Langkah onboarding">
                {Array.from({ length: TOTAL_STEPS }, (_, index) => {
                  const dotStep = index + 1;
                  return (
                    <button
                      key={dotStep}
                      type="button"
                      role="tab"
                      aria-selected={dotStep === step}
                      aria-label={`Langkah ${dotStep}`}
                      className={[
                        styles.dot,
                        dotStep === step ? styles.dotActive : '',
                        dotStep < step ? styles.dotPast : '',
                      ].join(' ')}
                      onClick={() => setStep(dotStep)}
                    />
                  );
                })}
              </div>
              <button
                type="button"
                className={styles.close}
                aria-label={COPY.actions.close}
                onClick={() => finish('skip')}
              >
                ×
              </button>
            </div>
          </div>

          <div className={styles.body}>
            <div className={styles.step} key={step}>
              <div>
                <h2 className={styles.stepTitle}>{copy.title}</h2>
                <p className={styles.stepBody}>{copy.body}</p>
              </div>

              {step === 1 && <Step1 />}
              {step === 2 && <Step2 />}
              {step === 3 && <Step3 />}
              {step === 4 && <Step4 location={location} />}
              {step === 5 && <Step5 benefits={benefits} />}
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.skip} onClick={() => finish('skip')}>
              {step === TOTAL_STEPS ? COPY.actions.skipLast : COPY.actions.skip}
            </button>
            <div className={styles.actionGroup}>
              {step > 1 && (
                <button type="button" className={styles.buttonGhost} onClick={prev}>
                  {COPY.actions.back}
                </button>
              )}
              {secondary && (
                <button type="button" className={styles.buttonGhost} onClick={secondary.onClick}>
                  {secondary.label}
                </button>
              )}
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={primary.onClick}
                disabled={primary.onClick === undefined}
              >
                <span>{primary.label}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Slot mascot — seni final belum ada (OQ-18), jadi satu gambar placeholder untuk
 * semua mood. Prop `mood` sudah mengalir supaya penggantinya tinggal pasang.
 */
function MascotSlot({ mood, size }: { mood: string; size: number }) {
  return (
    <Image
      src={mascot}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
      data-mood={mood}
      // Next 16: `priority` usang, penggantinya `preload`.
      preload
    />
  );
}

function Step1() {
  return (
    <div className={styles.capsGrid}>
      {COPY.step1Capabilities.map((capability) => (
        <div key={capability.n} className={styles.capCard}>
          <div className={styles.capNum}>{capability.n}</div>
          <div className={styles.capTitle}>{capability.title}</div>
          <div className={styles.capDetail}>{capability.detail}</div>
        </div>
      ))}
    </div>
  );
}

function Step2() {
  return (
    <>
      <div className={styles.chatCard}>
        <div className={styles.chatHead}>
          <div className={styles.chatHeadLeft}>
            <span className={styles.chatLiveDot} />
            <span>{COPY.step2.chatTitle}</span>
          </div>
          <span className={styles.chatHeadTag}>{COPY.step2.chatTag}</span>
        </div>
        <div className={styles.chatBody}>
          <div className={styles.userBubbleRow}>
            <div className={styles.userBubble}>{COPY.step2.userMessage}</div>
          </div>
          <div className={styles.assistantRow}>
            <div className={styles.assistantAvatar}>
              <Image src={mascot} alt="" width={24} height={24} style={{ objectFit: 'cover' }} />
            </div>
            <div className={styles.assistantCol}>
              <div className={styles.assistantBubble}>{COPY.step2.assistantMessage}</div>
              <div className={styles.chips}>
                {COPY.step2.chips.map((chip, index) => (
                  <span key={chip} className={index === 0 ? styles.chipActive : styles.chip}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.pointsRow}>
        {COPY.step2.points.map((point) => (
          <div key={point.n} className={styles.point}>
            <span className={styles.pointNum}>{point.n}</span>
            {point.label}
          </div>
        ))}
      </div>
    </>
  );
}

function Step3() {
  return (
    <div className={styles.flowCard}>
      <div className={styles.flowGrid}>
        {COPY.step3.columns.map((column, index) => (
          <div
            key={column.kicker}
            className={[styles.flowCol, index === 1 ? styles.flowColMid : ''].join(' ')}
          >
            <div
              className={[styles.flowKicker, index === 2 ? styles.flowKickerResult : ''].join(' ')}
            >
              {column.kicker}
            </div>
            <div className={styles.flowTitle}>{column.title}</div>
            <div className={styles.flowDetail}>{column.detail}</div>
          </div>
        ))}
      </div>
      <div className={styles.flowFooter}>{COPY.step3.footer}</div>
    </div>
  );
}

function Step4({ location }: { location: LocationState }) {
  if (location === 'granted') {
    return (
      <div className={styles.grantedCard} role="status">
        <div className={styles.grantedHead}>
          <span className={styles.grantedCheck}>✓</span>
          {COPY.step4.granted.title}
        </div>
        <div className={styles.grantedBody}>{COPY.step4.granted.body}</div>
      </div>
    );
  }
  if (location === 'denied') {
    return (
      <div className={styles.deniedCard} role="status">
        <div className={styles.deniedTitle}>{COPY.step4.denied.title}</div>
        <div className={styles.deniedBody}>{COPY.step4.denied.body}</div>
      </div>
    );
  }
  if (location === 'blocked') {
    return (
      <div className={styles.blockedCard} role="status">
        <div className={styles.blockedTitle}>{COPY.step4.blocked.title}</div>
        <div className={styles.blockedBody}>{COPY.step4.blocked.body}</div>
      </div>
    );
  }
  return (
    <div className={styles.knowCard}>
      <div className={styles.knowTitle}>{COPY.step4.knowTitle}</div>
      {COPY.step4.points.map((point) => (
        <div key={point} className={styles.knowPoint}>
          <span>·</span>
          {point}
        </div>
      ))}
    </div>
  );
}

function Step5({ benefits }: { benefits: readonly OnboardingBenefit[] }) {
  return (
    <div className={styles.benefitsCard}>
      <div className={styles.benefitsGrid}>
        {benefits.map((benefit) => (
          <div key={benefit.capability} className={styles.benefit}>
            <span
              className={[
                styles.benefitCheck,
                benefit.tag === 'TAMU JUGA' ? styles.benefitCheckGuest : '',
              ].join(' ')}
            >
              ✓
            </span>
            <span className={styles.benefitLabel}>{benefit.label}</span>
            <span className={styles.benefitTag}>{benefit.tag}</span>
          </div>
        ))}
      </div>
      <div className={styles.benefitsFooter}>{COPY.step5.footer}</div>
    </div>
  );
}

function safeLsGet(): string | null {
  try {
    return localStorage.getItem(ONBOARDING_LS_KEY);
  } catch {
    return null;
  }
}

function safeLsSet(value: string): void {
  try {
    localStorage.setItem(ONBOARDING_LS_KEY, value);
  } catch {
    // Mode privat yang menolak LS hanya kehilangan kenyamanan render pertama.
  }
}

function safeLsRemove(): void {
  try {
    localStorage.removeItem(ONBOARDING_LS_KEY);
  } catch {
    // Sama seperti di atas.
  }
}
