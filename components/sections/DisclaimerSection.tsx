"use client";

import { useRouter } from "next/navigation";

import { PrimaryButton } from "@/components/ui/PrimaryButton";

import styles from "./DisclaimerSection.module.css";

const ENTRIES = [
  "PulmoVision is an ML model, not a doctor. It identifies patterns in chest radiographs — it does not diagnose anything.",
  "Outputs are probabilistic. The model makes mistakes and will be confidently wrong sometimes. Confidence scores are not ground truth.",
  "Use this for learning, research, and asking better questions — not for reaching any clinical conclusion.",
];

export function DisclaimerSection() {
  const router = useRouter();

  return (
    <section className={styles.shell}>
      <div className={styles.contentWrapper}>
        
        {/* Left Side: Dramatic Typography */}
        <div className={`ui-enter ${styles.headerCol}`}>
          <div className={styles.badge}>
            <span className={styles.badgePulse} aria-hidden="true" />
            <span className={styles.badgeText}>Research Prototype · Not for Clinical Use</span>
          </div>

          <h1 className={styles.headline}>
            Hold up.
            <br />
            <span className={styles.headlineSub}>Read before you run.</span>
          </h1>
          
          <div className={styles.headerAccentLine}></div>
        </div>

        {/* Right Side: Enhanced List */}
        <div className={`ui-enter ui-enter-delay-1 ${styles.listCol}`}>
          <div className={styles.log}>
            {ENTRIES.map((text, i) => (
              <div key={i} className={styles.logEntry}>
                <div className={styles.logNumBox}>
                  <div className={styles.logNumLine}></div>
                  <span className={styles.logNumText}>0{i + 1}</span>
                </div>
                <div className={styles.logTextContainer}>
                  <p className={styles.logText}>{text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.footer}>
            <PrimaryButton
              data-interactive="true"
              onClick={() => router.push("/upload")}
              style={{ padding: "1.1rem 2.2rem", fontSize: "14px", letterSpacing: "0.15em" }}
            >
              Got it. Run my scan →
            </PrimaryButton>
            <div className={styles.footerNoteBox}>
              <p className={styles.footerNote}>
                No data retained<br />Session-only processing
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
