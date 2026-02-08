"use client";

import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import axios from "axios";

export default function Home() {
  const { isConnected, address } = useAccount();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [metadata, setMetadata] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return alert("Select a file first");
    setLoading(true);
    setStatus("Uploading to IPFS...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post("http://localhost:3001/api/content/upload", formData);
      const { cid } = res.data;
      
      setStatus(`File uploaded! CID: ${cid}`);
      // In a real app, you'd then call registerContent on the smart contract here
      console.log("Ready for contract registration with CID:", cid);
    } catch (error) {
      console.error(error);
      setStatus("Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-8 font-sans text-white">
      <div className="w-full max-w-2xl space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 shadow-2xl backdrop-blur-sm">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Register Content</h1>
          <p className="text-zinc-400">Secure your IP and start earning royalties globally.</p>
        </div>

        {!isConnected ? (
          <div className="rounded-xl bg-zinc-800/50 p-6 text-center">
            <p className="text-zinc-300">Please connect your wallet to start registering content.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-zinc-300">Content File</label>
              <div 
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-800/20 py-12 transition-colors hover:bg-zinc-800/40"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input 
                  id="file-input"
                  type="file" 
                  className="hidden" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file ? (
                  <div className="text-center">
                    <p className="text-green-400 font-medium">{file.name}</p>
                    <p className="text-xs text-zinc-500 mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
                      <svg className="h-6 w-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <p className="text-sm text-zinc-400">Click to upload or drag and drop</p>
                    <p className="text-xs text-zinc-500 italic">Supports text, image, and code files</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Title</label>
                <input 
                  type="text" 
                  placeholder="Original Work Title"
                  className="w-full rounded-lg bg-zinc-800 border-none px-4 py-2 text-sm focus:ring-1 focus:ring-zinc-600 outline-none"
                  value={metadata.name}
                  onChange={(e) => setMetadata({...metadata, name: e.target.value})}
                />
               </div>
               <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Description</label>
                <input 
                  type="text" 
                  placeholder="Tell us about your work..."
                  className="w-full rounded-lg bg-zinc-800 border-none px-4 py-2 text-sm focus:ring-1 focus:ring-zinc-600 outline-none"
                  value={metadata.description}
                  onChange={(e) => setMetadata({...metadata, description: e.target.value})}
                />
               </div>
            </div>

            <button 
              onClick={handleUpload}
              disabled={loading || !file}
              className="w-full rounded-xl bg-white px-6 py-4 font-bold text-black transition-all hover:bg-zinc-200 disabled:opacity-50"
            >
              {loading ? "Processing..." : "Register & Pin to IPFS"}
            </button>

            {status && (
              <p className="text-center text-sm text-zinc-500 bg-zinc-800/30 p-3 rounded-lg border border-zinc-700/50">
                {status}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
