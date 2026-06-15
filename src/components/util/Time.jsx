// Time.jsx
import { createContext, useContext, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';

const TimeContext = createContext(null);

export const TimeProvider = forwardRef(
    function TimeProvider({ globalSpeed, children }, ref) {
    const accTime     = useRef(0);
    const speedRef    = useRef(globalSpeed);
    const deltaScaled = useRef(0);

    speedRef.current = globalSpeed;

    const reset = useCallback(() => {
        accTime.current     = 0;
        deltaScaled.current = 0;
    }, []);

    useImperativeHandle(ref, () => ({ reset }), [reset]);

    useFrame((_, delta) => {
        deltaScaled.current = delta * speedRef.current;
        accTime.current    += deltaScaled.current;
    });

    return (
        <TimeContext.Provider value={{ accTime, deltaScaled, reset }}>
        {children}
        </TimeContext.Provider>
    );
    }
);

export function useTime() {
  const ctx = useContext(TimeContext);
  if (!ctx) throw new Error('useTime must be used inside <TimeProvider>');
  return ctx;
}