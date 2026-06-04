import React, { useState, useEffect } from 'react';
export default function SmartInput({ value, onCommit }) {
  const [tempValue, setTempValue] = useState(String(value));
  useEffect(() => setTempValue(String(value)), [value]);

  const handleCommit = () => {
    const parsed = parseFloat(tempValue);
    if (isNaN(parsed)) setTempValue(String(value));
    else onCommit(parsed);
  };

  return (
    <input 
      type="text" value={tempValue}
      onChange={(e) => setTempValue(e.target.value)} 
      onBlur={handleCommit}
      onKeyDown={(e) => { if (e.key === 'Enter') { handleCommit(); e.target.blur(); } }}
      style={{ flex: 1, padding: '4px', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '3px', width: '0', textAlign: 'center' }}
    />
  );
}