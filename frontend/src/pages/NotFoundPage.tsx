import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <FileQuestion className="size-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Page Not Found</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <Button>Back to Projects</Button>
        </Link>
      </div>
    </div>
  );
}
