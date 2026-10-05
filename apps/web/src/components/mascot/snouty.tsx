/**
 * Mascot SNOUTY — port `snoutyMascot()` / `snoutyAvatar()` dari SNOUTY Prototype.dc.html
 * (baris 1099–1215), koordinat demi koordinat.
 *
 * Dua PNG (`snouty-base.png`, `snouty-pencil.png`) dilapisi mata, alis, dan properti
 * ber-CSS pada koordinat tetap di ruang 1254px; semuanya diskalakan oleh `u = size / 1254`.
 * Setiap mood memasang animasinya sendiri — nama keyframe-nya global di
 * `snouty-keyframes.css`, disalin apa adanya dari prototipe.
 *
 * Yang berbeda dari prototipe, dan sengaja:
 *   - warna lewat token (lint melarang hex mentah di `apps/`);
 *   - `fail` diputar **sekali** lalu diam di frame akhir (lembar mascot, §7) — prototipe
 *     mengulanginya terus;
 *   - `prefers-reduced-motion`: aturan global di tokens.css menghentikan semua animasi,
 *     jadi mascot menjadi frame statis (SPEC §33c).
 *
 * Seni mascot masih placeholder (OQ-18); komponen ini satu-satunya yang tahu bentuknya,
 * jadi penggantinya tinggal mengganti berkas ini.
 */
import type { CSSProperties, ReactNode } from 'react';

import type { Mood } from './mood';
import './snouty-keyframes.css';

/** Lebar ruang koordinat seni mascot. */
const MASCOT_W = 1254;
const BASE = '/snouty-base.png';
const PENCIL = '/snouty-pencil.png';

const LINE = 'var(--snouty-mascot-line)';
const DARK = 'var(--snouty-mascot-dark)';
const PAPER = 'var(--snouty-mascot-paper)';
const WATER = 'var(--snouty-mascot-water)';
const BLUSH = 'var(--snouty-mascot-blush)';
const RED = 'var(--snouty-action)';

const BODY_ANIMATION: Record<Mood, string | null> = {
  idle: 'mkBob 3.2s ease-in-out',
  write: 'mkNod 2.2s ease-in-out',
  think: 'mkTilt 2.8s ease-in-out',
  happy: 'mkHop 2.8s ease-out',
  drip: null,
  fail: 'mkShake 3.4s ease-out',
  surprised: 'mkStartle 3s ease-out',
  confused: 'mkTilt 3.4s ease-in-out',
  sorry: 'mkSlump 3s ease-in-out',
  wink: 'mkBob 3.2s ease-in-out',
  thanks: 'mkSway 2.4s ease-in-out',
  focus: null,
  sleep: 'mkBreath 4s ease-in-out',
};

const EYES: readonly (readonly [number, number])[] = [
  [465, 508],
  [735, 508],
];

const INK_PATH =
  'M 596.0 1028.0 L 592.0 1027.3 L 588.6 1025.1 L 586.3 1021.8 L 585.6 1017.6 L 586.8 1013.0 L 589.9 1008.4 L 594.9 1004.2 L 601.5 1000.9 L 609.3 998.7 L 617.6 998.0 L 625.9 998.7 L 633.7 1000.9 L 640.3 1004.2 L 645.3 1008.4 L 648.4 1013.0 L 649.6 1017.6 L 648.9 1021.8 L 646.6 1025.1 L 643.2 1027.3 L 639.2 1028.0 L 635.2 1027.3 L 631.8 1025.1 L 629.5 1021.8 L 628.8 1017.6 L 630.0 1013.0 L 633.1 1008.4 L 638.1 1004.2 L 644.7 1000.9 L 652.5 998.7 L 660.8 998.0 L 669.1 998.7 L 676.9 1000.9 L 683.5 1004.2 L 688.5 1008.4 L 691.6 1013.0 L 692.8 1017.6 L 692.1 1021.8 L 689.8 1025.1 L 686.4 1027.3 L 682.4 1028.0 L 678.4 1027.3 L 675.0 1025.1 L 672.7 1021.8 L 672.0 1017.6 L 673.2 1013.0 L 676.3 1008.4 L 681.3 1004.2 L 687.9 1000.9 L 695.7 998.7 L 704.0 998.0 L 712.3 998.7 L 720.1 1000.9 L 726.7 1004.2 L 731.7 1008.4 L 734.8 1013.0 L 736.0 1017.6 L 735.3 1021.8 L 733.0 1025.1 L 729.6 1027.3 L 725.6 1028.0 L 721.6 1027.3 L 718.2 1025.1 L 715.9 1021.8 L 715.2 1017.6 L 716.4 1013.0 L 719.5 1008.4 L 724.5 1004.2 L 731.1 1000.9 L 738.9 998.7 L 747.2 998.0 L 755.5 998.7 L 763.3 1000.9 L 769.9 1004.2 L 774.9 1008.4 L 778.0 1013.0 L 779.2 1017.6 L 778.5 1021.8 L 776.2 1025.1 L 772.8 1027.3 L 768.8 1028.0 L 764.8 1027.3 L 761.4 1025.1 L 759.1 1021.8 L 758.4 1017.6 L 759.6 1013.0 L 762.7 1008.4 L 767.7 1004.2 L 774.3 1000.9 L 782.1 998.7 L 790.4 998.0 L 798.7 998.7 L 806.5 1000.9 L 813.1 1004.2 L 818.1 1008.4 L 821.2 1013.0 L 822.4 1017.6 L 821.7 1021.8 L 819.4 1025.1 L 816.0 1027.3 L 812.0 1028.0';

