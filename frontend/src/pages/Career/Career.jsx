import { Helmet } from 'react-helmet-async';
import { useEffect, useState } from 'react';
import PageHead from '../../components/PageHead/PageHead';
import CtaBand from '../../components/CtaBand/CtaBand';
import { api } from '../../lib/api';
import styles from './Career.module.css';

const JOB_TYPES = ['Freelance', 'Full Time', 'Internship', 'Part Time', 'Temporary'];

export default function Career() {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [checkedTypes, setCheckedTypes] = useState(new Set(JOB_TYPES));

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  function toggleType(type) {
    setCheckedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  // Debounce so we're not hitting the API on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (keyword.trim()) params.set('keyword', keyword.trim());
      if (location.trim()) params.set('location', location.trim());
      if (remoteOnly) params.set('remote_only', 'true');
      [...checkedTypes].forEach((t) => params.append('types', t));

      setLoading(true);
      api
        .get(`/api/jobs?${params.toString()}`)
        .then(setJobs)
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [keyword, location, remoteOnly, checkedTypes]);

  return (
    <>
      <Helmet><title>SACHI — Career</title></Helmet>

      <PageHead eyebrow="Open positions" title="Step into a career with purpose.">
        <p className={styles.headText}>
          Explore current opportunities across our community health initiatives, outreach operations, and training workshops in Uganda.
        </p>
      </PageHead>

      <section className={styles.section}>
        <div className="wrap">
          <div className={styles.filterPanel}>
            <div className={styles.filterInputs}>
              <input
                placeholder="Keywords — e.g. research, WASH, coordinator"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <input
                placeholder="Location — e.g. Kampala, Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className={styles.filterRow}>
              <div className={styles.checks}>
                <label>
                  <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
                  Remote positions only
                </label>
                {JOB_TYPES.map((type) => (
                  <label key={type}>
                    <input
                      type="checkbox"
                      checked={checkedTypes.has(type)}
                      onChange={() => toggleType(type)}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.count}>
            {loading ? 'Searching…' : `${jobs.length} ${jobs.length === 1 ? 'open position' : 'open positions'}`}
          </div>

          {!loading && jobs.length === 0 ? (
            <div className={styles.noResults}>
              No open positions match your search right now — try adjusting your filters.
            </div>
          ) : (
            <div className={styles.list}>
              {jobs.map((job) => (
                <div className={styles.card} key={job.id}>
                  <div>
                    <h3>{job.title}</h3>
                    <p>{job.type} · {job.location}{job.remote ? ' · Remote OK' : ''}</p>
                  </div>
                  <a href="#" className={styles.viewLink}>View role &rarr;</a>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <CtaBand
        title="Don't see the right fit?"
        text="We're always glad to hear from people who care about community health. Send us your CV and we'll keep it on file."
      />
    </>
  );
}
