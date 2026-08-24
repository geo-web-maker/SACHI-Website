import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './PasswordField.module.css';

/**
 * Drop-in replacement for <input type="password">, with a show/hide toggle.
 * Works inside both Login's plain form and Modal's `.body input` styling —
 * padding-right is set inline so it can't lose a CSS specificity fight with
 * whatever descendant selector is styling `input` in the parent form.
 */
export default function PasswordField({
  id,
  value,
  onChange,
  autoComplete = 'current-password',
  required,
  placeholder,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.wrap}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        style={{ paddingRight: 38 }}
      />
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
      </button>
    </div>
  );
}
