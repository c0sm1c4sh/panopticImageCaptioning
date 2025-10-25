import React, { useState } from 'react';
import { Upload, Zap, Camera, BarChart3, CheckCircle2, AlertCircle } from 'lucide-react';

const API = "http://localhost:8000";

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [topk, setTopk] = useState(8);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setResult(null);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('topk', String(topk));

      const response = await fetch(`${API}/api/caption`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.detail || `Server error: ${response.status}`);
      }

      console.log('API Response:', data);
      setResult(data);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      setFile(droppedFile);
      setPreview(URL.createObjectURL(droppedFile));
      setResult(null);
      setError(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-3">
            Image Captioning Comparison
          </h1>
          <p className="text-xl text-gray-600">
            Compare BLIP baseline vs Panoptic Segmentation-based captioning
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left: Upload Area */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Upload Image
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-3 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer bg-gray-50"
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                </label>
              </div>

              {preview && (
                <div className="mt-6">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-64 object-contain rounded-xl border-2 border-gray-200"
                  />
                </div>
              )}
            </div>

            {/* Right: Controls */}
            <div className="flex flex-col justify-between">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Top-K Parameter
                </label>
                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-600">Number of segments:</span>
                    <span className="text-3xl font-bold text-blue-600">{topk}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={topk}
                    onChange={(e) => setTopk(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>1</span>
                    <span>10</span>
                    <span>20</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Controls how many top segments the panoptic model captures
                  </p>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!file || loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Generate Captions
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6 mb-8 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 mb-1">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="space-y-6">
            {/* Comparison Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Baseline BLIP */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-gray-100 p-3 rounded-lg">
                    <Camera className="w-6 h-6 text-gray-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Baseline (BLIP)</h2>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-4 mb-4 min-h-24">
                  <p className="text-gray-800 text-lg leading-relaxed">
                    {result.baseline_caption || 'No caption generated'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-xs text-blue-600 font-semibold mb-1">CLIP Score</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {result.clipscore_baseline?.toFixed(3) || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-xs text-green-600 font-semibold mb-1">Recall@K</p>
                    <p className="text-2xl font-bold text-green-700">
                      {result.recall_baseline?.toFixed(3) || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Panoptic Segmentation */}
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl shadow-lg p-6 border-2 border-purple-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <BarChart3 className="w-6 h-6 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Panoptic Segmentation</h2>
                </div>
                
                <div className="bg-white rounded-xl p-4 mb-4 min-h-24 border border-purple-200">
                  <p className="text-gray-800 text-lg leading-relaxed font-medium">
                    {result.panoptic_caption || 'No caption generated'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-purple-100 rounded-lg p-4">
                    <p className="text-xs text-purple-600 font-semibold mb-1">CLIP Score</p>
                    <p className="text-2xl font-bold text-purple-700">
                      {result.clipscore_panoptic?.toFixed(3) || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-xs text-green-600 font-semibold mb-1">Recall@K</p>
                    <p className="text-2xl font-bold text-green-700">
                      {result.recall_panoptic?.toFixed(3) || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Top-K Labels */}
                {result.labels_topk && result.labels_topk.length > 0 && (
                  <div className="bg-white rounded-xl p-4 border border-purple-200">
                    <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-purple-600" />
                      Detected Segments (Top-{topk})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.labels_topk.map((label, idx) => (
                        <span
                          key={idx}
                          className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Metrics Comparison */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Performance Comparison
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">CLIP Score</p>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Baseline</span>
                        <span className="font-semibold">{result.clipscore_baseline?.toFixed(3)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-blue-500 h-3 rounded-full transition-all"
                          style={{ width: `${(result.clipscore_baseline || 0) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Panoptic</span>
                        <span className="font-semibold">{result.clipscore_panoptic?.toFixed(3)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-purple-500 h-3 rounded-full transition-all"
                          style={{ width: `${(result.clipscore_panoptic || 0) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">Recall@K</p>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Baseline</span>
                        <span className="font-semibold">{result.recall_baseline?.toFixed(3)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-green-500 h-3 rounded-full transition-all"
                          style={{ width: `${(result.recall_baseline || 0) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Panoptic</span>
                        <span className="font-semibold">{result.recall_panoptic?.toFixed(3)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-green-500 h-3 rounded-full transition-all"
                          style={{ width: `${(result.recall_panoptic || 0) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
