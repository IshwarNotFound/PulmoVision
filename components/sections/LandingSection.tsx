"use client";

import { useEffect, useState, useRef, PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";

import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { LandingLung } from "@/components/visualization/LandingLung";

import styles from "./LandingSection.module.css";

/* ── Copy constants ── */
const HERO = {
  eyebrow: "SYSTEM STATUS: ACTIVE // NEURAL INFERENCE ENGINE V3.3",
  headline: (
    <>
      Radiological Inference.<br />
      Enhanced by <span className={styles.textAccent}>Spatial Intelligence.</span>
    </>
  ),
  subtext: (
    <>
      Neural inference engineered on clinically annotated chest radiographs.
      <br />
      <span style={{ opacity: 0.9 }}>
        Grad-CAM doesn't just detect — it hunts pathology and marks its coordinates.
      </span>
    </>
  ),
  cta: "Launch Inference Demo",
  secondaryCta: "Methodology",
};

const HOW_IT_WORKS = [
  {
    num: "01",
    title: "Radiograph Acquisition",
    desc: "Submit a posteroanterior (PA) chest X-ray. Pixel intensities undergo histogram normalization and spatial dimensions are resampled.",
  },
  {
    num: "02",
    title: "Deep Convolutional Inference",
    desc: "The neural network propagates the radiograph blocks, extracting hierarchical multi-scale pathological feature representations.",
  },
  {
    num: "03",
    title: "Grad-CAM Saliency",
    desc: "Class-discriminative gradients backpropagate, generating spatially-localized activation maps at 14×14 resolution.",
  },
  {
    num: "04",
    title: "Posterior Output",
    desc: "Temperature-scaled softmax normalization yields the final class probability distribution with calibrated confidence scores.",
  },
];

const STATS = [
  { num: "112,120", label: "Annotated training cases" },
  { num: "14×14", label: "Grad-CAM saliency resolution" },
  { num: "4", label: "Pathological classes" },
];

/* ── Scroll reveal hook ── */
function useScrollReveal() {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!targets.length) return;

    targets.forEach((el) => el.classList.add(styles.revealHidden));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = Number(el.dataset.revealDelay ?? 0);
            setTimeout(() => {
              el.classList.remove(styles.revealHidden);
              el.classList.add(styles.revealVisible);
            }, delay);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ── Typewriter effect for Telemetry ── */
function useTypewriter(text: string, speed: number = 30, delay: number = 0) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const startType = () => {
      let i = 0;
      const interval = setInterval(() => {
        setDisplayed(text.substring(0, i + 1));
        i++;
        if (i === text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    };
    timeout = setTimeout(startType, delay);
    return () => clearTimeout(timeout);
  }, [text, speed, delay]);
  return displayed;
}

/* ── Component ── */
export function LandingSection() {
  const router = useRouter();

  useScrollReveal();
  
  // Interactive Scrubber State
  const scrubberRef = useRef<HTMLDivElement>(null);
  const topLayerRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    
    // Jump instantly to click
    if (!scrubberRef.current || !topLayerRef.current || !lineRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    
    topLayerRef.current.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
    lineRef.current.style.left = `${percent}%`;
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isScrubbing || !scrubberRef.current || !topLayerRef.current || !lineRef.current) return;
    
    const rect = scrubberRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    
    requestAnimationFrame(() => {
      if (topLayerRef.current && lineRef.current) {
        topLayerRef.current.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
        lineRef.current.style.left = `${percent}%`;
      }
    });
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    setIsScrubbing(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    if (isScrubbing) {
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }
  }, [isScrubbing]);

  const fndType = useTypewriter("Bilateral Opacity", 40, 600);
  const clsType = useTypewriter("Lung Opacity", 40, 1000);
  const valType = useTypewriter("89.1%", 60, 1500);

  return (
    <div className={styles.shell}>
      {/* Viewfinder Macrolayout */}
      <div className={styles.viewfinderCorner} style={{ bottom: 16, left: 24 }}>
        <span className={styles.statusDot} /> SYS ONLINE: 14MS
      </div>
      <div className={styles.viewfinderCorner} style={{ bottom: 16, right: 24 }}>[ DIAG AWAIT ]</div>

      {/* ════════════════════════════════
          HERO
          ════════════════════════════════ */}
      <section className={styles.hero}>
        {/* Left — text */}
        <div className={`${styles.textCol} ui-enter`}>
          <div className={styles.glowBar} />
          <p className={styles.eyebrow}>
            {HERO.eyebrow}
          </p>

          <h1 className={styles.headline}>
            {HERO.headline}
          </h1>

          <div className={styles.heroRule} />

          <p className={styles.subtext}>
            {HERO.subtext}
          </p>

          <div className={styles.ctaRow}>
            <button
              className={styles.hardwareBtn}
              onClick={() => router.push("/disclaimer")}
            >
              <div className={styles.scanline} />
              {HERO.cta}
              <span className={styles.hardwareBtnArrow}>→</span>
            </button>
            <button
              className={styles.tactileSecondaryBtn}
              onClick={() => {
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {HERO.secondaryCta}
            </button>
          </div>

        </div>

        {/* Right — 3D model + overlays */}
        <div className={`${styles.modelCol} ui-enter ui-enter-delay-1`}>
          {/* Optics/Reticles */}
          <div className={styles.opticCrosshair} style={{ top: "35%", left: "20%" }}>+</div>
          <div className={styles.opticCrosshair} style={{ top: "25%", right: "20%" }}>+</div>
          <div className={styles.opticCrosshair} style={{ bottom: "25%", left: "25%" }}>+</div>
          <div className={styles.opticCrosshair} style={{ bottom: "35%", right: "25%" }}>+</div>
          
          <svg className={styles.opticBracket} style={{ top: "10%", left: "10%" }} viewBox="0 0 20 20"><path d="M 20 0 L 0 0 L 0 20" fill="none" strokeWidth="1"/></svg>
          <svg className={styles.opticBracket} style={{ top: "10%", right: "10%", transform: "rotate(90deg)" }} viewBox="0 0 20 20"><path d="M 20 0 L 0 0 L 0 20" fill="none" strokeWidth="1"/></svg>
          <svg className={styles.opticBracket} style={{ bottom: "10%", left: "10%", transform: "rotate(-90deg)" }} viewBox="0 0 20 20"><path d="M 20 0 L 0 0 L 0 20" fill="none" strokeWidth="1"/></svg>
          <svg className={styles.opticBracket} style={{ bottom: "10%", right: "10%", transform: "rotate(180deg)" }} viewBox="0 0 20 20"><path d="M 20 0 L 0 0 L 0 20" fill="none" strokeWidth="1"/></svg>


          {/* Telemetry info panel */}
          <div className={styles.telemetryPanel} aria-hidden="true">
            <div className={styles.telemetryHeader}>
              <span className={styles.telemetryTitle}>INFERENCE OUTPUT</span>
              <span className={styles.telemetryBlinker}></span>
            </div>
            
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Finding</span>
              <span className={styles.infoVal}>{fndType}<span className={fndType.length < 17 ? styles.cursor : styles.hiddenCursor}>█</span></span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Classification</span>
              <span className={styles.infoVal}>{clsType}<span className={clsType.length < 12 ? styles.cursor : styles.hiddenCursor}>█</span></span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Posterior</span>
              <span className={`${styles.infoVal} ${styles.infoAccent}`}>{valType}<span className={valType.length < 5 ? styles.cursor : styles.hiddenCursor}>█</span></span>
            </div>
          </div>

          <div className={styles.modelWrap}>
            <div className={styles.lungGlow} />
            <LandingLung />
          </div>

          <div className={styles.macroReadout}>
            <span className={styles.macroVal}>T-MINUS 0.00</span>
            <span className={styles.macroDivider}>//</span>
            <span className={styles.macroLabel}>AWAITING RADIOGRAPH INIT</span>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          HOW IT WORKS (Active Routing)
          ════════════════════════════════ */}
      <section
        className={styles.howSection}
        id="how-it-works"
        data-reveal
      >
        <p className={`label ${styles.sectionLabel}`}>Inference Pipeline</p>
        <h2 className={styles.sectionHeadline}>
          From radiograph acquisition to posterior classification in seconds.
        </h2>

        <div className={styles.activePipeline}>
          <div className={styles.pipelineTrack}>
            <div className={styles.pipelinePulse} />
          </div>

          <div className={styles.stepper}>
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.num}
                className={styles.step}
                data-reveal
                data-reveal-delay={i * 150}
              >
                <div className={styles.stepTagWrapper}>
                  <div className={styles.stepTagNode} />
                  <span className={styles.stepNum}>{step.num}</span>
                </div>
                <div className={styles.stepContentBox}>
                  <p className={styles.stepTitle}>{step.title}</p>
                  <p className={styles.stepDesc}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          EXPLAINABILITY: INTERACTIVE SCRUBBER
          ════════════════════════════════ */}
      <section className={styles.explainSection} data-reveal>
        <div className={styles.explainHeaderBox}>
           <p className={`label ${styles.sectionLabel}`}>XAI — Explainability</p>
           <h2 className={styles.explainHeadline}>
             Transparent Inference: XAI Saliency Mapping.
           </h2>
           <p className={styles.explainSub}>
             The model&apos;s internal reasoning is fully auditable. Slide the scanner to peel back the raw radiograph and expose the exact anatomical regions driving the pathological classification.
           </p>
        </div>

        <div className={styles.scrubberContainer} data-reveal data-reveal-delay={200}>
          {/* Main Frame */}
          <div className={styles.scrubberFrame}>
            <div className={styles.scrubHeader}>
              <div className={styles.scrubLabelLeft}>
                <span className={styles.statusDotAmber} /> RAW INPUT
              </div>
              <div className={styles.scrubLabelRight}>
                <span className={styles.statusDotGreen} /> GRAD-CAM ACTIVE
              </div>
            </div>

            <div 
              className={styles.scrubArea}
              ref={scrubberRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {/* Layer 1: Base (Grad-CAM Image) */}
              <div className={styles.scrubLayerBottom}>
                <img
                  src="/demo-scan.png"
                  alt="Chest radiograph with model attention map"
                  className={styles.scrubImage}
                  draggable={false}
                />
                <div className={styles.explainHeatOverlay} aria-hidden="true">
                  <div className={styles.explainHeat1} />
                  <div className={styles.explainHeat2} />
                </div>
                
                {/* Annotations specific to Grad-CAM */}
                <div className={`${styles.techAnnotation} ${styles.techAnn1}`}>
                  <div className={styles.annBox} />
                  <div className={styles.annLine} />
                  <span className={styles.annText}>LOCUS ALPHA: 89.1% conf</span>
                </div>
              </div>

              {/* Layer 2: Masked (Raw X-Ray) */}
              <div 
                className={styles.scrubLayerTop}
                ref={topLayerRef}
                style={{ clipPath: `inset(0 50% 0 0)` }}
              >
                <img
                  src="/demo-scan.png"
                  alt="Original chest radiograph input"
                  className={`${styles.scrubImage} ${styles.scrubImageGray}`}
                  draggable={false}
                />

                {/* Tech overlay for raw image */}
                <div className={styles.rawScanOverlay}>
                  <div className={styles.gridPlane} />
                  <div className={styles.calibrationMark} style={{ top: '20%', left: '10%' }}>⌖ 14.5mm</div>
          <div className={styles.calibrationMark} style={{ bottom: '20%', left: '12%' }}>⌖ 8.2mm</div>
                </div>
              </div>

              {/* Scrubber Control Line */}
              {/* HUD Metadata Readouts around the scrubber */}
          <div className={styles.hudMeta} style={{ top: "12%", left: "15%" }}>
            <span className={styles.hudDot} /> GPU_READY // LATENCY: 14MS
          </div>
          <div className={styles.hudMeta} style={{ top: "16%", left: "15%", opacity: 0.4 }}>
            SALIENCY_BUF_ACTIVE
          </div>
          <div className={styles.hudMeta} style={{ bottom: "8%", right: "12%" }}>
            INFERENCE_TEMP: 42°C
          </div>

          <div 
            className={styles.scrubberLine} 
                ref={lineRef}
                style={{ left: `50%` }}
              >
                <div className={styles.scrubberHandle}>
                  <div className={styles.handleLines} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.explainNote}>
          <span className={styles.explainNoteDot} />
          <p className={styles.explainNoteText}>
            PulmoVision is a machine learning research tool. Grad-CAM
            visualizations show model attention — not clinical diagnosis.
            All outputs are for research purposes only.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════
          STATS / GRAD-CAM QUOTE
          ════════════════════════════════ */}
      <section className={styles.quoteSection} data-reveal>
        <h2 className={styles.quoteText}>
          Grad-CAM makes every convolutional decision auditable.
        </h2>
        <p className={styles.quoteSub}>
          Instead of opaque softmax outputs, PulmoVision renders gradient-weighted
          class activation maps that expose which spatial regions drove each
          classification decision — every convolutional feature mapped back to
          the precise anatomical region that activated it.
        </p>
        <div className={styles.statsRow}>
          {STATS.map(({ num, label }) => (
            <div key={label} className={styles.stat} data-reveal data-reveal-delay={100}>
               <div className={styles.statLine} />
               <span className={styles.statNum}>{num}</span>
               <span className={styles.statLabel}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════
          DISCLAIMER & CLOSER
          ════════════════════════════════ */}
      <section className={styles.footerData} data-reveal>
         <div className={styles.disclaimerSection}>
           <p className={`label ${styles.sectionLabel}`}>Clinical Disclosure</p>
           <p className={styles.disclaimerText}>
             PulmoVision is a deep learning research instrument employing convolutional
             neural networks for pattern recognition in chest radiographs. Model outputs
             represent probabilistic classifications, not clinical diagnoses. This system
             has not been validated for clinical use, exhibits known false-positive and
             false-negative rates, and must not substitute for radiological interpretation
             by a licensed physician or radiologist.
           </p>
         </div>

         <div className={styles.closerSection}>
           <h2 className={styles.closerHeadline}>Ready to Initiate Inference?</h2>
           <p className={styles.closerSub}>
             Proceed to the clinical disclosure module and launch a guided pulmonary radiology inference session.
           </p>
           <button
              className={styles.hardwareBtn}
              onClick={() => router.push("/disclaimer")}
            >
              <div className={styles.scanline} />
              SYSTEM BOOT →
            </button>
         </div>
      </section>
    </div>
  );
}

