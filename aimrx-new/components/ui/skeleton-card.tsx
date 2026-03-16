import { cn } from "@/utils/tailwind-utils";
import { generateUniqueId } from "@/utils/id-utils";

interface SkeletonCardProps {
  imageHeight?: string;
  showTags?: boolean;
  tagCount?: number;
  showAction?: boolean;
  className?: string;
  showDescription?: boolean;
  descriptionLines?: number;
}

export const SkeletonCard = ({
  imageHeight = "h-40",
  showTags = true,
  tagCount = 2,
  showAction = true,
  className,
  showDescription = true,
  descriptionLines = 2,
}: SkeletonCardProps) => {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-border overflow-hidden animate-pulse",
        className,
      )}
    >
      <div className={cn("bg-muted", imageHeight)} />

      <div className="p-4 space-y-3">
        {showTags && (
          <div className="flex gap-2">
            {Array.from({ length: tagCount }).map(() => (
              <div
                key={generateUniqueId()}
                className="h-5 bg-muted rounded"
                style={{ width: `${60 + Math.random() * 40}px` }}
              />
            ))}
          </div>
        )}

        {showDescription && (
          <div className="space-y-2">
            {Array.from({ length: descriptionLines }).map((_, index) => (
              <div
                key={generateUniqueId()}
                className={cn(
                  "h-4 bg-muted rounded",
                  index === descriptionLines - 1 ? "w-1/2" : "w-3/4",
                )}
              />
            ))}
          </div>
        )}

        {showAction && <div className="h-8 bg-muted rounded w-24" />}
      </div>
    </div>
  );
};
