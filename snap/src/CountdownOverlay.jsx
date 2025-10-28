import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

function CountdownOverlay({ onComplete }) {
  const [count, setCount] = useState(10);

  useEffect(() => {
    if (count === 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCount(count - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="countdown-overlay"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={count}
          initial={{ scale: 0, rotate: -180, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0, rotate: 180, opacity: 0 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="countdown-number"
        >
          {count === 0 ? "🚀" : count}
        </motion.div>
      </AnimatePresence>

      <motion.p
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="countdown-text"
      >
        Launching to CAIAS...
      </motion.p>

      {/* Particle Burst */}
      <div className="countdown-particles">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="particle"
            initial={{
              x: 0,
              y: 0,
              scale: 0,
              opacity: 1,
            }}
            animate={{
              x: Math.cos((i / 30) * Math.PI * 2) * 300,
              y: Math.sin((i / 30) * Math.PI * 2) * 300,
              scale: [0, 1, 0],
              opacity: [1, 0.5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.05,
              ease: "easeOut",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default CountdownOverlay;
