import { Helmet } from 'react-helmet-async';
import { useState } from 'react';
import PageHead from '../../components/PageHead/PageHead';
import { api } from '../../lib/api';
import styles from './Contact.module.css';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    try {
      await api.post('/api/contact', form);
      setStatus('sent');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      <Helmet><title>SACHI — Contact</title></Helmet>

      <PageHead eyebrow="Contact" title="Getting in touch is easy.">
        <p className={styles.headText}>
          We'd love to hear from you. Reach out and let's start a conversation about building healthier communities together.
        </p>
      </PageHead>

      <section className={styles.section}>
        <div className={`${styles.grid} wrap`}>
          <div>
            <div className={styles.eyebrowLabel}>Contact details</div>
            <div className={styles.detail}>
              <h3>Address</h3>
              <p>Kyambogo, Nakawa Division,<br />Kampala, Uganda</p>
            </div>
            <div className={styles.detail}>
              <h3>Mail us</h3>
              <p>info@sachiuganda.org</p>
            </div>
            <div className={styles.detail}>
              <h3>Call us</h3>
              <p>+256 783 068811<br />+256 775 162221<br />+256 785 123444</p>
            </div>
          </div>

          <div className={styles.formCard}>
            <h3>Send us a message</h3>
            {status === 'sent' ? (
              <p>Thanks — we've received your message and will get back to you soon.</p>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <input name="name" placeholder="Your name" value={form.name} onChange={handleChange} required />
                <input name="email" type="email" placeholder="Your email" value={form.email} onChange={handleChange} required />
                <input name="subject" placeholder="Subject" value={form.subject} onChange={handleChange} />
                <textarea name="message" placeholder="Message" rows="4" value={form.message} onChange={handleChange} required />
                {status === 'error' && <p>Something went wrong sending that — please try again.</p>}
                <button type="submit" className={styles.submit} disabled={status === 'sending'}>
                  {status === 'sending' ? 'Sending…' : 'Contact us'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
