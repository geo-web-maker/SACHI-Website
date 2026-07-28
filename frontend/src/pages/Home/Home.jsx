import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { PROGRAMME_ICONS } from '../../data/programmeIcons';
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

const iconMap = PROGRAMME_ICONS;

const stats = [
  { num: '2022', label: 'Founded in Kampala' },
  { num: '8', label: 'Programme areas' },
  { num: 'Sub-Saharan', label: 'Regional reach' },
  { num: 'Evidence-based', label: 'Our model' },
];

const rotatingWords = ['water', 'research', 'nutrition', 'safety', 'people'];

// One representative image per programme, so the hero slideshow shows real
// programme variety rather than a single decorative photo. Images are
// committed to the repo under /public/images/hero and referenced by path —
// see programmes.js `heroImage` field. Programmes without a real photo yet
// (still on a placeholder .svg) are skipped here rather than shown as an
// empty/placeholder slide — see public/images/README.md for what's missing.
const heroImages = programmes
  .filter((p) => p.heroImage && !p.heroImage.endsWith('.svg'))
  .map((p) => ({
    id: p.slug,
    caption: p.title,
    image_url: p.heroImage,
  }));

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