export interface SnoutyProps {
  mood: Mood;
  /** Sisi kotak dalam px; seni mascot bujur sangkar. */
  size: number;
  className?: string;
}

/** Mascot utuh pada ukuran `size`. Dekoratif: pemanggil yang memberi label bila perlu. */
export function Snouty({ mood, size, className }: SnoutyProps) {
  const u = size / MASCOT_W;
  // `fail` sekali jalan lalu diam di frame akhir; mood lain mengulang terus.
  const loop = mood === 'fail' ? '1 forwards' : 'infinite';
  const at = (
    x: number,
    y: number,
    w: number,
    h: number,
    extra?: CSSProperties,
  ): CSSProperties => ({
    position: 'absolute',
    left: x * u,
    top: y * u,
    width: w * u,
    height: h * u,
    ...extra,
  });
  const body = BODY_ANIMATION[mood];
  const origin = mood === 'think' || mood === 'confused' ? '50% 88%' : '50% 100%';
  const dot: CSSProperties = {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: LINE,
  };
  const smileEye = (x: number, y: number, extra?: CSSProperties): CSSProperties =>
    at(x, y, 60, 34, {
      border: `${15 * u}px solid ${LINE}`,
      borderBottom: 'none',
      borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
      boxSizing: 'border-box',
      ...extra,
    });
  const drop = (extra?: CSSProperties): CSSProperties => ({
    background: WATER,
    border: `${7 * u}px solid ${LINE}`,
    boxSizing: 'border-box',
    borderRadius: '50% 50% 50% 50% / 62% 62% 38% 38%',
    ...extra,
  });

  const kids: ReactNode[] = [];
  kids.push(
    <img
      key="b"
      src={BASE}
      alt=""
      draggable={false}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />,
  );

  // ── Mata ──────────────────────────────────────────────────────────────────
  if (mood === 'happy' || mood === 'thanks') {
    EYES.forEach(([x], i) => kids.push(<div key={`e${i}`} style={smileEye(x - 4, 526)} />));
  } else if (mood === 'sleep') {
    EYES.forEach(([x], i) =>
      kids.push(
        <div
          key={`e${i}`}
          style={at(x - 4, 540, 60, 26, {
            border: `${14 * u}px solid ${LINE}`,
            borderTop: 'none',
            borderRadius: '0 0 50% 50% / 0 0 100% 100%',
            boxSizing: 'border-box',
          })}
        />,
      ),
    );
  } else if (mood === 'fail') {
    const bar = (deg: number): CSSProperties => ({
      position: 'absolute',
      left: '-4%',
      right: '-4%',
      top: '40%',
      height: '20%',
      background: LINE,
      borderRadius: 99,
      transform: `rotate(${deg}deg)`,
    });
    EYES.forEach(([x, y], i) =>
      kids.push(
        <div
          key={`e${i}`}
          style={at(x - 8, y + 4, 68, 68, { animation: `mkXeye 3.4s ease-out ${loop}` })}
        >
          <div style={bar(45)} />
          <div style={bar(-45)} />
        </div>,
      ),
    );
  } else if (mood === 'surprised') {
    EYES.forEach(([x, y], i) =>
      kids.push(
        <div
          key={`e${i}`}
          style={at(x, y, 52, 70, {
            animation: 'mkEyePop 3s ease-out infinite',
            transformOrigin: '50% 50%',
          })}
        >
          <div style={dot} />
        </div>,
      ),
    );
  } else if (mood === 'confused') {
    kids.push(
      <div
        key="e0"
        style={at(465, 508, 52, 70, { animation: 'mkBlink 4.2s ease-in-out infinite' })}
      >
        <div style={{ ...dot, transform: 'translate(-10%,-6%)' }} />
      </div>,
      <div
        key="e1"
        style={at(735, 516, 52, 70, {
          animation: 'mkSquint 3s ease-in-out infinite',
          transformOrigin: '50% 55%',
        })}
      >
        <div style={dot} />
      </div>,
      <div
        key="b1"
        style={at(730, 498, 64, 12, {
          background: LINE,
          borderRadius: 99,
          transform: 'rotate(12deg)',
        })}
      />,
    );
  } else if (mood === 'sorry') {
    EYES.forEach(([x, y], i) =>
      kids.push(
        <div
          key={`e${i}`}
          style={at(x + 2, y + 14, 48, 62, { animation: 'mkBlink 5s ease-in-out infinite' })}
        >
          <div style={{ ...dot, transform: 'translateY(8%)' }} />
        </div>,
      ),
    );
    kids.push(
      <div
        key="b0"
        style={at(462, 496, 60, 12, {
          background: LINE,
          borderRadius: 99,
          transform: 'rotate(-16deg)',
          transformOrigin: '100% 50%',
        })}
      />,
      <div
        key="b1"
        style={at(732, 496, 60, 12, {
          background: LINE,
          borderRadius: 99,
          transform: 'rotate(16deg)',
          transformOrigin: '0% 50%',
        })}
      />,
    );
  } else if (mood === 'wink') {
    kids.push(
      <div
        key="e0"
        style={at(465, 508, 52, 70, { animation: 'mkBlink 4.2s ease-in-out infinite' })}
      >
        <div style={dot} />
      </div>,
      <div
        key="e1"
        style={at(735, 508, 52, 70, {
          animation: 'mkWinkEye 3.2s ease-in-out infinite',
          transformOrigin: '50% 55%',
        })}
      >
        <div style={dot} />
      </div>,
      <div
        key="e1a"
        style={smileEye(731, 526, { animation: 'mkWinkArc 3.2s ease-in-out infinite' })}
      />,
    );
  } else if (mood === 'focus') {
    EYES.forEach(([x, y], i) =>
      kids.push(
        <div
          key={`e${i}`}
          style={at(x - 4, y + 18, 60, 46, {
            overflow: 'hidden',
            borderRadius: '18% 18% 50% 50% / 18% 18% 80% 80%',
          })}
        >
          <div
            style={{
              width: '80%',
              height: '100%',
              margin: '0 auto',
              borderRadius: '50%',
              background: LINE,
              animation: 'mkScan 3.2s ease-in-out infinite',
            }}
          />
        </div>,
      ),
    );
    kids.push(
      <div
        key="b0"
        style={at(456, 500, 70, 13, {
          background: LINE,
          borderRadius: 99,
          transform: 'rotate(10deg)',
        })}
      />,
      <div
        key="b1"
        style={at(728, 500, 70, 13, {
          background: LINE,
          borderRadius: 99,
          transform: 'rotate(-10deg)',
        })}
      />,
    );
  } else {
    const look = {
      idle: 'mkLook 7s ease-in-out infinite',
      write: 'mkLookWrite 4.4s linear infinite',
      think: 'mkLookUp 3s ease-in-out infinite',
      drip: 'mkLookDrip 2.6s ease-in-out infinite',
    }[mood];
    const blink =
      mood === 'think' ? 'mkBlink2 5.5s ease-in-out infinite' : 'mkBlink 4.2s ease-in-out infinite';
    EYES.forEach(([x, y], i) =>
      kids.push(
        <div
          key={`e${i}`}
          style={at(x, y, 52, 70, { animation: blink, transformOrigin: '50% 55%' })}
        >
          <div style={{ ...dot, animation: look }} />
        </div>,
      ),
    );
  }

  // ── Kilau badan ───────────────────────────────────────────────────────────
  if (mood === 'idle' || mood === 'happy') {
    kids.push(
      <div
        key="sh"
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: 'inset(8% 22% 61% 22%)',
          WebkitMaskImage: `url(${BASE})`,
          maskImage: `url(${BASE})`,
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          backgroundImage:
            'linear-gradient(110deg, transparent 42%, rgb(255 255 255 / 0.75) 50%, transparent 58%)',
          backgroundSize: '260% 100%',
          backgroundRepeat: 'no-repeat',
          animation: 'mkShine 5s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />,
    );
  }

  // ── Pensil ────────────────────────────────────────────────────────────────
  const pencil = {
    write: 'mkWriteLong 4.4s linear infinite',
    idle: 'mkTap 6s ease-in-out infinite',
    think: 'mkTap 3s ease-in-out 1s infinite',
    fail: `mkTap 3.4s ease-out ${loop}`,
  }[mood as 'write' | 'idle' | 'think' | 'fail'];
  kids.push(
    <img
      key="p"
      src={PENCIL}
      alt=""
      draggable={false}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        transformOrigin: '64.8% 82.6%',
        animation: pencil ?? 'none',
      }}
    />,
  );

  // ── Properti per mood ─────────────────────────────────────────────────────
  const svgStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    overflow: 'visible',
    pointerEvents: 'none',
  };
  if (mood === 'write') {
    kids.push(
      <svg key="ink" viewBox="0 0 1254 1254" style={svgStyle}>
        <path
          d={INK_PATH}
          pathLength={1}
          fill="none"
          stroke={PAPER}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={1}
          style={{ animation: 'mkInkLong 4.4s linear infinite' }}
        />
        <path
          d="M 836 1004 L 856 1026 L 896 978"
          pathLength={1}
          fill="none"
          stroke={PAPER}
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={1}
          style={{ animation: 'mkTickLong 4.4s linear infinite' }}
        />
      </svg>,
    );
  }
  if (mood === 'drip') {
    kids.push(
      <div
        key="d"
        style={at(
          196,
          1040,
          34,
          44,
          drop({ transformOrigin: '50% 0', animation: 'mkDrop 2.6s ease-in infinite' }),
        )}
      />,
    );
  }
  if (mood === 'think') {
    (
      [
        [980, 420, 26, 0],
        [1036, 346, 40, 0.25],
        [1112, 250, 60, 0.5],
      ] as const
    ).forEach(([x, y, s, d], i) =>
      kids.push(
        <div
          key={`t${i}`}
          style={at(x, y, s, s, {
            borderRadius: '50%',
            background: PAPER,
            border: `${8 * u}px solid ${LINE}`,
            boxSizing: 'border-box',
            animation: `mkThought 1.6s ease-in-out ${d}s infinite`,
          })}
        />,
      ),
    );
  }
  if (mood === 'happy') {
    (
      [
        [230, 170, 46, RED, 0],
        [1030, 140, 36, DARK, 0.12],
        [1090, 430, 52, RED, 0.24],
        [150, 560, 30, DARK, 0.36],
      ] as const
    ).forEach(([x, y, s, c, d], i) =>
      kids.push(
        <div
          key={`s${i}`}
          style={at(x, y, s, s, {
            background: c,
            borderRadius: 6 * u,
            animation: `mkSpark 2.8s ease-out ${d}s infinite`,
          })}
        />,
      ),
    );
  }
  if (mood === 'sleep') {
    (
      [
        [990, 330, 70, 0],
        [1060, 250, 54, 0.9],
        [1120, 180, 40, 1.8],
      ] as const
    ).forEach(([x, y, s, d], i) =>
      kids.push(
        <div
          key={`z${i}`}
          style={at(x, y, s, s, {
            fontFamily: 'var(--snouty-font-mono)',
            fontWeight: 600,
            fontSize: s * u,
            lineHeight: 1,
            color: DARK,
            animation: `mkZ 2.7s ease-out ${d}s infinite`,
            opacity: 0,
          })}
        >
          z
        </div>,
      ),
    );
  }
  if (mood === 'fail') {
    kids.push(
      <svg key="crack" viewBox="0 0 1254 1254" style={svgStyle}>
        <path
          d="M 330 888 L 348 926 L 318 952 L 352 992 L 330 1026"
          pathLength={1}
          fill="none"
          stroke={LINE}
          strokeWidth={14}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={1}
          style={{ animation: `mkCrack 3.4s ease-out ${loop}` }}
        />
      </svg>,
    );
    (
      [
        ['mkSprayA', 312],
        ['mkSprayB', 330],
        ['mkSprayC', 344],
      ] as const
    ).forEach(([a, x], i) =>
      kids.push(
        <div
          key={`sp${i}`}
          style={at(x, 876, 34, 44, drop({ animation: `${a} 3.4s ease-out ${loop}`, opacity: 0 }))}
        />,
      ),
    );
    kids.push(
      <div
        key="pd"
        style={at(120, 1110, 360, 40, {
          background: WATER,
          border: `${7 * u}px solid ${LINE}`,
          boxSizing: 'border-box',
          borderRadius: '50%',
          transformOrigin: '50% 50%',
          animation: `mkPuddle 3.4s ease-out ${loop}`,
          opacity: 0,
        })}
      />,
    );
  }
  if (mood === 'surprised') {
    kids.push(
      <div
        key="bang"
        style={at(1000, 250, 110, 190, {
          fontFamily: 'var(--snouty-font-sans)',
          fontWeight: 700,
          fontSize: 190 * u,
          lineHeight: 1,
          color: RED,
          WebkitTextStroke: `${10 * u}px ${LINE}`,
          paintOrder: 'stroke fill',
          textAlign: 'center',
          animation: 'mkBang 3s ease-out infinite',
          opacity: 0,
        })}
      >
        !
      </div>,
    );
  }
  if (mood === 'confused') {
    kids.push(
      <div
        key="q"
        style={at(990, 230, 140, 190, {
          fontFamily: 'var(--snouty-font-sans)',
          fontWeight: 700,
          fontSize: 190 * u,
          lineHeight: 1,
          color: DARK,
          textAlign: 'center',
          animation: 'mkQ 2.4s ease-in-out infinite',
        })}
      >
        ?
      </div>,
    );
  }
  if (mood === 'sorry') {
    kids.push(
      <div
        key="sw"
        style={at(
          900,
          470,
          40,
          54,
          drop({ transformOrigin: '50% 0', animation: 'mkSweat 2.8s ease-in infinite' }),
        )}
      />,
    );
  }
  if (mood === 'wink') {
    kids.push(
      <div
        key="ws"
        style={at(860, 470, 54, 54, {
          background: RED,
          borderRadius: 8 * u,
          border: `${6 * u}px solid ${LINE}`,
          boxSizing: 'border-box',
          animation: 'mkWinkSpark 3.2s ease-out infinite',
        })}
      />,
    );
  }
  if (mood === 'thanks') {
    (
      [
        [420, 612],
        [764, 612],
      ] as const
    ).forEach(([x, y], i) =>
      kids.push(
        <div
          key={`bl${i}`}
          style={at(x, y, 70, 34, {
            borderRadius: '50%',
            background: BLUSH,
            animation: 'mkBlush 2.4s ease-in-out infinite',
          })}
        />,
      ),
    );
    (
      [
        [960, 380, 90, 0],
        [1050, 300, 64, 0.8],
        [890, 280, 54, 1.6],
      ] as const
    ).forEach(([x, y, s, d], i) =>
      kids.push(
        <div
          key={`ht${i}`}
          style={at(x, y, s, s, {
            fontSize: s * u,
            lineHeight: 1,
            color: RED,
            WebkitTextStroke: `${5 * u}px ${LINE}`,
            paintOrder: 'stroke fill',
            animation: `mkHeart 2.4s ease-out ${d}s infinite`,
            opacity: 0,
          })}
        >
          ♥
        </div>,
      ),
    );
  }
  if (mood === 'focus') {
    kids.push(
      <div
        key="beam"
        style={{
          position: 'absolute',
          left: '12%',
          right: '12%',
          top: '70%',
          height: '22%',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '45%',
            height: 6 * u + 2,
            background: RED,
            boxShadow: `0 0 ${18 * u}px rgb(223 48 28 / 0.9)`,
            animation: 'mkBeam 2.2s ease-in-out infinite',
          }}
        />
      </div>,
    );
  }

  return (
    <div
      className={className}
      data-mood={mood}
      aria-hidden="true"
      style={{ position: 'relative', width: size, height: size, flex: 'none' }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          animation: body ? `${body} ${loop}` : 'none',
          transformOrigin: origin,
        }}
      >
        {kids}
      </div>
    </div>
  );
}

/**
 * Avatar kotak kecil (28–34px) berisi mascot yang diperbesar 1,9× dan digeser, supaya
 * wajahnya yang mengisi kotak — port `snoutyAvatar()` prototipe.
 */
export function SnoutyAvatar({ mood, size = 30 }: { mood: Mood; size?: number }) {
  const inner = size * 1.9;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 7,
        border: '1px solid var(--snouty-action-soft-border)',
        background: 'var(--snouty-surface)',
        overflow: 'hidden',
        position: 'relative',
        flex: 'none',
      }}
    >
      <div style={{ position: 'absolute', left: -inner * 0.24, top: -inner * 0.06 }}>
        <Snouty mood={mood} size={inner} />
      </div>
    </div>
  );
}
