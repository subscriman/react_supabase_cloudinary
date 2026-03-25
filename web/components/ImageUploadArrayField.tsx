import ImageUpload from './ImageUpload';
import { deleteCloudinaryImage, isCloudinaryConfigured } from '../lib/cloudinary';

interface ImageUploadArrayFieldProps {
  title: string;
  description?: string;
  images: string[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  maxImages?: number;
  customNamePrefix?: string;
  uploadFolderPath?: string;
  addButtonLabel?: string;
  gridClassName?: string;
  className?: string;
  slotEmptyLabel?: string;
  previewAspectClassName?: string;
}

export default function ImageUploadArrayField({
  title,
  description,
  images,
  onAdd,
  onChange,
  onRemove,
  maxImages = 10,
  customNamePrefix = 'subscription-image',
  uploadFolderPath,
  addButtonLabel = '이미지 추가',
  gridClassName = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  className = '',
  slotEmptyLabel = 'IMG',
  previewAspectClassName,
}: ImageUploadArrayFieldProps) {
  const canAdd = images.length < maxImages;
  const handleRemove = (index: number) => {
    const imageUrl = images[index];
    onRemove(index);

    if (imageUrl) {
      void deleteCloudinaryImage(imageUrl);
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-slate-900">{title}</h4>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
          <p className="mt-1 text-xs text-slate-400">
            {isCloudinaryConfigured()
              ? '업로드한 이미지는 Cloudinary URL로 저장됩니다.'
              : 'Cloudinary 미설정 상태입니다. 현재는 브라우저 임시 데이터로 저장됩니다.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {addButtonLabel}
        </button>
      </div>

      <div className={`mt-5 grid gap-4 ${gridClassName}`}>
        {images.map((imageUrl, index) => (
          <div key={`${customNamePrefix}-${index}`} className="space-y-2">
            <ImageUpload
              currentImageUrl={imageUrl}
              onImageUploaded={(nextUrl) => onChange(index, nextUrl)}
              customName={`${customNamePrefix}-${index + 1}`}
              folderPath={uploadFolderPath}
              variant="tile"
              emptyLabel={`${slotEmptyLabel} ${index + 1}`}
              showStatusAlert={false}
              previewAspectClassName={previewAspectClassName}
            />

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-400">이미지 {index + 1}</p>
              {images.length > 1 ? (
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  칸 삭제
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
