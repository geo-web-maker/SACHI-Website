import { Helmet } from 'react-helmet-async';
import { Link, useParams, Navigate } from 'react-router-dom';
import PageHead from '../../components/PageHead/PageHead';
import CtaBand from '../../components/CtaBand/CtaBand';
import { useFetch } from '../../hooks/useFetch';
import { sanitizeHtml } from '../../lib/sanitizeHtml';
import styles from './JobDetail.module.css';

export default function JobDetail() {
  const { id } = useParams();
  const { data: job, loading, error } = useFetch(id ? `/api/jobs/${id}` : null, [id]);

  if (loading) return null;
  if (error || !job) {
    return <Navigate to="/career" replace />;
  }

  return (
    <>
      <Helmet><title>SACHI — {job.title}</title></Helmet>

      <PageHead eyebrow={`${job.type} · ${job.location}${job.remote ? ' · Remote OK' : ''}`} title={job.title} />

      <section className={styles.section}>
        <div className={`${styles.narrow} wrap`}>
          <div
            className={styles.richBody}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }}
          />
        </div>
      </section>

      <section className={styles.sectionTight}>
        <div className={`${styles.pager} wrap`}>
          <Link to="/career" className={styles.btnGhost}>&larr; All open positions</Link>
        </div>
      </section>

      <CtaBand
        title="Ready to apply?"
        text={`Send your CV and a short note explaining your interest in the ${job.title} role — we'll be in touch.`}
      />
    </>
  );
}
