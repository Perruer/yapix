import React from 'react';
import PropTypes from 'prop-types';

// Yapix mark: the same drawing as images/yapix_mark.svg
const LogoSVG = props => {
  let length = props.length;
  return (
    <svg className="svg" width={length} height={length} viewBox="0 0 64 64" version="1.1">
      <title>Yapix</title>
      <rect width="64" height="64" rx="14" fill="#0f172a" />
      <g fill="none" strokeLinecap="round" strokeWidth="7">
        <path d="M18 16 L32 31" stroke="#2dd4bf" />
        <path d="M46 16 L32 31" stroke="#38bdf8" />
        <path d="M32 31 L32 50" stroke="#e2e8f0" />
      </g>
      <circle cx="32" cy="31" r="5.5" fill="#0f172a" stroke="#fbbf24" strokeWidth="3" />
    </svg>
  );
};

LogoSVG.propTypes = {
  length: PropTypes.any
};

export default LogoSVG;
