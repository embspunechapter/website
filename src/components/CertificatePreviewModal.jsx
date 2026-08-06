export default function CertificatePreviewModal({ certificate, recipientName, domainName, onClose }) {
  if (!certificate) return null;
  const isStudent = certificate.recipient_role === 'student';

  return (
    <div className="certificate-preview-overlay no-print" onClick={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
        <div 
          className="certificate-sheet custom-bg animate-fade-in" 
          style={{ backgroundImage: `url(${certificate.file_url})` }}
        >
          {/* Dynamic Overlays */}
          <div className="cert-overlay-name">
            {recipientName}
          </div>
          
          {isStudent && (
            <div className="cert-overlay-description">
              for successfully completing their engineering internship in the domain of <strong style={{ color: 'var(--ieee-blue)' }}>{domainName || 'General Engineering'}</strong>.
            </div>
          )}
          
          <div className="cert-overlay-code">
            Verification Code: {certificate.certificate_code}
          </div>
          
          <div className="cert-overlay-date">
            Date Issued: {new Date(certificate.issued_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }} className="no-print">
          <button className="btn btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
          <button className="btn btn-outline" style={{ color: 'white', borderColor: 'white', background: 'rgba(255, 255, 255, 0.1)' }} onClick={onClose}>Close Preview</button>
        </div>
      </div>
    </div>
  );
}
