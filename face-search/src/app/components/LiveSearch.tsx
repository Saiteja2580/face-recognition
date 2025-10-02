// src/components/LiveSearch.tsx

"use client";
import React, { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import Image from "next/image";

// This is the URL of your locally running backend
const API_BASE_URL = "http://localhost:3001";

// Define a type for the shape of our search result object
interface SearchResult {
  personId: string;
  similarity: string;
  imageUrl: string;
}

// Define a more specific type for the status messages for better type safety
type Status =
  | "Ready"
  | "Capturing image..."
  | "Getting secure upload URL..."
  | "Uploading image..."
  | "Searching for a match..."
  | "Matches Found!"
  | "No Match Found"
  | "Error";

function LiveSearch() {
  const webcamRef = useRef<Webcam>(null);

  // State now holds an array of results or null
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null
  );
  const [status, setStatus] = useState<Status>("Ready");
  const [error, setError] = useState<string>("");

  const captureAndSearch = useCallback(async () => {
    setStatus("Capturing image...");
    setError("");
    setSearchResults(null);

    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      setStatus("Error");
      setError("Could not capture an image.");
      return;
    }

    const blob = await fetch(imageSrc).then((res) => res.blob());
    const file = new File([blob], "live_capture.jpeg", { type: "image/jpeg" });

    try {
      setStatus("Getting secure upload URL...");
      const { data: presignedData } = await axios.post<{
        uploadUrl: string;
        key: string;
      }>(`${API_BASE_URL}/api/get-presigned-url`);

      setStatus("Uploading image...");
      await axios.put(presignedData.uploadUrl, file, {
        headers: { "Content-Type": file.type },
      });

      setStatus("Searching for a match...");
      // Expect a 'matches' array in the response
      const { data: searchData } = await axios.post<{
        message: string;
        matches: SearchResult[];
      }>(`${API_BASE_URL}/api/search-face`, { key: presignedData.key });

      if (searchData.matches && searchData.matches.length > 0) {
        setSearchResults(searchData.matches);
        setStatus("Matches Found!");
      } else {
        setStatus("No Match Found");
      }
    } catch (err) {
      console.error(err);
      setStatus("Error");
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || "The search process failed.");
        if (err.response.status === 404) {
          setStatus("No Match Found");
        }
      } else {
        setError("An unknown error occurred.");
      }
      setSearchResults(null);
    }
  }, [webcamRef]);

  return (
    <div style={{ textAlign: "center", fontFamily: "sans-serif" }}>
      <h2>Live Face Search</h2>
      <div style={{ margin: "20px" }}>
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          style={{
            width: "500px",
            height: "375px",
            borderRadius: "8px",
            border: "2px solid #ccc",
          }}
        />
      </div>
      <button
        onClick={captureAndSearch}
        style={{ padding: "12px 20px", fontSize: "16px", cursor: "pointer" }}
      >
        Capture & Search
      </button>
      <div style={{ marginTop: "20px" }}>
        <h3>Status: {status}</h3>
        {error && (
          <p style={{ color: "red" }}>
            <strong>Error: {error}</strong>
          </p>
        )}

        {/* Render a list of results if the array exists and is not empty */}
        {searchResults && searchResults.length > 0 && (
          <div>
            <h3>Match Results</h3>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "20px",
              }}
            >
              {searchResults.map((result) => (
                <div
                  key={result.personId}
                  style={{
                    border: "2px solid green",
                    padding: "10px",
                    borderRadius: "8px",
                    minWidth: "220px",
                  }}
                >
                  <p>
                    <strong>ID:</strong> {result.personId}
                  </p>
                  <p>
                    <strong>Similarity:</strong> {result.similarity}%
                  </p>
                  <Image
                    src={result.imageUrl}
                    alt={`Matched face for ${result.personId}`}
                    width={200}
                    height={200}
                    style={{ borderRadius: "8px" }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveSearch;
