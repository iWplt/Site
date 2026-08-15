export default function AdminLoading() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="جاري التحميل">
      <div className="h-8 w-36 animate-pulse rounded-xl bg-[#3f472d12]" />
      <div className="h-4 w-56 animate-pulse rounded-lg bg-[#3f472d10]" />
      <div className="mt-2 h-28 animate-pulse rounded-[1.35rem] bg-[#3f472d0d]" />
      <div className="h-28 animate-pulse rounded-[1.35rem] bg-[#3f472d0d]" />
    </div>
  );
}
