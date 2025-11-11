/**
 * EEG Dashboard (Embedded Streamlit)
 *
 * Embeds the Streamlit EEG Tokenization dashboard in an iframe.
 * Set NEXT_PUBLIC_STREAMLIT_URL to override the default http://localhost:8501.
 */

export default function EEGPage() {
  const url = process.env.NEXT_PUBLIC_STREAMLIT_URL || 'http://localhost:8501';
  return (
    <div style={{ height: 'calc(100vh - 100px)' }}>
      <h1>EEG Dashboard</h1>
      <iframe
        src={url}
        style={{ width: '100%', height: '100%', border: '1px solid var(--color-border)', borderRadius: 8 }}
      />
    </div>
  );
}

