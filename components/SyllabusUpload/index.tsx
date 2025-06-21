"use client";
import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { MdKeyboardDoubleArrowLeft } from "react-icons/md";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UploadResult {
  fileName: string;
  status: "success" | "error";
  message: string;
  course?: string;
  eventsCount?: number;
}

export default function SyllabusUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const router = useRouter();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter((file) =>
      file.type.match(/^(application\/pdf|image\/)/)
    );

    if (validFiles.length !== acceptedFiles.length) {
      setMessage("Only PDF and image files are accepted.");
    }

    setFiles((prevFiles) => [
      ...prevFiles,
      ...validFiles.map(
        (file) => new File([file], file.name, { type: file.type })
      ),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage("Please select or drag and drop at least one file.");
      return;
    }

    setIsUploading(true);
    setMessage("Processing files...");
    setUploadResults([]);

    try {
      const results: UploadResult[] = [];

      for (const file of files) {
        try {
          const filePath = `syllabi/${Date.now()}-${encodeURIComponent(
            file.name
          )}`;

          // 1. Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from("syllabi")
            .upload(filePath, file);

          if (uploadError)
            throw new Error(`Upload failed: ${uploadError.message}`);

          // 2. Call Parse API
          const parseResponse = await fetch("/api/parse-syllabus", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filePath }),
          });

          // 3. Handle API response
          const contentType = parseResponse.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await parseResponse.text();
            throw new Error(text || "Invalid response from server");
          }

          const { data, error: parseError } = await parseResponse.json();

          if (parseError || !data) {
            throw new Error(parseError || "No data returned");
          }

          results.push({
            fileName: file.name,
            status: "success",
            message: "Successfully processed",
            course: data.course,
            eventsCount: data.eventsCount,
          });
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
          results.push({
            fileName: file.name,
            status: "error",
            message:
              error instanceof Error
                ? error.message.replace(/<\/?[^>]+(>|$)/g, "")
                : "Processing failed",
          });
        }
      }

      setUploadResults(results);
      setFiles([]);

      const successCount = results.filter((r) => r.status === "success").length;
      setMessage(
        successCount === results.length
          ? `Successfully processed ${successCount} file(s)!`
          : `Processed ${successCount} of ${results.length} files successfully`
      );
    } catch (error) {
      console.error("Unexpected error:", error);
      setMessage("An unexpected error occurred. Please try again.");
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
        className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md space-y-4"
      >
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-lg font-bold text-gray-800"
        >
          Upload Course Syllabi
        </motion.h2>

        <div
          {...getRootProps()}
          className={`border-2 rounded-lg p-6 cursor-pointer text-center h-24 flex items-center justify-center w-full transition-colors duration-300 border-dashed ${
            isDragActive
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-300 bg-gray-50 text-gray-600"
          }`}
        >
          <input {...getInputProps()} />
          <p className="w-full text-center whitespace-nowrap overflow-hidden text-ellipsis">
            {isDragActive
              ? "Release to upload your files"
              : "Drag & drop PDFs or images here, or click to select"}
          </p>
        </div>

        {files.length > 0 && (
          <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
              >
                <span className="truncate text-sm text-gray-700">
                  {file.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="text-red-500 hover:text-red-700 text-xs font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`bg-stone-800 hover:bg-stone-700 text-white font-medium py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2 w-full transition-colors duration-200 ${
            isUploading ? "opacity-70 cursor-not-allowed" : ""
          } ${files.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={handleUpload}
          disabled={isUploading || files.length === 0}
        >
          {isUploading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </span>
          ) : (
            "Upload & Parse Syllabi"
          )}
        </motion.button>

        {message && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`text-sm text-center ${
              message.includes("failed") || message.includes("error")
                ? "text-red-500"
                : "text-green-600"
            }`}
          >
            {message}
          </motion.p>
        )}

        {uploadResults.length > 0 && (
          <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
            {uploadResults.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  result.status === "success"
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                <div className="font-medium flex justify-between">
                  <span className="truncate">{result.fileName}</span>
                  <span className="text-xs font-semibold ml-2">
                    {result.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm mt-1">{result.message}</div>
                {result.course && (
                  <div className="text-xs mt-1">
                    <span className="font-medium">Course:</span> {result.course}
                    {result.eventsCount !== undefined && (
                      <span className="ml-2">
                        • {result.eventsCount} events
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </section>
  );
}
