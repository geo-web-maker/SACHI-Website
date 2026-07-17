import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  Search, Droplet, ShieldCheck, HardHat, Wheat, HeartPulse, Stethoscope, Handshake,
} from 'lucide-react';
import PageHead from '../../components/PageHead/PageHead';
import StatStrip from '../../components/StatStrip/StatStrip';
import SupportNote from '../../components/SupportNote/SupportNote';
import CtaBand from '../../components/CtaBand/CtaBand';
import Slideshow from '../../components/Slideshow/Slideshow';
import RotatingWord from '../../components/RotatingWord/RotatingWord';
import Accordion from '../../components/Accordion/Accordion';
import { programmes } from '../../data/programmes';
import { modelPillars } from '../../data/modelPillars';
import { faqs } from '../../data/faqs';
import styles from './Home.module.css';

const iconMap = { Search, Droplet, ShieldCheck, HardHat, Wheat, HeartPulse, Stethoscope, Handshake };

const stats = [
  { num: '2022', label: 'Founded in Kampala' },
  { num: '8', label: 'Programme areas' },
  { num: 'Sub-Saharan', label: 'Regional reach' },
  { num: 'Evidence-based', label: 'Our model' },
];

const rotatingWords = ['water', 'research', 'nutrition', 'safety', 'people'];

// One representative image per programme, so the hero slideshow shows real
// programme variety rather than a single decorative photo.
const heroImages = programmes.map((p) => ({ id: p.slug, caption: p.title }));

export default function Home() {
  return (
    <>
      <Helmet>
        <title>SACHI — Healthier communities start with real programmes</title>
      </Helmet>

      <PageHead
        variant="grid"
        eyebrow="Health promotion · Kampala, Uganda"
        title={
          <>
            Healthier communities <br />
            start with <RotatingWord words={rotatingWords} />.
          </>
        }
        media={
          <div className={styles.heroMediaWrap}>
            <Slideshow images={heroImages} aspect="1 / 1" />
            <div className={styles.floatingCard}>
              <div className={styles.floatingNum}>8</div>
              <div className={styles.floatingLabel}>Programmes running<br />Est. 2022</div>
            </div>
          </div>
        }
      >
        <p className={styles.lede}>
          SACHI works with communities across Uganda to reduce health risk at its source —
          through research, clean water access, and education that reaches people before crisis does.
        </p>
        <div className={styles.heroActions}>
          <Link to="/contact" className={styles.btnPrimary}>Get in touch</Link>
          <Link to="/programmes" className={styles.btnGhost}>Our programmes</Link>
        </div>
      </PageHead>

      <StatStrip stats={stats} />

      {/* Our Model — ported from the original site's real methodology copy */}
      <section className={styles.section}>
        <div className={`${styles.inner} wrap`}>
          <div className={styles.eyebrowLabel}>Our Model</div>
          <h2 className={styles.h2}>Partnering to promote health across settings.</h2>
          <div className={styles.pillarList}>
            {modelPillars.map((pillar, i) => (
              <div
                className={`${styles.pillarRow} ${i % 2 === 1 ? styles.pillarRowFlip : ''}`}
                key={pillar.id}
              >
                <div className={styles.pillarMedia}>
                  <Slideshow images={pillar.images} aspect="4 / 3" />
                </div>
                <div className={styles.pillarText}>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.text}</p>
                </div>
              </div>
            ))}
          </div>
          <SupportNote text="SACHI runs entirely on partnerships and donor support — every gift funds real programme delivery, not overhead." />
        </div>
      </section>

      {/* Programmes icon grid — quick overview of all 8, pulling from the same
          data source as the Programmes page so nothing drifts out of sync. */}
      <section className={styles.section}>
        <div className={`${styles.inner} wrap`}>
          <div className={styles.eyebrowLabel}>Programmes</div>
          <h2 className={styles.h2}>Eight ways we reduce health risk.</h2>
          <div className={styles.iconGrid}>
            {programmes.map((p) => {
              const Icon = iconMap[p.icon];
              return (
                <Link to={`/programmes/${p.slug}`} className={styles.iconCard} key={p.slug}>
                  <div className={styles.iconBadge}>
                    {Icon && <Icon size={20} strokeWidth={1.75} />}
                  </div>
                  <h3>{p.title}</h3>
                  <p>{p.teaser}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* WASH deep-dive — one programme featured in more depth as an example */}
      <section className={styles.section}>
        <div className={`${styles.inner} wrap`}>
          <div className={styles.eyebrowLabel}>Programme spotlight</div>
          <h2 className={styles.h2}>WASH and environmental health</h2>
          <p className={styles.programmeText}>
            Water, sanitation, and hygiene sit at the root of preventable disease. We build access, not just awareness.
          </p>
          <div className={styles.programmeGrid}>
            <div className={styles.programmePhoto}>[ community water point ]</div>
            <div className={styles.programmeCard}>
              <div className={styles.cardIcon}>1</div>
              <h3>Safe water access</h3>
              <p>Clean drinking water and sanitary facilities in schools and healthcare centres.</p>
            </div>
            <div className={styles.programmeCard}>
              <div className={styles.cardIcon}>2</div>
              <h3>Hygiene practice</h3>
              <p>Household-level behaviour change for handwashing and safe food handling.</p>
            </div>
          </div>
          <Link to="/programmes" className={styles.btnGhostDark}>See all 8 programme areas &rarr;</Link>
        </div>
      </section>

      {/* FAQ */}
      <section className={styles.section}>
        <div className={`${styles.inner} wrap`}>
          <div className={styles.eyebrowLabel}>Questions & Answers</div>
          <h2 className={styles.h2}>Common questions</h2>
          <Accordion items={faqs} />
        </div>
      </section>

      <CtaBand
        title="Let's bring better health to your community"
        text="Whether you're a community organisation, institution, or individual, we're ready to partner with you."
      />
    </>
  );
}
