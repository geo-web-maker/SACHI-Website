import { Helmet } from 'react-helmet-async';
import PageHead from '../../components/PageHead/PageHead';
import SupportNote from '../../components/SupportNote/SupportNote';
import CtaBand from '../../components/CtaBand/CtaBand';
import styles from './About.module.css';

const pillars = [
  { label: 'Mandate', title: 'Collaborate & empower', text: 'We collaborate, engage, and empower communities for sustainable social change through health promotion initiatives.' },
  { label: 'Vision', title: 'A regional centre', text: 'To be a regional centre for exceptional health promotion services across the Sub-Saharan region.' },
  { label: 'Mission', title: 'Reduce vulnerability', text: 'To improve population health by reducing vulnerability to health risks through research, communication, and education-driven programmes.' },
];

const why = [
  { num: '01', title: 'Innovative', text: 'Flexible, creative delivery even in the most challenging environments.' },
  { num: '02', title: 'Evidence-based', text: 'Every programme is grounded in research and sound public health practice.' },
  { num: '03', title: 'Excellent', text: 'Professionalism and a commitment to measurable results.' },
  { num: '04', title: 'Collaborative', text: 'Multi-sector partnerships across every dimension of health.' },
];

export default function About() {
  return (
    <>
      <Helmet><title>SACHI — About</title></Helmet>

      <PageHead eyebrow="About SACHI" title="Founded in 2022, built for the long run.">
        <p className={styles.headText}>
          SACHI brings together health promotion professionals united by one goal — a healthier, more resilient community for everyone.
        </p>
      </PageHead>

      <section className={styles.section}>
        <div className={`${styles.historyGrid} wrap`}>
          <div>
            <div className={styles.eyebrowLabel}>Organisation history</div>
            <h2 className={styles.h2}>A capacity-building, not-for-profit organisation</h2>
            <p className={styles.p}>
              SACHI was established in 2022 by a group of devoted health promotion professionals with expertise across multiple sectors. We're located in Kyambogo, Nakawa Division, Kampala — and our work reaches communities across the Sub-Saharan region.
            </p>
            <p className={styles.p}>
              We believe health cannot be separated from other development goals — the foundation of every society is the health of its people. We implement activities using participatory, demand-driven, and collaborative approaches, prioritising marginalised communities. From research to community outreach, everything we do is evidence-based and people-centred.
            </p>
          </div>
          <div className={styles.historyPhoto}>[ field photography ]</div>
        </div>
      </section>

      <section className={styles.sectionTight}>
        <div className="wrap">
          <div className={styles.pillarGrid}>
            {pillars.map((p) => (
              <div className={styles.pillarCard} key={p.label}>
                <div className={styles.eyebrowLabel}>{p.label}</div>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.sectionTight}>
        <div className="wrap">
          <div className={styles.eyebrowLabel}>Why choose us</div>
          <h2 className={styles.h2}>What sets our approach apart</h2>
          <div className={styles.whyGrid}>
            {why.map((w) => (
              <div key={w.num}>
                <div className={styles.numBadge}>{w.num}</div>
                <h3>{w.title}</h3>
                <p>{w.text}</p>
              </div>
            ))}
          </div>
          <SupportNote
            text="Everything you've just read is funded by people who chose to give. Curious how far your support goes?"
            label="See how to give"
          />
        </div>
      </section>

      <CtaBand
        title="Let's bring better health to your community"
        text="Reach out today and let's build a healthier community together."
        ctaLabel="Get in touch with us"
      />
    </>
  );
}
