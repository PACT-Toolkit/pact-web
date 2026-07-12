import { FilesWorkbench } from '@/src/app/files';

const FilesPage = () => {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Files</h1>
        <p className="text-sm text-muted-foreground">
          Upload, monitor, and delete files. Bytes go directly from your browser
          to object storage using short-lived presigned URLs — they never pass
          through pact-gateway.
        </p>
      </header>
      <FilesWorkbench />
    </div>
  );
};

export default FilesPage;
