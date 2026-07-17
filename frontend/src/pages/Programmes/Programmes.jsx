import { Helmet } from 'react-helmet-async';
import PageHead from '../../components/PageHead/PageHead';
import ProgrammeCard from '../../components/ProgrammeCard/ProgrammeCard';
import CtaBand from '../../components/CtaBand/CtaBand';
import { useFetch } from '../../hooks/useFetch';
import styles from './Programmes.module.css';

export default function Programmes() {
  const { data: programmes, loading, error } = useFetch('/api/programmes');

  return (
    <>
      <Helmet><title>SACHI — Programmes</title></Helmet>

      <PageHead eyebrow="Programmes" title="Eight ways we reduce health risk.">
        <p className={styles.headText}>
          Evidence-based programmes across multiple thematic areas — working with communities, institutions, and partners to build resilience across Uganda and the Sub-Saharan region.
        </p>
      </PageHead>

      <section className={styles.section}>
        <div className="wrap">
          {loading && <p>Loading programmes…</p>}
          {error && <p>Couldn't load programmes right now — please try again shortly.</p>}
          {programmes?.map((p, i) => (
            <ProgrammeCard
              key={p.slug}
              slug={p.slug}
              num={p.num}
              title={p.title}
              teaser={p.teaser}
              flip={i % 2 === 1}
            />
          ))}
        </div>
      </section>

      <CtaBand
        title="Let's bring better health to your community"
        text="Connect with our team to learn how SACHI's evidence-based programmes can support health promotion where you work."
      />
    </>
  );
}
