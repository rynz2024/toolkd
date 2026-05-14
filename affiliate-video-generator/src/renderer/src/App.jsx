import React, { useCallback, useEffect, useMemo, useState } from "react";
import ImageDropzone from "./components/ImageDropzone.jsx";
import ProgressBar from "./components/ProgressBar.jsx";

const SLOTS = [
  { id: "front", label: "Depan", hint: "Tampak depan kaos" },
  { id: "back", label: "Belakang", hint: "Tampak belakang kaos" },
  { id: "model", label: "Model", hint: "Foto model mengenakan kaos" },
];

const api = typeof window !== "undefined" ? window.api : null;

export default function App() {
  const [images, setImages] = useState({ front: null, back: null, model: null });
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [musicList, setMusicList] = useState([]);
  const [musicId, setMusicId] = useState("");
  const [status, setStatus] = useState("idle"); // idle | working | done | error
  const [progress, setProgress] = useState({ percent: 0, message: "" });
  const [error, setError] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [outputFile, setOutputFile] = useState("");

  useEffect(() => {
    if (!api) return;
    api.listMusic().then((tracks) => {
      const labelled = tracks.map((t, idx) => ({
        ...t,
        displayLabel: `Track ${idx + 1}`,
      }));
      setMusicList(labelled);
      if (labelled.length > 0) setMusicId(labelled[0].id);
    });
    api.getDefaultOutputDir().then(setOutputDir);
    const unsub = api.onProgress((p) => {
      setProgress({
        percent: Math.max(0, Math.min(100, Math.round(p.percent || 0))),
        message: p.message || progress.message,
      });
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImage = useCallback((slotId, payload) => {
    setImages((prev) => ({ ...prev, [slotId]: payload }));
  }, []);

  const canGenerate = useMemo(() => {
    return (
      images.front &&
      images.back &&
      images.model &&
      productName.trim() &&
      price.trim() &&
      musicId &&
      status !== "working"
    );
  }, [images, productName, price, musicId, status]);

  const validate = () => {
    if (!images.front) return "Mohon unggah gambar tampak depan kaos.";
    if (!images.back) return "Mohon unggah gambar tampak belakang kaos.";
    if (!images.model) return "Mohon unggah foto model.";
    if (!productName.trim()) return "Mohon isi nama produk.";
    if (!price.trim()) return "Mohon isi harga produk.";
    if (!musicId) return "Mohon pilih musik latar.";
    return null;
  };

  const handleGenerate = async () => {
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      setStatus("error");
      return;
    }
    setStatus("working");
    setProgress({ percent: 0, message: "Mempersiapkan..." });
    try {
      const result = await api.generateVideo({
        frontImagePath: images.front.path,
        backImagePath: images.back.path,
        modelImagePath: images.model.path,
        productName: productName.trim(),
        price: price.trim(),
        musicId,
      });
      if (result && result.success) {
        setOutputFile(result.outputFile);
        setOutputDir(result.outputDir);
        setStatus("done");
        setProgress({ percent: 100, message: "Selesai" });
      } else {
        throw new Error((result && result.error) || "Gagal membuat video");
      }
    } catch (e) {
      setError(e?.message || "Terjadi kesalahan saat membuat video.");
      setStatus("error");
    }
  };

  const handleOpenFolder = () => {
    api?.openFolder(outputDir);
  };

  const handleRetry = () => {
    setError("");
    setStatus("idle");
    setProgress({ percent: 0, message: "" });
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0f1020]">
      <header className="px-6 py-4 border-b border-surface-border flex items-center gap-3">
        <span className="text-2xl">🎬</span>
        <div>
          <h1 className="text-lg font-semibold leading-tight">
            Affiliate Video Generator
          </h1>
          <p className="text-xs text-gray-400">
            Buat video promosi kaos otomatis dalam hitungan menit
          </p>
        </div>
      </header>

      <main className="flex-1 px-6 py-5 grid grid-cols-2 gap-5 overflow-hidden">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-gray-300">
            Unggah Gambar (3 buah)
          </h2>
          <div className="grid grid-cols-3 gap-3 flex-1">
            {SLOTS.map((slot) => (
              <ImageDropzone
                key={slot.id}
                label={slot.label}
                hint={slot.hint}
                value={images[slot.id]}
                onChange={(payload) => handleImage(slot.id, payload)}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Nama Produk
            </label>
            <input
              type="text"
              className="w-full bg-surface-elevated border border-surface-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="Contoh: Kaos Oversize Vintage"
              value={productName}
              maxLength={60}
              onChange={(e) => setProductName(e.target.value)}
              disabled={status === "working"}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Harga</label>
            <input
              type="text"
              className="w-full bg-surface-elevated border border-surface-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="Contoh: Rp 150.000"
              value={price}
              maxLength={40}
              onChange={(e) => setPrice(e.target.value)}
              disabled={status === "working"}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Musik Latar
            </label>
            <select
              className="w-full bg-surface-elevated border border-surface-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
              value={musicId}
              onChange={(e) => setMusicId(e.target.value)}
              disabled={status === "working" || musicList.length === 0}
            >
              {musicList.length === 0 && (
                <option value="">Tidak ada musik tersedia</option>
              )}
              {musicList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayLabel}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-gray-500 mt-auto">
            Hasil video akan tersimpan otomatis di folder
            <br />
            <span className="text-gray-300 break-all">
              {outputDir || "Desktop / Affiliate Videos"}
            </span>
          </div>
        </section>
      </main>

      <footer className="px-6 pb-5 pt-2 border-t border-surface-border flex flex-col gap-3">
        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-100 text-sm rounded-md px-3 py-2 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={handleRetry}
              className="text-xs bg-red-700 hover:bg-red-600 px-2 py-1 rounded"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {status === "working" && (
          <div className="flex flex-col gap-1">
            <ProgressBar percent={progress.percent} />
            <p className="text-xs text-gray-400">
              {progress.message || "Memproses..."} ({progress.percent}%)
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`flex-1 text-base font-semibold py-3 rounded-md transition-colors ${
              canGenerate
                ? "bg-accent hover:bg-accent-hover text-white"
                : "bg-surface-elevated text-gray-500 cursor-not-allowed"
            }`}
          >
            {status === "working" ? "⏳ Memproses..." : "✨ Generate Video"}
          </button>
          {status === "done" && (
            <button
              onClick={handleOpenFolder}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-md text-sm font-medium"
            >
              📁 Open Hasil Video
            </button>
          )}
        </div>

        {status === "done" && outputFile && (
          <p className="text-xs text-emerald-300">
            Video tersimpan: {outputFile.split(/[\\/]/).pop()}
          </p>
        )}
      </footer>
    </div>
  );
}
