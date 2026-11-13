export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[#d91e4a]">
      {message}
    </p>
  );
}