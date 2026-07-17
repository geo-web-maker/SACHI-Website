import { Helmet } from 'react-helmet-async';
import { useState } from 'react';
import PageHead from '../../components/PageHead/PageHead';
import CtaBand from '../../components/CtaBand/CtaBand';
import styles from './Donate.module.css';

const presetAmounts = [20000, 50000, 150000];

const focusAreas = [
  'Research & Participatory Action',
  'WASH & Environmental Health',
  'Nutrition & Food Security',
  'Sexual & Reproductive Health',
];

export default function Donate() {
  const [mode, setMode] = useState('once');
  const [amount, setAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');

  function selectPreset(amt) {
    setAmount(amt);
    setCustomAmount('');
  }

  function handleCustomChange(e) {
    setCustomAmount(e.target.value);
    setAmount(null);
  }

  return (
    <>
      <Helmet><title>SACHI — Donate</title></Helmet>

      <PageHead eyebrow="Donate" title="Give people the chance to thrive.">
        <p className={styles.headText}>
          Your support funds research, clean water access, and education that reaches communities before crisis does — not after.
        </p>
      </PageHead>

      <section className={styles.section}>
        <div className={`${styles.grid} wrap`}>
          <div>
            <div className={styles.eyebrowLabel}>Make a gift</div>
            <h2 className={styles.h2}>Choose an amount</h2>

            <div className={styles.toggleRow}>
              <button
                className={`${styles.toggleBtn} ${mode === 'once' ? styles.toggleActive : ''}`}
                onClick={() => setMode('once')}
              >
                One-time
              </button>
              <button
                className={`${styles.toggleBtn} ${mode === 'monthly' ? styles.toggleActive : ''}`}
                onClick={() => setMode('monthly')}
              >
                Monthly
              </button>
            </div>

            <div className={styles.amountGrid}>
              {presetAmounts.map((amt) => (
                <button
                  key={amt}
                  className={`${styles.amountBtn} ${amount === amt ? styles.amountActive : ''}`}
                  onClick={() => selectPreset(amt)}
                >
                  UGX {amt.toLocaleString()}
                </button>
              ))}
            </div>

            <input
              className={styles.customInput}
              placeholder="Or enter a custom amount (UGX)"
              value={customAmount}
              onChange={handleCustomChange}
            />

            <button className={styles.continueBtn}>Continue to give &rarr;</button>
            <p className={styles.note}>Secure payment integration to be connected at build time.</p>
          </div>

          <div>
            <div className={styles.eyebrowLabel}>Where it goes</div>
            <h2 className={styles.h3}>Every gift supports our programme work</h2>
            <div className={styles.focusList}>
              {focusAreas.map((area) => (
                <div className={styles.focusItem} key={area}>{area}</div>
              ))}
            </div>
            <p className={styles.smallNote}>
              We're a young organisation — founded in 2022 — and are building our public impact reporting now. Every donor will receive a direct update on how funds were used.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.sectionTight}>
        <div className="wrap">
          <div className={styles.eyebrowLabel}>Other ways to give</div>
          <h2 className={styles.h2}>Bank transfer &amp; mobile money</h2>
          <div className={styles.waysGrid}>
            <div className={styles.wayCard}>
              <h3>Bank transfer</h3>
              <p>Account details available on request — contact us for a donation reference.</p>
            </div>
            <div className={styles.wayCard}>
              <h3>Mobile money</h3>
              <p>MTN &amp; Airtel Money numbers provided at checkout.</p>
            </div>
            <div className={styles.wayCard}>
              <h3>In-kind &amp; partnerships</h3>
              <p>Organisations and institutions can reach us directly to discuss partnership giving.</p>
            </div>
          </div>
        </div>
      </section>

      <CtaBand
        title="Questions before giving?"
        text="We're happy to walk you through exactly how your donation is used."
        ctaLabel="Contact us"
      />
    </>
  );
}
