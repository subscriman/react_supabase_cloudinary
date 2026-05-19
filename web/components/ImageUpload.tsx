type ImageUploadProps = {
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  customName?: string;
  folderPath?: string;
  variant?: 'tile' | 'default';
  emptyLabel?: string;
  showStatusAlert?: boolean;
  previewAspectClassName?: string;
};

export default function ImageUpload({
  currentImageUrl,
  onImageUploaded,
  customName = 'image',
  emptyLabel = 'IMG',
  previewAspectClassName = 'aspect-[4/3]',
}: ImageUploadProps) {
  return (
    <div className="space-y-2">
      <div
        className={`flex overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${previewAspectClassName}`}
      >
        {currentImageUrl ? (
          <img src={currentImageUrl} alt={customName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-medium text-slate-400">
            {emptyLabel}
          </div>
        )}
      </div>
      <input
        type="url"
        value={currentImageUrl || ''}
        onChange={(event) => onImageUploaded(event.target.value)}
        placeholder="https://..."
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
      />
    </div>
  );
}
