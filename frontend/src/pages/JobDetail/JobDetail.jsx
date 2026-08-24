import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams, Navigate } from 'react-router-dom';
import PageHead from '../../components/PageHead/PageHead';
import { useFetch } from '../../hooks/useFetch';
import { sanitizeHtml } from '../../lib/sanitizeHtml';
import { uploadResumeToCloudinary } from '../../lib/cloudinary';
import { api } from '../../lib/api';
import styles from './JobDetail.module.css';

const emptyForm = { applicant_name: '', applicant_email: '', phone: '', cover_note: '' };

function ApplyForm({ jobId }) {
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function onFileChange(e) {
    const picked = e.target.files?.[0] || null;
    setFile(picked);
    setFileName(picked ? picked.name : '');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.applicant_name.trim() || !form.applicant_email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (!file) {
      setError('Attach your CV (PDF or Word doc) before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const resumeUrl = await uploadResumeToCloudinary(file);
      await api.post(`/api/jobs/${jobId}/apply`, {
        applicant_name: form.applicant_name.trim(),
        applicant_email: form.applicant_email.trim(),
        phone: form.phone.trim(),
        cover_note: form.cover_note.trim(),
        resume_url: resumeUrl,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Something went wrong submitting your application.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={styles.applyDone}>
        <h3>Application received</h3>
        <p>Thanks for applying — we'll be in touch if it's a fit.</p>
      </div>
    );
  }

  return (
    <form className={styles.applyForm} onSubmit={handleSubmit}>
      <h3>Apply for this role</h3>

      <div>
        <label htmlFor="applicant_name">Full name</label>
        <input
          id="applicant_name"
          value={form.applicant_name}
          onChange={(e) => updateField('applicant_name', e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="applicant_email">Email</label>
        <input
          id="applicant_email"
          type="email"
          value={form.applicant_email}
          onChange={(e) => updateField('applicant_email', e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="phone">Phone (optional)</label>
        <input
          id="phone"
          value={form.phone}
          onChange={(e) => updateField('phone', e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="cover_note">Note to the hiring team (optional)</label>
        <textarea
          id="cover_note"
          rows={5}
          value={form.cover_note}
          onChange={(e) => updateField('cover_note', e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="resume">CV / résumé (PDF or Word, one file)</label>
        <input id="resume" type="file" accept=".pdf,.doc,.docx" onChange={onFileChange} />
        {fileName && <p className={styles.fileName}>Selected: {fileName}</p>}
      </div>

      {error && <p className={styles.formError}>{error}</p>}

      <button className={styles.submitBtn} type="submit" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}

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
        <div className={`${styles.narrow} wrap`}>
          <ApplyForm jobId={job.id} />
        </div>
      </section>

      <section className={styles.sectionTight}>
        <div className={`${styles.pager} wrap`}>
          <Link to="/career" className={styles.btnGhost}>&larr; All open positions</Link>
        </div>
      </section>
    </>
  );
}
