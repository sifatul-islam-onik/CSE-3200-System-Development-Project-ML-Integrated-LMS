const fs = require('fs');

const files = [
  'src/components/attainment/CTSheet.js',
  'src/components/attainment/AssignmentSheet.js',
  'src/components/attainment/LabActivitySheet.js'
];

const newToast = `{saveMsg && (
  <div style={{
    position: 'fixed',
    bottom: '40px',
    right: '40px',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    padding: '16px 24px',
    borderRadius: '8px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0',
    fontSize: '14.5px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    zIndex: 9999,
    minWidth: '250px',
    letterSpacing: '-0.01em',
    animation: 'toastSlideInOut 3s ease-in-out forwards',
    overflow: 'hidden'
  }}>
    <style>{\`
      @keyframes toastSlideInOut {
        0% { transform: translateX(120%); opacity: 0; }
        10% { transform: translateX(0); opacity: 1; }
        90% { transform: translateX(0); opacity: 1; }
        100% { transform: translateX(120%); opacity: 0; }
      }
      @keyframes toastProgress {
        0% { width: 100%; left: 0; right: auto; }
        100% { width: 0%; left: 0; right: auto; }
      }
    \`}</style>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: saveMsg === 'Saved!' ? '#dcfce7' : '#fee2e2',
      color: saveMsg === 'Saved!' ? '#16a34a' : '#dc2626',
      fontSize: '14px',
      fontWeight: 'bold',
      zIndex: 1
    }}>
      {saveMsg === 'Saved!' ? '✓' : '✕'}
    </div>
    <span style={{ fontWeight: 500, zIndex: 1 }}>{saveMsg}</span>
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      height: '4px',
      backgroundColor: saveMsg === 'Saved!' ? '#22c55e' : '#ef4444',
      animation: 'toastProgress 2.8s linear forwards'
    }} />
  </div>
)}`;

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  // Handle old string match from previous prompt exactly
  c = c.replace(/\{saveMsg && <div style=\{\{position: 'fixed', bottom: '40px'.*?\/><\/div>\}/g, newToast);
  fs.writeFileSync(f, c);
  console.log(f + ' updated');
});
