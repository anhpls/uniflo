"use client";
import { motion } from "framer-motion";
import AnimatedBG from "@/components/AnimatedBG";

export default function HomePage() {
  return (
    <>
      <AnimatedBG />
      <motion.div
        initial={{ opacity: 0, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.1, ease: "easeOut" }}
        className="flex flex-col items-center justify-center min-h-screen "
      >
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-5xl font-extrabold text-gray-900 leading-tight"
        >
          Welcome to Uni
          <span className="text-red-500 italic">F</span>
          LO
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.5 }}
          className="text-lg text-gray-600 mt-4"
        >
          Plan smarter. Stay organized.
        </motion.p>

        <motion.a
          href="/home"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            opacity: { delay: 1.8, duration: 0.5 },
            scale: { duration: 0.5 },
          }} // Separate delay
          whileHover={{
            scale: 1.05,
            transition: { duration: 0.2 }, // Ensures hover is instant
          }}
          className="mt-6 bg-stone-800 text-white px-6 py-3 rounded-lg shadow-md hover:bg-stone-700 transition-colors duration-200 "
        >
          Get Started
        </motion.a>
      </motion.div>
    </>
  );
}
