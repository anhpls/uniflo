"use client";
import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { MdKeyboardDoubleArrowLeft } from "react-icons/md";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function SyllabusUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const router = useRouter();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Ensure files are properly wrapped as File objects
    const sanitizedFiles = acceptedFiles.map(
      (file) => new File([file], file.name, { type: file.type })
    );
    setFiles((prevFiles) => [...prevFiles, ...sanitizedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [],
      "image/*": [],
    },
    multiple: true,
  });

  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage("Please select or drag and drop at least one file.");
      return;
    }

    setIsUploading(true);

    try {
      for (const file of files) {
        const filePath = `syllabi/${Date.now()}-${encodeURIComponent(
          file.name
        )}`;

        const { error: uploadError } = await supabase.storage
          .from("syllabi")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Supabase upload error:", uploadError);
          setMessage("Error uploading file to storage.");
          setIsUploading(false);
          return;
        }

        // After upload, call parser
        const response = await fetch("/api/parse-syllabus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath }),
        });

        if (!response.ok) {
          setMessage("Error parsing syllabus.");
          setIsUploading(false);
          return;
        }
      }

      setMessage("Files uploaded and parsed successfully!");
      setFiles([]);
    } catch (err) {
      console.error(err);
      setMessage("Unexpected error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  return (
    <section className="w-screen h-screen flex items-center justify-center">
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        onClick={() => router.back()}
        className="flex items-center space-x-2 text-stone-700 hover:text-gray-900 mb-4 absolute top-5 left-5"
      >
        <MdKeyboardDoubleArrowLeft className="text-3xl" />
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="p-6 max-w-md mx-auto bg-transparent rounded-xl shadow-md space-y-4"
      >
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-lg font-bold"
        >
          Add Your Course Syllabi
        </motion.h2>

        <div
          {...getRootProps()}
          className={`border-2 rounded-lg p-6 cursor-pointer text-center h-24 flex items-center justify-center w-96 transition-colors duration-300 border-dashed ${
            isDragActive
              ? "border-blue-500 bg-blue-100 text-blue-700"
              : "border-gray-300 bg-gray-100 text-gray-600"
          }`}
        >
          <input {...getInputProps()} multiple />
          <p className="w-full text-center whitespace-nowrap overflow-hidden text-ellipsis">
            {isDragActive
              ? "Release to upload your files"
              : "Upload each syllabus (PDF or Image)"}
          </p>
        </div>

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded"
              >
                <span className="truncate font-semibold">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="text-red-500 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <motion.button
          transition={{ delay: 0.1, duration: 0.2 }}
          whileHover={{ scale: 1.02 }}
          className={`bg-stone-900 hover:bg-stone-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-red-300 w-full transition-colors duration-300 ${
            isUploading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={handleUpload}
          disabled={isUploading}
        >
          {isUploading ? "Uploading..." : "Upload"}
        </motion.button>

        {message && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="text-sm text-gray-600 text-center"
          >
            {message}
          </motion.p>
        )}
      </motion.div>
    </section>
  );
}
