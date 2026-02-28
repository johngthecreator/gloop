interface StatusDisplayProps {
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
}

export default function StatusDisplay({
  message,
  type = 'info',
}: StatusDisplayProps) {
  const typeClasses = {
    info: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div
      className={`px-4 py-2 rounded ${typeClasses[type]}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
