import { Helmet } from 'react-helmet-async';
import { Link, useParams, Navigate } from 'react-router-dom';
import PageHead from '../../components/PageHead/PageHead';
import SupportNote from '../../components/SupportNote/SupportNote';
import CtaBand from '../../components/CtaBand/CtaBand';
import Slideshow from '../../components/Slideshow/Slideshow';
import { useFetch } from '../../hooks/useFetch';
import styles from './ProgrammeDetail.module.css';

export default function ProgrammeDetail() {
  const { slug } = useParams();
  const { data: programmes, loading } = useFetch('/api/programmes');

  if (loading) return null;

  const i = programmes?.findIndex((p) => p.slug === slug) ?? -1;
  if (i === -1) {
    return <Navigate to="/programmes" replace />;
  }

  const programme = programmes[i];
  const prev = programmes[(i - 1 + programmes.length) % programmes.length];
  const next = programmes[(i + 1) % programmes.length];

  return (
    <>
      <Helmet><title>SACHI — {programme.title}</title></Helmet>

      <PageHead eyebrow={`Programme ${programme.num} of ${programmes.length}`} title={programme.title} />

      <section className={styles.section}>
        <div className={`${styles.narrow} wrap`}>
          <div className={styles.heroSlideshow}>
            <Slideshow images={programme.images} aspect="16 / 8" />
          </div>
          {programme.body.map((para, i) => (
            <p key={i} className={styles.p}>{para}</p>
          ))}
        </div>
      </section>

      <section className={styles.sectionTight}>
        <div className="wrap">
          <div className={styles.eyebrowLabel}>Gallery</div>
          <h2 className={styles.h2}>From the field</h2>
          <div className={styles.gallerySlideshow}>
            <Slideshow images={programme.images} aspect="4 / 3" showThumbnails />
          </div>
          <SupportNote text={`Your support keeps ${programme.title} running. Even a small monthly gift helps us reach more communities.`} />
        </div>
      </section>

      <section className={styles.sectionTight}>
        <div className={`${styles.pager} wrap`}>
          <Link to={`/programmes/${prev.slug}`} className={styles.btnGhost}>&larr; {prev.title}</Link>
          <Link to="/programmes" className={styles.btnGhost}>All programmes</Link>
          <Link to={`/programmes/${next.slug}`} className={styles.btnGhost}>{next.title} &rarr;</Link>
        </div>
      </section>

      <CtaBand
        title="Let's bring better health to your community"
        text="Connect with our team to learn how this programme could support health promotion where you work."
      />
    </>
  );
}
