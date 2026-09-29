import React from 'react';

const Footer = ({ className = '' }) => {
  return (
    <footer className={`w-full py-4 px-4 text-center border-t border-slate-200/70 bg-white/60 backdrop-blur-xs mt-auto select-none ${className}`}>
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="text-primary-600 font-bold">✝</span>
          <span>Church Bible Quiz Platform</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-center font-medium">
          <span>Developed by</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200/60 font-semibold shadow-2xs">
            <span>@Bethesda Baptist Church</span>
          </span>
        </div>

        <div className="text-[11px] text-slate-400">
          For Fellowship & Scripture Learning
        </div>
      </div>
    </footer>
  );
};

export default Footer;
