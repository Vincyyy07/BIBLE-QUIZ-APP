import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getNetworkInfo } from '../../services/api';

const QRCodeCard = ({ quizCode, size = 180, className = '' }) => {
  const [networkIp, setNetworkIp] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getNetworkInfo()
      .then((res) => {
        if (res.data?.ip && res.data.ip !== 'localhost') {
          setNetworkIp(res.data.ip);
        }
      })
      .catch(() => {});
  }, []);

  // Compute the optimal URL for mobile participants
  const hostName = window.location.hostname;
  const isLocalhost = hostName === 'localhost' || hostName === '127.0.0.1';
  
  const effectiveHost = isLocalhost && networkIp ? networkIp : hostName;
  const effectivePort = window.location.port ? `:${window.location.port}` : '';
  const protocol = window.location.protocol;

  const baseUrl = `${protocol}//${effectiveHost}${effectivePort}`;
  const joinUrl = `${baseUrl}/join?code=${quizCode || ''}`;
  const shortDisplayUrl = `${effectiveHost}${effectivePort}/join`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-lg border border-border flex flex-col items-center text-center ${className}`}>
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-3">
        <QRCodeSVG
          value={joinUrl}
          size={size}
          level="H"
          includeMargin={false}
        />
      </div>

      <p className="text-xs font-bold text-primary-700 tracking-wide uppercase mb-1">
        Scan to Join on Phone
      </p>

      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
          {shortDisplayUrl}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-primary-600 hover:text-primary-800 font-medium underline"
          title="Copy join link"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
};

export default QRCodeCard;
