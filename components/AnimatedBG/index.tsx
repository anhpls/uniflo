"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

// Fixed colors for the 3 gradient circles
const colors = ["#e6074d", "#a100c2", "#13ebe7"]; // Pink, Orange, Aqua

// Function to generate gradient attributes
const generateGradients = () =>
  colors.map((color, index) => ({
    id: `gradient-${index}`,
    size: Math.random() * 140 + 500, // Random size (200px - 340px)
    color,
    top: `${Math.random() * 40 + 30}%`, // Keeps within central region (30%-70%)
    left: `${Math.random() * 40 + 30}%`, // Keeps within central region (30%-70%)
    delay: Math.random() * 2, // Random animation delay (0s - 2s)
    duration: Math.random() * 12 + 6, // Random duration (6s - 18s)
  }));

export default function AnimatedBG() {
  const [gradients, setGradients] = useState<
    {
      id: string;
      size: number;
      color: string;
      top: string;
      left: string;
      delay: number;
      duration: number;
    }[]
  >([]);

  // Ensure gradients are only generated on the client (avoiding hydration errors)
  useEffect(() => {
    setGradients(generateGradients());
  }, []);

  return (
    <motion.div
      className="absolute inset-0 -z-10 overflow-hidden flex justify-center items-center "
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, ease: "easeIn", delay: 2.3 }}
    >
      {gradients.map((gradient) => (
        <motion.div
          key={gradient.id}
          className="absolute rounded-full opacity-50 mix-blend-overlay filter blur-3xl"
          initial={{ opacity: 0.2, scale: 1 }}
          animate={{
            x: [Math.random() * 250 - 25, Math.random() * 250 - 20, 0], // Increased movement range
            y: [Math.random() * 250 - 25, Math.random() * 250 - 20, 0], // Increased movement range
            opacity: [0.2, 0.05, 0.2], // More noticeable opacity fluctuation
            scale: [1, 1.6, 1], // Larger scaling animation
            rotate: [0, 10, -10, 0], // Subtle rotation effect
            transition: {
              duration: gradient.duration,
              repeat: Infinity,
              repeatType: "mirror" as const,
              ease: "easeInOut",
              delay: gradient.delay,
            },
          }}
          style={{
            width: `${gradient.size}px`,
            height: `${gradient.size}px`,
            background: `radial-gradient(circle, ${gradient.color}, transparent)`,
            top: gradient.top,
            left: gradient.left,
          }}
        />
      ))}
    </motion.div>
  );
}
