import { useState, useRef, useEffect, useCallback } from "react";
import { X, Trash2, Copy, Check, Link, Wifi, WifiOff } from "lucide-react";

interface CoopProps {
  connected: boolean;
  isHost: boolean;
  roomId: string;
  signalingUrl: string;
  onRoomIdChange: (id: string) => void;
  onSignalingUrlChange: (url: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

interface SettingsProps {
  onClose: () => void;
  onCleanupImages: () => Promise<number>;
  coop: CoopProps;
}

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(
    { length: 5 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

function CoopSection({
  connected,
  isHost,
  roomId,
  signalingUrl,
  onRoomIdChange,
  onSignalingUrlChange,
  onConnect,
  onDisconnect,
}: CoopProps) {
  const [mode, setMode] = useState<"host" | "join">("host");
  const [copied, setCopied] = useState(false);

  // Generate a code on first render for host mode
  useEffect(() => {
    if (!roomId) {
      onRoomIdChange(generateCode());
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const shareLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareLink]);

  if (connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-green-600">
          <Wifi size={15} />
          <span>
            Connected as <span className="font-bold">{isHost ? "Host" : "Guest"}</span>
            {" · "}
            <span className="font-mono tracking-widest">{roomId}</span>
          </span>
        </div>

        {isHost && (
          <button
            onClick={copyLink}
            className="flex items-center gap-2 w-full px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-indigo-700 text-sm transition-colors"
          >
            {copied ? <Check size={15} /> : <Link size={15} />}
            {copied ? "Link copied!" : "Copy invite link"}
          </button>
        )}

        <button
          onClick={onDisconnect}
          className="flex items-center gap-2 w-full px-4 py-2.5 bg-red-50 hover:bg-red-100 rounded-xl text-red-600 text-sm transition-colors"
        >
          <WifiOff size={15} />
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 text-sm">
        <button
          onClick={() => { setMode("host"); onRoomIdChange(generateCode()); }}
          className={`flex-1 py-2 font-medium transition-colors ${
            mode === "host"
              ? "bg-indigo-600 text-white"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          Host
        </button>
        <button
          onClick={() => { setMode("join"); onRoomIdChange(""); }}
          className={`flex-1 py-2 font-medium transition-colors ${
            mode === "join"
              ? "bg-indigo-600 text-white"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          Join
        </button>
      </div>

      {mode === "host" ? (
        <>
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">Your room code</label>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-center font-mono text-2xl font-bold tracking-[0.3em] py-2 bg-gray-50 rounded-xl text-gray-800 border border-gray-200">
                {roomId}
              </span>
              <button
                onClick={() => onRoomIdChange(generateCode())}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap"
              >
                New code
              </button>
            </div>
          </div>

          <button
            onClick={copyLink}
            className="flex items-center gap-2 w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 text-sm transition-colors"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Copied!" : "Copy invite link"}
          </button>
        </>
      ) : (
        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">Room code</label>
          <input
            type="text"
            placeholder="XXXXX"
            value={roomId}
            onChange={(e) => onRoomIdChange(e.target.value.toUpperCase().slice(0, 5))}
            className="w-full text-center font-mono text-xl font-bold tracking-[0.3em] py-2 bg-gray-50 rounded-xl text-gray-800 border border-gray-200 outline-none focus:border-indigo-400"
            maxLength={5}
          />
        </div>
      )}

      {/* Signaling URL (advanced) */}
      <div className="space-y-1">
        <label className="text-xs text-gray-400 font-medium">Signaling server</label>
        <input
          type="text"
          value={signalingUrl}
          onChange={(e) => onSignalingUrlChange(e.target.value)}
          className="w-full text-xs font-mono py-1.5 px-3 bg-gray-50 rounded-lg text-gray-500 border border-gray-200 outline-none focus:border-indigo-300"
        />
      </div>

      <button
        onClick={onConnect}
        disabled={!roomId}
        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-colors"
      >
        {mode === "host" ? "Start hosting" : "Join room"}
      </button>
    </div>
  );
}

export default function Settings({ onClose, onCleanupImages, coop }: SettingsProps) {
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog?.addEventListener("cancel", handleCancel);
    return () => dialog?.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCleanup = async () => {
    setIsCleaning(true);
    setCleanupResult(null);
    try {
      const count = await onCleanupImages();
      setCleanupResult(
        count > 0
          ? `Removed ${count} unused image${count !== 1 ? "s" : ""}`
          : "No unused images found",
      );
    } catch {
      setCleanupResult("Failed to clean up images");
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleOverlayClick}
      className="m-auto bg-transparent p-0 backdrop:bg-black/70 backdrop:backdrop-blur-xl"
    >
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Co-op section */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Co-op
          </h3>
          <CoopSection {...coop} />
        </div>

        <div className="border-t border-gray-100" />

        {/* Storage section */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Storage
          </h3>
          <div className="space-y-2">
            <button
              onClick={handleCleanup}
              disabled={isCleaning}
              className="flex items-center gap-2 w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-gray-700 text-sm transition-colors"
            >
              <Trash2 size={16} />
              {isCleaning ? "Cleaning up..." : "Clean up unused images"}
            </button>

            {cleanupResult && (
              <p className="text-sm text-gray-500 px-1">{cleanupResult}</p>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
